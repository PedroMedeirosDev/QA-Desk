/**
 * Volta GitHub Issue → status do bug no Desk.
 * - closed/reopened: label `bug` + autor/assignee em GITHUB_BUG_ISSUE_ACTORS + vínculo Desk
 * - issue_comment: comentário do gestor (não QA/bot) → histórico + em_tratamento
 */
import { appendHistory, readCatalog, writeCatalog } from "../storage.js";
import type { BugStatus, ProjectSlug, TestRecord } from "../types.js";

const DEFAULT_ACTORS = ["PedroMedeirosDev"];

export type BugIssueWebhookPayload = {
  action?: string;
  repository?: { full_name?: string };
  issue?: {
    number?: number;
    state?: string;
    state_reason?: string | null;
    user?: { login?: string | null } | null;
    assignees?: Array<{ login?: string | null } | null> | null;
    labels?: Array<string | { name?: string | null } | null> | null;
  };
};

export type BugIssueCommentWebhookPayload = {
  action?: string;
  repository?: { full_name?: string };
  issue?: BugIssueWebhookPayload["issue"];
  comment?: {
    id?: number;
    body?: string | null;
    html_url?: string | null;
    created_at?: string | null;
    user?: { login?: string | null; type?: string | null } | null;
  };
};

export type ApplyBugIssueResult = {
  ok: true;
  skipped: boolean;
  reason?: string;
  project?: ProjectSlug;
  issueNumber?: number;
  bugId?: string;
  status?: BugStatus;
  changed?: boolean;
};

