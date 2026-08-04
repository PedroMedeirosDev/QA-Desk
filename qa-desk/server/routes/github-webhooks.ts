import { createHmac, timingSafeEqual } from "node:crypto";
import { Router, type Request, type Response } from "express";
import {
  readKbCurationCatalog,
  writeKbCurationCatalog,
} from "../kb-curation.js";
import { syncSingleKbPullRequest } from "../github/kb-pull-requests.js";
import { PROJECTS, type ProjectSlug } from "../types.js";

type RequestWithRawBody = Request & { rawBody?: Buffer };

const debounceMs = Number(process.env.GITHUB_WEBHOOK_DEBOUNCE_MS ?? 1500);
const pending = new Map<string, NodeJS.Timeout>();

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

async function findProjectByRepository(
  fullName: string,
): Promise<{ project: ProjectSlug; repository: string } | null> {
  const normalized = fullName.toLowerCase();
  for (const project of PROJECTS) {
    const catalog = await readKbCurationCatalog(project.slug);
    if (catalog.meta.repository?.toLowerCase() === normalized) {
      return { project: project.slug, repository: catalog.meta.repository };
    }
  }
  return null;
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
  return false;
}

async function applyPrUpdate(repository: string, prNumber: number) {
  const match = await findProjectByRepository(repository);
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
  const key = `${repository}#${prNumber}`;
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
  let payload: {
    action?: string;
    repository?: { full_name?: string };
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

  const repository = payload.repository?.full_name;
  const prNumber = payload.pull_request?.number;
  if (!repository || !prNumber) {
    return res.status(400).json({ error: "Payload sem repository/pull_request.number" });
  }

  // Responde rápido (limite GitHub ~10s); o trabalho pesado (gh) roda com debounce.
  res.json({ ok: true, accepted: true, repository, prNumber, event, action: payload.action });
  void schedulePrUpdate(repository, prNumber).catch((error) => {
    console.error(
      `[kb-webhook] falha ao sincronizar ${repository}#${prNumber}:`,
      error instanceof Error ? error.message : error,
    );
  });
});
