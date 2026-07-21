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
  }>;
};

function githubState(state: GithubPullRequest["state"]): KbCurationGithubState {
  if (state === "MERGED") return "merged";
  if (state === "CLOSED") return "closed";
  return "open";
}

async function fetchPrCommits(
  repository: string,
  prNumber: number,
): Promise<GithubPrCommits["commits"]> {
  const { stdout } = await execFileAsync(
    "gh",
    ["pr", "view", String(prNumber), "--repo", repository, "--json", "commits"],
    { windowsHide: true, maxBuffer: 2 * 1024 * 1024 },
  );
  const parsed = JSON.parse(stdout) as GithubPrCommits;
  return parsed.commits ?? [];
}

function hasCommitAfterReview(
  commits: GithubPrCommits["commits"],
  reviewedAt: string,
): { yes: boolean; latest?: GithubPrCommits["commits"][number] } {
  const reviewMs = Date.parse(reviewedAt);
  if (Number.isNaN(reviewMs)) return { yes: false };

  const after = commits
    .filter((commit) => Date.parse(commit.committedDate) > reviewMs)
    .sort((a, b) => Date.parse(b.committedDate) - Date.parse(a.committedDate));

  return { yes: after.length > 0, latest: after[0] };
}

export async function syncTrackedKbPullRequests(
  repository: string,
  records: KbCurationRecord[],
): Promise<{
  records: KbCurationRecord[];
  synced: number;
  authorResponses: number;
  at: string;
}> {
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
  let authorResponses = 0;

  const candidates = records.filter(
    (record) =>
      record.status === "aguardando_correcao" &&
      Boolean(record.reviewedAt) &&
      byNumber.has(record.prNumber),
  );

  const commitsByPr = new Map<number, GithubPrCommits["commits"]>();
  await Promise.all(
    candidates.map(async (record) => {
      try {
        const commits = await fetchPrCommits(repository, record.prNumber);
        commitsByPr.set(record.prNumber, commits);
      } catch {
        // Se falhar o lookup de commits, mantém o status atual.
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

    if (stateChanged) {
      history.push({
        at,
        actor: "GitHub sync",
        action: newlyMerged ? "kb_pr_merged" : "kb_pr_github_state_changed",
        detail: `${record.githubState} → ${nextGithubState}`,
      });
    }

    if (newlyMerged) {
      nextStatus = "mesclada";
    } else if (
      record.status === "aguardando_correcao" &&
      record.reviewedAt &&
      commitsByPr.has(record.prNumber)
    ) {
      const response = hasCommitAfterReview(
        commitsByPr.get(record.prNumber)!,
        record.reviewedAt,
      );
      if (response.yes) {
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
    }

    return {
      ...record,
      title: pullRequest.title,
      url: pullRequest.url,
      githubState: nextGithubState,
      status: nextStatus,
      githubCreatedAt: pullRequest.createdAt,
      githubUpdatedAt: pullRequest.updatedAt,
      mergedAt: pullRequest.mergedAt ?? record.mergedAt,
      mergeCommitSha: pullRequest.mergeCommit?.oid ?? record.mergeCommitSha,
      lastSyncedAt: at,
      history,
    };
  });

  return { records: updated, synced, authorResponses, at };
}
