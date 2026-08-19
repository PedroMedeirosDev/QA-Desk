/** Eventos NDJSON do sync/abertura de issue GitHub. */

export type GithubIssueProgressPhase = "evidence" | "issue" | "comments";

export type GithubIssueProgressEvent = {
  type: "progress";
  phase: GithubIssueProgressPhase;
  message: string;
  current?: number;
  total?: number;
  filename?: string;
};

export type GithubIssueErrorEvent = {
  type: "error";
  error: string;
};

export type GithubIssueDonePayload = {
  ok: true;
  number: number;
  url: string;
  title?: string;
  repository: string;
  alreadyLinked?: boolean;
  alreadyClosed?: boolean;
  commentPosted?: boolean;
  evidenceUploaded: number;
  evidenceSkipped: Array<{ filename: string; reason: string }>;
  commentCatchup?: {
    applied: boolean;
    statusChanged: boolean;
    commentAuthor?: string;
    snippet?: string;
    reason?: string;
  };
};

export type GithubIssueDoneEvent = GithubIssueDonePayload & { type: "done" };

export type GithubIssueStreamEvent =
  | GithubIssueProgressEvent
  | GithubIssueErrorEvent
  | GithubIssueDoneEvent;

export function githubIssueProgressPercent(ev: GithubIssueProgressEvent): number {
  if (ev.phase === "evidence") {
    const total = Math.max(ev.total ?? 1, 1);
    const current = Math.min(Math.max(ev.current ?? 0, 0), total);
    return 12 + Math.round((current / total) * 64);
  }
  if (ev.phase === "issue") return 84;
  if (ev.phase === "comments") return 94;
  return 12;
}
