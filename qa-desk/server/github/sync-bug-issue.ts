/**
 * Volta GitHub Issue → status do bug no Desk.
 * Só issues com label `bug` + já vinculadas (`githubIssueNumber`) + autor/assignee
 * na allowlist (Pedro / GITHUB_BUG_ISSUE_ACTORS).
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

    // Vínculo Desk = “meu”. Se o payload trouxer labels, exige `bug`.
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
