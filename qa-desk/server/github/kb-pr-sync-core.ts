import type {
  KbCurationGithubState,
  KbCurationRecord,
} from "../../src/types/kb-curation.js";

export type GithubPullRequestSnapshot = {
  number: number;
  title: string;
  url: string;
  state: "OPEN" | "CLOSED" | "MERGED";
  createdAt: string;
  updatedAt: string;
  mergedAt?: string | null;
  mergeCommit?: { oid?: string } | null;
};

export type GithubPrCommit = {
  oid: string;
  committedDate: string;
  messageHeadline?: string;
  authors?: Array<{ login?: string; name?: string; email?: string }>;
};

export type GithubPrReview = {
  author?: { login?: string } | null;
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED" | "PENDING" | string;
  submittedAt: string;
};

export type GithubPrDetail = {
  commits: GithubPrCommit[];
  reviews: GithubPrReview[];
};

/** Commits de higiene da curadoria (auto-id) não contam como resposta do autor. */
export const CURATOR_LOGINS = new Set(
  ["pedromedeirosdev", "cursoragent"].map((login) => login.toLowerCase()),
);

/** Login GitHub → nome curto na coluna Responsável da Curadoria. */
export function reviewerDisplayFromGithubLogin(login?: string | null): string | undefined {
  if (!login?.trim()) return undefined;
  const key = login.trim().toLowerCase();
  if (key === "pedromedeirosdev") return "Pedro";
  return login.trim();
}

export function isCuratorHygieneCommit(commit: GithubPrCommit): boolean {
  const headline = commit.messageHeadline ?? "";
  if (/^kb:\s*id\b/i.test(headline) || /auto-ajuste de curadoria/i.test(headline)) {
    return true;
  }
  const logins = (commit.authors ?? [])
    .map((author) => author.login?.toLowerCase())
    .filter(Boolean) as string[];
  if (logins.length === 0) return false;
  return logins.every((login) => CURATOR_LOGINS.has(login));
}

export function githubStateFromRemote(
  state: GithubPullRequestSnapshot["state"],
): KbCurationGithubState {
  if (state === "MERGED") return "merged";
  if (state === "CLOSED") return "closed";
  return "open";
}

/** Última review decisiva (request changes / approve) — baseline para “autor respondeu”. */
export function latestDecisiveReview(
  reviews: GithubPrReview[],
): GithubPrReview | undefined {
  return reviews
    .filter(
      (review) =>
        review.state === "CHANGES_REQUESTED" || review.state === "APPROVED",
    )
    .sort(
      (a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt),
    )[0];
}

export function hasCommitAfterReview(
  commits: GithubPrCommit[],
  reviewedAt: string,
): { yes: boolean; latest?: GithubPrCommit } {
  const reviewMs = Date.parse(reviewedAt);
  if (Number.isNaN(reviewMs)) return { yes: false };

  const after = commits
    .filter((commit) => Date.parse(commit.committedDate) > reviewMs)
    .filter((commit) => !isCuratorHygieneCommit(commit))
    .sort((a, b) => Date.parse(b.committedDate) - Date.parse(a.committedDate));

  return { yes: after.length > 0, latest: after[0] };
}

function newerIso(a?: string, b?: string): string | undefined {
  const aMs = a ? Date.parse(a) : Number.NaN;
  const bMs = b ? Date.parse(b) : Number.NaN;
  if (Number.isNaN(aMs) && Number.isNaN(bMs)) return undefined;
  if (Number.isNaN(aMs)) return b;
  if (Number.isNaN(bMs)) return a;
  return aMs >= bMs ? a : b;
}

export function needsReviewDetail(status: KbCurationRecord["status"]): boolean {
  return (
    status === "aguardando_revisao" ||
    status === "aguardando_correcao" ||
    status === "aguardando_rerevisao"
  );
}

/**
 * Aplica snapshot remoto (+ reviews/commits opcionais) a um registro da Curadoria.
 * Mesma máquina de estados do sync em lote e do webhook.
 */
