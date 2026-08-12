import { createHmac, timingSafeEqual } from "node:crypto";
import { Router, type Request, type Response } from "express";
import {
  readKbCurationCatalog,
  writeKbCurationCatalog,
} from "../kb-curation.js";
import { syncSingleKbPullRequest } from "../github/kb-pull-requests.js";
import {
  applyBugIssueDependencyFromWebhook,
  applyBugIssueFromWebhook,
  applyBugIssueCommentFromWebhook,
  type BugIssueCommentWebhookPayload,
  type BugIssueDependencyPayload,
  type BugIssueWebhookPayload,
} from "../github/sync-bug-issue.js";
import { type ProjectSlug } from "../types.js";

type RequestWithRawBody = Request & { rawBody?: Buffer };

const debounceMs = Number(process.env.GITHUB_WEBHOOK_DEBOUNCE_MS ?? 1500);
const pending = new Map<string, NodeJS.Timeout>();

/**
 * Mapa explícito repo GitHub → projeto do Desk.
 * NÃO inferir pelo seed de todos os projetos — desk/anihype herdavam o
 * repository da KB e o webhook atualizava o catálogo errado (merges viravam no-op).
 */
const REPOSITORY_TO_PROJECT: Record<string, ProjectSlug> = {
  "polygonus-br/polygonus-suporte-kb": "polygonus",
};

export function isKbGithubWebhookConfigured(): boolean {
  return Boolean(process.env.GITHUB_WEBHOOK_SECRET?.trim());
}

function verifySignature(rawBody: Buffer, signatureHeader: string | undefined, secret: string) {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const digest = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expected = Buffer.from(`sha256=${digest}`, "utf8");
  const received = Buffer.from(signatureHeader, "utf8");
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

function projectForRepository(
  fullName: string,
): { project: ProjectSlug; repository: string } | null {
  const normalized = fullName.trim().toLowerCase();
  const project = REPOSITORY_TO_PROJECT[normalized];
  if (!project) return null;
  return { project, repository: fullName };
}

function shouldHandleEvent(event: string, action: string | undefined): boolean {
  if (event === "ping") return true;
  if (event === "pull_request") {
    return [
      "opened",
      "reopened",
      "closed",
      "synchronize",
      "edited",
      "ready_for_review",
    ].includes(action ?? "");
  }
  if (event === "pull_request_review") {
    return action === "submitted" || action === "dismissed" || action === "edited";
  }
  if (event === "issues") {
    return action === "closed" || action === "reopened";
  }
  if (event === "issue_comment") {
    return action === "created" || action === "edited";
  }
  if (event === "issue_dependencies") {
    return [
      "blocked_by_added",
      "blocked_by_removed",
      "blocking_added",
      "blocking_removed",
    ].includes(action ?? "");
  }
  return false;
}

async function applyPrUpdate(repository: string, prNumber: number) {
  const match = projectForRepository(repository);
  if (!match) {
    console.info(`[kb-webhook] repo ${repository} não mapeado na Curadoria — ignorado`);
    return { ok: true, skipped: true as const };
  }

  const catalog = await readKbCurationCatalog(match.project);
  const result = await syncSingleKbPullRequest(
    match.repository,
    catalog.pullRequests,
    prNumber,
    { actor: "GitHub webhook", project: match.project },
  );

  if (result.changed) {
    catalog.pullRequests = result.records;
    catalog.meta.updatedAt = result.at.slice(0, 10);
    await writeKbCurationCatalog(match.project, catalog, { sseReason: "webhook" });
    console.info(
      `[kb-webhook] #${prNumber} → ${match.project} changed=${result.changed} imported=${result.imported}`,
    );
  } else {
    console.info(`[kb-webhook] #${prNumber} → ${match.project} sem alteração`);
  }

  return {
    ok: true,
    skipped: false as const,
    project: match.project,
    prNumber,
    changed: result.changed,
    imported: result.imported,
    authorResponded: result.authorResponded,
  };
}

function schedulePrUpdate(repository: string, prNumber: number) {
  const key = `pr:${repository}#${prNumber}`;
  const previous = pending.get(key);
  if (previous) clearTimeout(previous);

  return new Promise<Awaited<ReturnType<typeof applyPrUpdate>>>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(key);
      applyPrUpdate(repository, prNumber).then(resolve).catch(reject);
    }, debounceMs);
    pending.set(key, timer);
  });
}