export function bugIssueActors(): string[] {
  const raw = process.env.GITHUB_BUG_ISSUE_ACTORS?.trim();
  if (!raw) return DEFAULT_ACTORS;
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Logins cujo comentário conta como resposta do gestor. Vazio = qualquer um fora dos atores QA. */
export function bugCommentActors(): string[] {
  const raw = process.env.GITHUB_BUG_COMMENT_ACTORS?.trim();
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function labelNames(
  labels: Array<string | { name?: string | null } | null> | null | undefined,
): string[] {
  if (!Array.isArray(labels)) return [];
  return labels
    .map((l) => (typeof l === "string" ? l : l?.name ?? ""))
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean);
}

export function issueHasBugLabel(
  labels: Array<string | { name?: string | null } | null> | null | undefined,
): boolean {
  return labelNames(labels).includes("bug");
}

export function issueLinkedToActors(
  issue: NonNullable<BugIssueWebhookPayload["issue"]>,
  actors: string[] = bugIssueActors(),
): boolean {
  const allowed = new Set(actors.map((a) => a.toLowerCase()));
  const author = issue.user?.login?.trim().toLowerCase();
  if (author && allowed.has(author)) return true;
  for (const a of issue.assignees ?? []) {
    const login = a?.login?.trim().toLowerCase();
    if (login && allowed.has(login)) return true;
  }
  return false;
}

function isBugRecord(report: TestRecord): boolean {
  return (report.recordType ?? (report.campaign ? "teste" : "bug")) === "bug";
}

/** Status terminal / avançados que o webhook não deve rebaixar. */
const PROTECTED: ReadonlySet<BugStatus> = new Set([
  "homologado",
  "arquivado",
  "nao_reproduzido",
]);

/** Comentário do gestor não mexe nestes status (só histórico). */
const COMMENT_STATUS_LOCKED: ReadonlySet<BugStatus> = new Set([
  ...PROTECTED,
  "corrigido_gestor",
  "sem_correcao",
  "cancelado",
]);

export function statusFromIssueAction(
  action: string,
  stateReason: string | null | undefined,
): BugStatus | null {
  if (action === "reopened") return "enviado_gestor";
  if (action === "closed") {
    if (stateReason === "not_planned") return "sem_correcao";
    return "corrigido_gestor";
  }
  return null;
}

function truncateComment(body: string, max = 280): string {
  const t = body.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/**
 * Comentário conta como gestor se:
 * - não for Bot
 * - se GITHUB_BUG_COMMENT_ACTORS definido → login na lista
 * - senão → login fora de GITHUB_BUG_ISSUE_ACTORS (QA não “responde” a si)
 */
export function isGestorIssueComment(comment: {
  user?: { login?: string | null; type?: string | null } | null;
}): boolean {
  const type = comment.user?.type?.trim().toLowerCase();
  if (type === "bot") return false;
  const login = comment.user?.login?.trim().toLowerCase();
  if (!login) return false;

  const allow = bugCommentActors().map((a) => a.toLowerCase());
  if (allow.length > 0) return allow.includes(login);

  const qa = new Set(bugIssueActors().map((a) => a.toLowerCase()));
  return !qa.has(login);
}

export type PullGestorCommentsResult = {
  applied: boolean;
  statusChanged: boolean;
  commentAuthor?: string;
  snippet?: string;
  reason?: string;
};

type GhIssueComment = {
  id?: number;
  body?: string | null;
  html_url?: string | null;
  created_at?: string | null;
  user?: { login?: string | null; type?: string | null } | null;
};

/**
 * Catch-up: busca comentários da issue via `gh api` e aplica o último do gestor
 * (mesma regra do webhook). Não depende do webhook ter entregue o evento.
 */
export async function pullGestorCommentsIntoReport(
  report: TestRecord,
  opts?: { actor?: string },
): Promise<PullGestorCommentsResult> {
  const issueNumber = report.githubIssueNumber;
  if (!issueNumber) {
    return { applied: false, statusChanged: false, reason: "sem issue vinculada" };
  }

  const { bugIssuesRepo } = await import("./create-bug-issue.js");
  const repository = bugIssuesRepo();
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);

  let comments: GhIssueComment[] = [];
  try {
    const { stdout } = await execFileAsync(
      "gh",
      [
        "api",
        `repos/${repository}/issues/${issueNumber}/comments`,
        "--paginate",
      ],
      {
        windowsHide: true,
        maxBuffer: 4 * 1024 * 1024,
        timeout: 90_000,
      },
    );
    const parsed = JSON.parse(stdout) as GhIssueComment[] | GhIssueComment;
    comments = Array.isArray(parsed) ? parsed : [parsed];
  } catch (err) {
    const e = err as Error & { stderr?: string };
    return {
      applied: false,
      statusChanged: false,
      reason: e.stderr?.trim() || e.message || "falha gh api comments",
    };
  }

  const gestor = comments
    .filter((c) => isGestorIssueComment(c) && (c.body ?? "").trim())
    .sort((a, b) => {
      const ta = Date.parse(a.created_at ?? "") || 0;
      const tb = Date.parse(b.created_at ?? "") || 0;
      return ta - tb;
    });

  if (!gestor.length) {
    return { applied: false, statusChanged: false, reason: "nenhum comentário de gestor" };
  }

  const latest = gestor[gestor.length - 1]!;
  const body = (latest.body ?? "").trim();
  const snippet = truncateComment(body);
  const author = latest.user?.login?.trim() || "desconhecido";
  const at = latest.created_at?.trim() || new Date().toISOString();
  const commentUrl = latest.html_url?.trim() || report.githubIssueUrl;

  const sameAsStored =
    report.githubIssueLastCommentBody === snippet &&
    report.githubIssueLastCommentBy === author &&
    report.githubIssueLastCommentAt === at;

  if (sameAsStored) {
    return { applied: false, statusChanged: false, reason: "já sincronizado", commentAuthor: author, snippet };
  }

  report.githubIssueLastCommentAt = at;
  report.githubIssueLastCommentBy = author;
  report.githubIssueLastCommentBody = snippet;
  report.githubIssueLastCommentUrl = commentUrl;

  const prev = report.status;
  let statusChanged = false;
  if (
    !COMMENT_STATUS_LOCKED.has(prev) &&
    (prev === "enviado_gestor" || prev === "reportado")
  ) {
    report.status = "em_tratamento";
    statusChanged = prev !== report.status;
  }

  appendHistory(report, {
    actor: opts?.actor ?? "GitHub catch-up",
    action: "github_issue_comment_catchup",
    detail: statusChanged
      ? `Catch-up comentário de @${author} na #${issueNumber} → ${report.status}: ${snippet}`
      : `Catch-up comentário de @${author} na #${issueNumber}: ${snippet}`,
    meta: {
      githubIssueNumber: issueNumber,
      githubIssueUrl: report.githubIssueUrl,
      commentUrl,
      commentId: latest.id ?? null,
      commentAuthor: author,
      fromStatus: prev,
      toStatus: report.status,
    },
  });

  return {
    applied: true,
    statusChanged,
    commentAuthor: author,
    snippet,
  };
}

export async function applyBugIssueFromWebhook(
  project: ProjectSlug,
  payload: BugIssueWebhookPayload,
): Promise<ApplyBugIssueResult> {
  const action = payload.action ?? "";
  const issue = payload.issue;
  const issueNumber = issue?.number;

  if (!issue || !issueNumber) {
    return { ok: true, skipped: true, reason: "payload sem issue.number" };
  }

  if (action !== "closed" && action !== "reopened") {
    return { ok: true, skipped: true, reason: `action ${action} ignorada`, issueNumber };
  }

  if (!issueHasBugLabel(issue.labels)) {
    return { ok: true, skipped: true, reason: "sem label bug", issueNumber };
  }

  if (!issueLinkedToActors(issue)) {
    return {
      ok: true,
      skipped: true,
      reason: `autor/assignee fora de ${bugIssueActors().join(",")}`,
      issueNumber,
    };
  }

  const nextStatus = statusFromIssueAction(action, issue.state_reason);
  if (!nextStatus) {
    return { ok: true, skipped: true, reason: "sem mapeamento de status", issueNumber };
  }

  const catalog = await readCatalog(project);
  const idx = catalog.reports.findIndex(
    (r) => isBugRecord(r) && r.githubIssueNumber === issueNumber,
  );
  if (idx < 0) {
    return {
      ok: true,
      skipped: true,
      reason: "issue não vinculada a bug no Desk",
      project,
      issueNumber,
    };
  }

  const report = catalog.reports[idx];
  const prev = report.status;

  if (PROTECTED.has(prev) && action === "closed") {
    return {
      ok: true,
      skipped: true,
      reason: `status protegido (${prev})`,
      project,
      issueNumber,
      bugId: report.id,
      status: prev,
      changed: false,
    };
  }

  if (prev === nextStatus) {
    return {
      ok: true,
      skipped: true,
      reason: "status já aplicado",
      project,
      issueNumber,
      bugId: report.id,
      status: prev,
      changed: false,
    };
  }

  report.status = nextStatus;
  if (action === "closed") {
    report.githubIssueClosedAt = new Date().toISOString();
  } else if (action === "reopened") {
    delete report.githubIssueClosedAt;
  }

  appendHistory(report, {
    actor: "GitHub webhook",
    action: action === "closed" ? "github_issue_closed" : "github_issue_reopened",
    detail: `Issue #${issueNumber} ${action} → ${nextStatus} (antes: ${prev})`,
    meta: {
      githubIssueNumber: issueNumber,
      githubIssueUrl: report.githubIssueUrl,
      stateReason: issue.state_reason ?? null,
      fromStatus: prev,
      toStatus: nextStatus,
    },
  });

  catalog.reports[idx] = report;
  await writeCatalog(project, catalog);

  return {
    ok: true,
    skipped: false,
    project,
    issueNumber,
    bugId: report.id,
    status: nextStatus,
    changed: true,
  };
}

/**
 * Comentário na issue vinculada: histórico + opcionalmente `em_tratamento`.
 * Quem fecha a issue continua sendo o QA após homologar.
 */
export async function applyBugIssueCommentFromWebhook(
  project: ProjectSlug,
  payload: BugIssueCommentWebhookPayload,
): Promise<ApplyBugIssueResult> {
  const action = payload.action ?? "";
  if (action !== "created" && action !== "edited") {
    return { ok: true, skipped: true, reason: `comment action ${action} ignorada` };
  }

  const issue = payload.issue;
  const comment = payload.comment;
  const issueNumber = issue?.number;

  if (!issue || !issueNumber || !comment) {
    return { ok: true, skipped: true, reason: "payload sem issue/comment" };
  }

  if (!issueHasBugLabel(issue.labels)) {
    return { ok: true, skipped: true, reason: "sem label bug", issueNumber };
  }

  if (!isGestorIssueComment(comment)) {
    return {
      ok: true,
      skipped: true,
      reason: "comentário ignorado (bot ou ator QA)",
      issueNumber,
    };
  }

  const body = (comment.body ?? "").trim();
  if (!body) {
    return { ok: true, skipped: true, reason: "comentário vazio", issueNumber };
  }

  const catalog = await readCatalog(project);
  const idx = catalog.reports.findIndex(
    (r) => isBugRecord(r) && r.githubIssueNumber === issueNumber,
  );
  if (idx < 0) {
    return {
      ok: true,
      skipped: true,
      reason: "issue não vinculada a bug no Desk",
      project,
      issueNumber,
    };
  }

  const report = catalog.reports[idx];
  const prev = report.status;
  const author = comment.user?.login?.trim() || "desconhecido";
  const at = comment.created_at?.trim() || new Date().toISOString();
  const snippet = truncateComment(body);

  report.githubIssueLastCommentAt = at;
  report.githubIssueLastCommentBy = author;
  report.githubIssueLastCommentBody = snippet;
  report.githubIssueLastCommentUrl =
    comment.html_url?.trim() || report.githubIssueUrl;

  let nextStatus = prev;
  let statusChanged = false;
  if (
    !COMMENT_STATUS_LOCKED.has(prev) &&
    (prev === "enviado_gestor" || prev === "reportado")
  ) {
    nextStatus = "em_tratamento";
    statusChanged = prev !== nextStatus;
    report.status = nextStatus;
  }

  appendHistory(report, {
    actor: "GitHub webhook",
    action:
      action === "edited" ? "github_issue_comment_edited" : "github_issue_comment",
    detail: statusChanged
      ? `Comentário de @${author} na #${issueNumber} → ${nextStatus}: ${snippet}`
      : `Comentário de @${author} na #${issueNumber}: ${snippet}`,
    meta: {
      githubIssueNumber: issueNumber,
      githubIssueUrl: report.githubIssueUrl,
      commentUrl: comment.html_url ?? null,
      commentId: comment.id ?? null,
      commentAuthor: author,
      fromStatus: prev,
      toStatus: nextStatus,
      commentAction: action,
    },
  });

  catalog.reports[idx] = report;
  await writeCatalog(project, catalog);

  return {
    ok: true,
    skipped: false,
    project,
    issueNumber,
    bugId: report.id,
    status: nextStatus,
    changed: true,
  };
}

export type BugIssueDependencyPayload = {
  action?: string;
  repository?: { full_name?: string };
  blocked_issue?: {
    number?: number;
    html_url?: string;
    title?: string;
    user?: { login?: string | null } | null;
    assignees?: Array<{ login?: string | null } | null> | null;
    labels?: Array<string | { name?: string | null } | null> | null;
  };
  blocking_issue?: {
    number?: number;
    html_url?: string;
    title?: string;
    user?: { login?: string | null } | null;
    assignees?: Array<{ login?: string | null } | null> | null;
    labels?: Array<string | { name?: string | null } | null> | null;
  };
  blocking_issue_repo?: { full_name?: string };
};

const DEPENDENCY_ACTIONS = new Set([
  "blocked_by_added",
  "blocked_by_removed",
  "blocking_added",
  "blocking_removed",
]);

function dependencyDetail(
  action: string,
  blockedNum: number,
  blockingNum: number,
): string {
  switch (action) {
    case "blocked_by_added":
      return `Issue #${blockedNum} bloqueada por #${blockingNum}`;
    case "blocked_by_removed":
      return `Issue #${blockedNum} não está mais bloqueada por #${blockingNum}`;
    case "blocking_added":
      return `Issue #${blockingNum} passa a bloquear #${blockedNum}`;
    case "blocking_removed":
      return `Issue #${blockingNum} deixa de bloquear #${blockedNum}`;
    default:
      return `Dependência ${action}: #${blockedNum} ↔ #${blockingNum}`;
  }
}

/**
 * Rastreia blocked-by / blocking no histórico dos bugs já vinculados no Desk.
 * Sem vínculo Desk → no-op (zero ruído).
 */
export async function applyBugIssueDependencyFromWebhook(
  project: ProjectSlug,
  payload: BugIssueDependencyPayload,
): Promise<ApplyBugIssueResult & { updatedBugIds?: string[] }> {
  const action = payload.action ?? "";
  if (!DEPENDENCY_ACTIONS.has(action)) {
    return { ok: true, skipped: true, reason: `action ${action} ignorada` };
  }

  const blockedNum = payload.blocked_issue?.number;
  const blockingNum = payload.blocking_issue?.number;
  if (!blockedNum || !blockingNum) {
    return { ok: true, skipped: true, reason: "payload sem blocked/blocking number" };
  }

  const catalog = await readCatalog(project);
  const targetNums = new Set([blockedNum, blockingNum]);
  const updatedBugIds: string[] = [];
  const detail = dependencyDetail(action, blockedNum, blockingNum);
  const blockingRepo =
    payload.blocking_issue_repo?.full_name ?? payload.repository?.full_name ?? null;

  for (let i = 0; i < catalog.reports.length; i++) {
    const report = catalog.reports[i];
    if (!isBugRecord(report) || !report.githubIssueNumber) continue;
    if (!targetNums.has(report.githubIssueNumber)) continue;

    const side =
      report.githubIssueNumber === blockedNum
        ? payload.blocked_issue
        : payload.blocking_issue;
    if (side?.labels?.length && !issueHasBugLabel(side.labels)) continue;

    appendHistory(report, {
      actor: "GitHub webhook",
      action: "github_issue_dependency",
      detail,
      meta: {
        dependencyAction: action,
        blockedIssueNumber: blockedNum,
        blockingIssueNumber: blockingNum,
        blockingIssueRepo: blockingRepo,
        blockedUrl: payload.blocked_issue?.html_url ?? null,
        blockingUrl: payload.blocking_issue?.html_url ?? null,
        linkedIssueNumber: report.githubIssueNumber,
      },
    });
    catalog.reports[i] = report;
    updatedBugIds.push(report.id);
  }

  if (!updatedBugIds.length) {
    return {
      ok: true,
      skipped: true,
      reason: "nenhum bug vinculado a essas issues",
      project,
    };
  }

  await writeCatalog(project, catalog);
  return {
    ok: true,
    skipped: false,
    project,
    changed: true,
    updatedBugIds,
    bugId: updatedBugIds[0],
    issueNumber: blockedNum,
  };
}