export function applyGithubSnapshotToRecord(
  record: KbCurationRecord,
  pullRequest: GithubPullRequestSnapshot,
  detail: GithubPrDetail | undefined,
  at: string,
  actor = "GitHub sync",
): { record: KbCurationRecord; authorResponded: boolean } {
  const nextGithubState = githubStateFromRemote(pullRequest.state);
  const newlyMerged = nextGithubState === "merged" && record.githubState !== "merged";
  const stateChanged = nextGithubState !== record.githubState;
  const history = [...record.history];
  let nextStatus = record.status;
  let nextReviewedAt = record.reviewedAt;
  let nextVerdict = record.verdict;
  let nextReviewer = record.reviewer?.trim() || undefined;
  let authorResponded = false;

  const decisive = detail ? latestDecisiveReview(detail.reviews) : undefined;
  if (!nextReviewer && decisive?.author?.login) {
    nextReviewer = reviewerDisplayFromGithubLogin(decisive.author.login);
  }
  if (!nextReviewer && newlyMerged && detail) {
    const approved = detail.reviews
      .filter((review) => review.state === "APPROVED")
      .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt))[0];
    nextReviewer = reviewerDisplayFromGithubLogin(approved?.author?.login);
  }

  if (stateChanged) {
    history.push({
      at,
      actor,
      action: newlyMerged
        ? "kb_pr_merged"
        : nextGithubState === "closed"
          ? "kb_pr_github_closed"
          : "kb_pr_github_state_changed",
      detail: `${record.githubState} → ${nextGithubState}`,
    });
  }

  if (newlyMerged) {
    nextStatus = "mesclada";
  } else if (
    nextGithubState === "closed" &&
    record.status !== "bloqueada" &&
    nextStatus !== "fechada"
  ) {
    nextStatus = "fechada";
    if (!stateChanged) {
      history.push({
        at,
        actor,
        action: "kb_pr_github_closed",
        detail: "PR fechada no GitHub sem merge",
      });
    }
  } else if (
    needsReviewDetail(record.status) &&
    nextGithubState === "open" &&
    detail
  ) {
    const baseline = newerIso(decisive?.submittedAt, record.reviewedAt);

    if (baseline) {
      nextReviewedAt = baseline;
      const response = hasCommitAfterReview(detail.commits, baseline);

      if (decisive?.state === "APPROVED" && !response.yes) {
        // Approve sem commit novo — não força status.
      } else if (response.yes) {
        if (nextStatus !== "aguardando_rerevisao") {
          nextStatus = "aguardando_rerevisao";
          authorResponded = true;
          history.push({
            at,
            actor,
            action: "kb_pr_author_responded",
            detail: response.latest
              ? `Autor respondeu após a review (${response.latest.messageHeadline ?? response.latest.oid.slice(0, 7)})`
              : "Autor respondeu após a review",
          });
        }
      } else if (decisive?.state === "CHANGES_REQUESTED") {
        if (nextStatus !== "aguardando_correcao") {
          nextStatus = "aguardando_correcao";
          history.push({
            at,
            actor,
            action: "kb_pr_awaiting_author",
            detail: `Aguardando correção após review de ${decisive.submittedAt.slice(0, 10)}`,
          });
        }
        if (nextVerdict === "inconclusivo" || nextVerdict === "aprovavel") {
          nextVerdict = "precisa_correcao";
        }
      }
    }
  }

  return {
    authorResponded,
    record: {
      ...record,
      title: pullRequest.title,
      url: pullRequest.url,
      githubState: nextGithubState,
      status: nextStatus,
      verdict: nextVerdict,
      reviewer: nextReviewer,
      reviewedAt: nextReviewedAt,
      githubCreatedAt: pullRequest.createdAt,
      githubUpdatedAt: pullRequest.updatedAt,
      mergedAt: pullRequest.mergedAt ?? record.mergedAt,
      mergeCommitSha: pullRequest.mergeCommit?.oid ?? record.mergeCommitSha,
      lastSyncedAt: at,
      history,
    },
  };
}

export function buildImportedRecord(
  repository: string,
  pullRequest: GithubPullRequestSnapshot,
  at: string,
  actor = "GitHub sync",
  project: KbCurationRecord["project"] = "polygonus",
): KbCurationRecord {
  return {
    id: `${repository}#${pullRequest.number}`,
    project,
    repository,
    prNumber: pullRequest.number,
    title: pullRequest.title,
    url: pullRequest.url,
    githubState: "open",
    status: "aguardando_revisao",
    verdict: "inconclusivo",
    githubCreatedAt: pullRequest.createdAt,
    githubUpdatedAt: pullRequest.updatedAt,
    lastSyncedAt: at,
    history: [
      {
        at,
        actor,
        action: "kb_pr_imported",
        detail: "PR aberta importada para a Curadoria KB",
      },
    ],
  };
}