async function applyIssueUpdate(repository: string, payload: BugIssueWebhookPayload) {
  const match = projectForRepository(repository);
  if (!match) {
    console.info(`[bug-issue-webhook] repo ${repository} não mapeado — ignorado`);
    return { ok: true as const, skipped: true as const, reason: "repo não mapeado" };
  }

  const result = await applyBugIssueFromWebhook(match.project, payload);
  if (result.changed) {
    console.info(
      `[bug-issue-webhook] #${result.issueNumber} → ${result.bugId} status=${result.status}`,
    );
  } else {
    console.info(
      `[bug-issue-webhook] #${result.issueNumber ?? "?"} skipped: ${result.reason ?? "n/a"}`,
    );
  }
  return result;
}

function scheduleIssueUpdate(repository: string, payload: BugIssueWebhookPayload) {
  const n = payload.issue?.number ?? 0;
  const key = `issue:${repository}#${n}:${payload.action ?? ""}`;
  const previous = pending.get(key);
  if (previous) clearTimeout(previous);

  return new Promise<Awaited<ReturnType<typeof applyIssueUpdate>>>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(key);
      applyIssueUpdate(repository, payload).then(resolve).catch(reject);
    }, Math.min(debounceMs, 400));
    pending.set(key, timer);
  });
}

async function applyDependencyUpdate(
  repository: string,
  payload: BugIssueDependencyPayload,
) {
  const match = projectForRepository(repository);
  if (!match) {
    console.info(`[bug-issue-webhook] repo ${repository} não mapeado — ignorado`);
    return { ok: true as const, skipped: true as const, reason: "repo não mapeado" };
  }
  const result = await applyBugIssueDependencyFromWebhook(match.project, payload);
  if (result.changed) {
    console.info(
      `[bug-issue-webhook] dependency ${payload.action} → bugs ${result.updatedBugIds?.join(",")}`,
    );
  } else {
    console.info(`[bug-issue-webhook] dependency skipped: ${result.reason ?? "n/a"}`);
  }
  return result;
}

function scheduleDependencyUpdate(
  repository: string,
  payload: BugIssueDependencyPayload,
) {
  const key = `dep:${repository}#${payload.blocked_issue?.number}-${payload.blocking_issue?.number}:${payload.action}`;
  const previous = pending.get(key);
  if (previous) clearTimeout(previous);

  return new Promise<Awaited<ReturnType<typeof applyDependencyUpdate>>>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(key);
      applyDependencyUpdate(repository, payload).then(resolve).catch(reject);
    }, Math.min(debounceMs, 400));
    pending.set(key, timer);
  });
}

async function applyIssueCommentUpdate(
  repository: string,
  payload: BugIssueCommentWebhookPayload,
) {
  const match = projectForRepository(repository);
  if (!match) {
    console.info(`[bug-issue-webhook] repo ${repository} não mapeado — ignorado`);
    return { ok: true as const, skipped: true as const, reason: "repo não mapeado" };
  }

  const result = await applyBugIssueCommentFromWebhook(match.project, payload);
  if (result.changed) {
    console.info(
      `[bug-issue-webhook] comment #${result.issueNumber} → ${result.bugId} status=${result.status}`,
    );
  } else {
    console.info(
      `[bug-issue-webhook] comment #${result.issueNumber ?? "?"} skipped: ${result.reason ?? "n/a"}`,
    );
  }
  return result;
}

function scheduleIssueCommentUpdate(
  repository: string,
  payload: BugIssueCommentWebhookPayload,
) {
  const n = payload.issue?.number ?? 0;
  const c = payload.comment?.id ?? 0;
  const key = `issue-comment:${repository}#${n}:${c}:${payload.action ?? ""}`;
  const previous = pending.get(key);
  if (previous) clearTimeout(previous);

  return new Promise<Awaited<ReturnType<typeof applyIssueCommentUpdate>>>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(key);
      applyIssueCommentUpdate(repository, payload).then(resolve).catch(reject);
    }, Math.min(debounceMs, 400));
    pending.set(key, timer);
  });
}

