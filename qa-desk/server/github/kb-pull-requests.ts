import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  KbCurationGithubState,
  KbCurationRecord,
} from "../../src/types/kb-curation.js";

const execFileAsync = promisify(execFile);

type GithubPullRequest = {
  number: number;
  title: string;
  url: string;
  state: "OPEN" | "CLOSED" | "MERGED";
  createdAt: string;
  updatedAt: string;
  mergedAt?: string | null;
  mergeCommit?: { oid?: string } | null;
};

type GithubPrCommits = {
  commits: Array<{
    oid: string;
    committedDate: string;
    messageHeadline?: string;
    authors?: Array<{ login?: string; name?: string; email?: string }>;
  }>;
};

type GithubPrReview = {
  author?: { login?: string } | null;
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED" | "PENDING" | string;
  submittedAt: string;
};

type GithubPrDetail = {
  commits: GithubPrCommits["commits"];
  reviews: GithubPrReview[];
};

/** Commits de higiene da curadoria (auto-id) não contam como resposta do autor. */
const CURATOR_LOGINS = new Set(
  ["pedromedeirosdev", "cursoragent"].map((login) => login.toLowerCase()),
);

function isCuratorHygieneCommit(
  commit: GithubPrCommits["commits"][number],
): boolean {
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

function githubState(state: GithubPullRequest["state"]): KbCurationGithubState {
  if (state === "MERGED") return "merged";
  if (state === "CLOSED") return "closed";
  return "open";
}

async function fetchPrDetail(
  repository: string,
  prNumber: number,
): Promise<GithubPrDetail> {
  const { stdout } = await execFileAsync(
    "gh",
    [
      "pr",
      "view",
      String(prNumber),
      "--repo",
      repository,
      "--json",
      "commits,reviews",
    ],
    { windowsHide: true, maxBuffer: 2 * 1024 * 1024 },
  );
  const parsed = JSON.parse(stdout) as {
    commits?: GithubPrCommits["commits"];
    reviews?: GithubPrReview[];
  };
  return {
    commits: parsed.commits ?? [],
    reviews: parsed.reviews ?? [],
  };
}

/** Última review decisiva (request changes / approve) — baseline para “autor respondeu”. */
function latestDecisiveReview(
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

function hasCommitAfterReview(
  commits: GithubPrCommits["commits"],
  reviewedAt: string,
): { yes: boolean; latest?: GithubPrCommits["commits"][number] } {
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

export async function syncTrackedKbPullRequests(
  repository: string,
  records: KbCurationRecord[],
  opts?: { importOpen?: boolean },
): Promise<{
  records: KbCurationRecord[];
  synced: number;
  imported: number;
  authorResponses: number;
  at: string;
}> {
  const importOpen = opts?.importOpen !== false;
  const { stdout } = await execFileAsync(
    "gh",
    [
      "pr",
      "list",
      "--repo",
      repository,
      "--state",
      "all",
      "--limit",
      "200",
      "--json",
      "number,title,url,state,createdAt,updatedAt,mergedAt,mergeCommit",
    ],
    { windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
  );

  const remote = JSON.parse(stdout) as GithubPullRequest[];
  const byNumber = new Map(remote.map((pullRequest) => [pullRequest.number, pullRequest]));
  const at = new Date().toISOString();
  let synced = 0;
  let imported = 0;
  let authorResponses = 0;

  // Reviews decisivas no GitHub: cobre (1) request changes feito fora da UI
  // (ex. `gh pr review` — status ainda `aguardando_revisao`) e (2) re-revisão /
  // “autor respondeu” quando já está em correção (ex.: PR #35).
  const candidates = records.filter((record) => {
    if (!byNumber.has(record.prNumber)) return false;
    return (
      record.status === "aguardando_revisao" ||
      record.status === "aguardando_correcao" ||
      record.status === "aguardando_rerevisao"
    );
  });

  const detailByPr = new Map<number, GithubPrDetail>();
  await Promise.all(
    candidates.map(async (record) => {
      try {
        const detail = await fetchPrDetail(repository, record.prNumber);
        detailByPr.set(record.prNumber, detail);
      } catch {
        // Se falhar o lookup, mantém o status atual.
      }
    }),
  );

  const updated = records.map((record) => {
    const pullRequest = byNumber.get(record.prNumber);
    if (!pullRequest) return record;
    synced += 1;

    const nextGithubState = githubState(pullRequest.state);
    const newlyMerged = nextGithubState === "merged" && record.githubState !== "merged";
    const stateChanged = nextGithubState !== record.githubState;
    const history = [...record.history];
    let nextStatus = record.status;
    let nextReviewedAt = record.reviewedAt;
    let nextVerdict = record.verdict;

    if (stateChanged) {
      history.push({
        at,
        actor: "GitHub sync",
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
      // Fechada no GitHub sem merge (empilhada, abandonada, base apagada…).
      // Trava explícita de curadoria (`bloqueada`) prevalece.
      nextStatus = "fechada";
      if (!stateChanged) {
        history.push({
          at,
          actor: "GitHub sync",
          action: "kb_pr_github_closed",
          detail: "PR fechada no GitHub sem merge",
        });
      }
    } else if (
      (record.status === "aguardando_revisao" ||
        record.status === "aguardando_correcao" ||
        record.status === "aguardando_rerevisao") &&
      nextGithubState === "open" &&
      detailByPr.has(record.prNumber)
    ) {
      const detail = detailByPr.get(record.prNumber)!;
      const decisive = latestDecisiveReview(detail.reviews);
      const baseline = newerIso(decisive?.submittedAt, record.reviewedAt);

      if (baseline) {
        nextReviewedAt = baseline;
        const response = hasCommitAfterReview(detail.commits, baseline);

        if (decisive?.state === "APPROVED" && !response.yes) {
          // Review mais recente é approve e não há commit depois — não força status aqui.
        } else if (response.yes) {
          // Há commit do autor depois da última review decisiva → re-revisar.
          if (nextStatus !== "aguardando_rerevisao") {
            nextStatus = "aguardando_rerevisao";
            authorResponses += 1;
            history.push({
              at,
              actor: "GitHub sync",
              action: "kb_pr_author_responded",
              detail: response.latest
                ? `Autor respondeu após a review (${response.latest.messageHeadline ?? response.latest.oid.slice(0, 7)})`
                : "Autor respondeu após a review",
            });
          }
        } else if (decisive?.state === "CHANGES_REQUESTED") {
          // Última review pediu correção e não há commit novo → aguardando autor.
          // Cobre request changes via gh/CLI com status ainda `aguardando_revisao`
          // (ex. #87/#89/#90) e re-review sem atualizar a Curadoria na UI (ex. #35).
          if (nextStatus !== "aguardando_correcao") {
            nextStatus = "aguardando_correcao";
            history.push({
              at,
              actor: "GitHub sync",
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
      ...record,
      title: pullRequest.title,
      url: pullRequest.url,
      githubState: nextGithubState,
      status: nextStatus,
      verdict: nextVerdict,
      reviewedAt: nextReviewedAt,
      githubCreatedAt: pullRequest.createdAt,
      githubUpdatedAt: pullRequest.updatedAt,
      mergedAt: pullRequest.mergedAt ?? record.mergedAt,
      mergeCommitSha: pullRequest.mergeCommit?.oid ?? record.mergeCommitSha,
      lastSyncedAt: at,
      history,
    };
  });

  const known = new Set(updated.map((record) => record.prNumber));
  const importedRecords: KbCurationRecord[] = [];

  if (importOpen) {
    const openRemote = remote
      .filter((pullRequest) => pullRequest.state === "OPEN" && !known.has(pullRequest.number))
      .sort((a, b) => a.number - b.number);

    for (const pullRequest of openRemote) {
      imported += 1;
      importedRecords.push({
        id: `${repository}#${pullRequest.number}`,
        project: "polygonus",
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
            actor: "GitHub sync",
            action: "kb_pr_imported",
            detail: "PR aberta importada para a Curadoria KB",
          },
        ],
      });
    }
  }

  return {
    records: [...updated, ...importedRecords].sort((a, b) => a.prNumber - b.prNumber),
    synced,
    imported,
    authorResponses,
    at,
  };
}