export const githubWebhooksRouter = Router();

/**
 * Payload deve chegar como Buffer (`express.raw`) para validar X-Hub-Signature-256.
 */
githubWebhooksRouter.post("/kb-curation", async (req: RequestWithRawBody, res: Response) => {
  const secret = process.env.GITHUB_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return res.status(503).json({
      error: "GITHUB_WEBHOOK_SECRET não configurado",
    });
  }

  const rawBody = req.rawBody ?? (Buffer.isBuffer(req.body) ? req.body : null);
  if (!rawBody) {
    return res.status(400).json({ error: "Body raw ausente (configure express.raw nesta rota)" });
  }

  const signature = req.header("x-hub-signature-256") ?? undefined;
  if (!verifySignature(rawBody, signature, secret)) {
    return res.status(401).json({ error: "Assinatura inválida" });
  }

  const event = req.header("x-github-event") ?? "";
  let payload: BugIssueWebhookPayload &
    BugIssueCommentWebhookPayload &
    BugIssueDependencyPayload & {
      pull_request?: { number?: number };
    };
  try {
    payload = JSON.parse(rawBody.toString("utf8")) as typeof payload;
  } catch {
    return res.status(400).json({ error: "JSON inválido" });
  }

  if (event === "ping") {
    return res.json({ ok: true, pong: true });
  }

  if (!shouldHandleEvent(event, payload.action)) {
    return res.json({ ok: true, ignored: true, event, action: payload.action });
  }

  const repository =
    payload.repository?.full_name ?? payload.blocking_issue_repo?.full_name;
  if (!repository) {
    return res.status(400).json({ error: "Payload sem repository.full_name" });
  }

  if (event === "issue_dependencies") {
    res.json({
      ok: true,
      accepted: true,
      kind: "issue_dependency",
      repository,
      action: payload.action,
      blocked: payload.blocked_issue?.number,
      blocking: payload.blocking_issue?.number,
    });
    void scheduleDependencyUpdate(repository, payload).catch((error) => {
      console.error(
        `[bug-issue-webhook] falha dependency ${repository}:`,
        error instanceof Error ? error.message : error,
      );
    });
    return;
  }

  if (event === "issues") {
    const issueNumber = payload.issue?.number;
    if (!issueNumber) {
      return res.status(400).json({ error: "Payload sem issue.number" });
    }
    res.json({
      ok: true,
      accepted: true,
      kind: "issue",
      repository,
      issueNumber,
      event,
      action: payload.action,
    });
    void scheduleIssueUpdate(repository, payload).catch((error) => {
      console.error(
        `[bug-issue-webhook] falha ${repository}#${issueNumber}:`,
        error instanceof Error ? error.message : error,
      );
    });
    return;
  }

  if (event === "issue_comment") {
    const issueNumber = payload.issue?.number;
    if (!issueNumber) {
      return res.status(400).json({ error: "Payload sem issue.number" });
    }
    res.json({
      ok: true,
      accepted: true,
      kind: "issue_comment",
      repository,
      issueNumber,
      event,
      action: payload.action,
    });
    void scheduleIssueCommentUpdate(repository, payload).catch((error) => {
      console.error(
        `[bug-issue-webhook] falha comment ${repository}#${issueNumber}:`,
        error instanceof Error ? error.message : error,
      );
    });
    return;
  }

  const prNumber = payload.pull_request?.number;
  if (!prNumber) {
    return res.status(400).json({ error: "Payload sem repository/pull_request.number" });
  }

  // Responde rápido (limite GitHub ~10s); o trabalho pesado (gh) roda com debounce.
  res.json({ ok: true, accepted: true, kind: "pr", repository, prNumber, event, action: payload.action });
  void schedulePrUpdate(repository, prNumber).catch((error) => {
    console.error(
      `[kb-webhook] falha ao sincronizar ${repository}#${prNumber}:`,
      error instanceof Error ? error.message : error,
    );
  });
});
