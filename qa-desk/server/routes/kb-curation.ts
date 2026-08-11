import { Router } from "express";
import type {
  KbCurationStatus,
  KbCurationVerdict,
} from "../../src/types/kb-curation.js";
import { syncTrackedKbPullRequests } from "../github/kb-pull-requests.js";
import {
  computeKbCurationMetrics,
  readKbCurationCatalog,
  writeKbCurationCatalog,
} from "../kb-curation.js";
import { subscribeKbCurationSse } from "../kb-curation-sse.js";
import { actorOf, attachUser, forbidVisitor, rejectVisitorMutations, requireAdmin } from "../middleware/auth.js";
import { assertProject } from "../storage.js";

function param(req: { params: Record<string, string | string[] | undefined> }, key: string) {
  const value = req.params[key];
  return Array.isArray(value) ? value[0] : (value ?? "");
}

const VALID_STATUS = new Set<KbCurationStatus>([
  "aguardando_revisao",
  "aguardando_correcao",
  "aguardando_rerevisao",
  "aprovada",
  "mesclada",
  "bloqueada",
  "fechada",
  // legado (aceitamos na API e normalizamos na gravação)
  "pendente",
  "em_revisao",
]);

function normalizeStatus(status: KbCurationStatus): KbCurationStatus {
  if (status === "pendente" || status === "em_revisao") return "aguardando_revisao";
  return status;
}
const VALID_VERDICT = new Set<KbCurationVerdict>([
  "aprovavel",
  "precisa_correcao",
  "bloqueado",
  "inconclusivo",
]);

export const kbCurationRouter = Router({ mergeParams: true });
kbCurationRouter.use(attachUser);
kbCurationRouter.use(rejectVisitorMutations);
kbCurationRouter.use(forbidVisitor);

kbCurationRouter.get("/", async (req, res) => {
  const project = assertProject(param(req, "slug"));
  const catalog = await readKbCurationCatalog(project);
  res.json({
    ...catalog,
    metrics: computeKbCurationMetrics(catalog.pullRequests),
  });
});

kbCurationRouter.put("/:prNumber", requireAdmin, async (req, res) => {
  const project = assertProject(param(req, "slug"));
  const prNumber = Number(param(req, "prNumber"));
  if (!Number.isInteger(prNumber)) {
    return res.status(400).json({ error: "Número do PR inválido" });
  }

  const body = req.body as {
    status?: KbCurationStatus;
    verdict?: KbCurationVerdict;
    summary?: string;
    solutionReview?: string;
    corrections?: string[];
    reviewer?: string;
  };
  if (body.status && !VALID_STATUS.has(body.status)) {
    return res.status(400).json({ error: "Status inválido" });
  }
  if (body.verdict && !VALID_VERDICT.has(body.verdict)) {
    return res.status(400).json({ error: "Veredito inválido" });
  }

  const catalog = await readKbCurationCatalog(project);
  const index = catalog.pullRequests.findIndex((record) => record.prNumber === prNumber);
  if (index < 0) return res.status(404).json({ error: "PR não rastreado" });

  const previous = catalog.pullRequests[index];
  const nextStatus = body.status ? normalizeStatus(body.status) : undefined;
  const reviewedAt = new Date().toISOString();
  const actor = actorOf(req);
  const reviewerFromBody = body.reviewer?.trim();
  const nextReviewer = reviewerFromBody || previous.reviewer || actor;
  const changes: string[] = [];
  if (nextStatus && nextStatus !== previous.status) {
    changes.push(`status ${previous.status} → ${nextStatus}`);
  }
  if (body.verdict && body.verdict !== previous.verdict) {
    changes.push(`veredito ${previous.verdict} → ${body.verdict}`);
  }
  if (body.solutionReview !== undefined && body.solutionReview !== previous.solutionReview) {
    changes.push("parecer da solução atualizado");
  }
  if (body.corrections !== undefined) changes.push("correções atualizadas");
  if (nextReviewer !== previous.reviewer) {
    changes.push(`responsável → ${nextReviewer || "não informado"}`);
  }

  const updated = {
    ...previous,
    ...body,
    status: nextStatus ?? previous.status,
    summary: body.summary?.trim() || previous.summary,
    solutionReview: body.solutionReview?.trim() || previous.solutionReview,
    corrections: body.corrections?.filter(Boolean) ?? previous.corrections,
    reviewer: nextReviewer,
    reviewedAt,
    history: changes.length > 0
      ? [
          ...previous.history,
          {
            at: reviewedAt,
            actor,
            action: "kb_pr_review_updated",
            detail: changes.join(" · "),
          },
        ]
      : previous.history,
  };

  catalog.pullRequests[index] = updated;
  await writeKbCurationCatalog(project, catalog, { sseReason: "review" });
  res.json({
    pullRequest: updated,
    metrics: computeKbCurationMetrics(catalog.pullRequests),
  });
});

kbCurationRouter.get("/stream", (req, res) => {
  const project = assertProject(param(req, "slug"));
  // Conexão longa: desliga timeout do socket.
  req.socket.setTimeout(0);
  res.setTimeout(0);
  subscribeKbCurationSse(project, res);
});

kbCurationRouter.post("/sync", requireAdmin, async (req, res) => {
  const project = assertProject(param(req, "slug"));
  const catalog = await readKbCurationCatalog(project);
  const repository =
    catalog.meta.repository?.trim() ||
    process.env.KB_GITHUB_REPO?.trim() ||
    "polygonus-br/polygonus-suporte-kb";
  try {
    const result = await syncTrackedKbPullRequests(
      repository,
      catalog.pullRequests,
    );
    catalog.pullRequests = result.records;
    catalog.meta.updatedAt = result.at.slice(0, 10);
    await writeKbCurationCatalog(project, catalog, { sseReason: "sync" });
    res.json({
      pullRequests: catalog.pullRequests,
      metrics: computeKbCurationMetrics(catalog.pullRequests),
      synced: result.synced,
      imported: result.imported,
      authorResponses: result.authorResponses,
      lastSyncedAt: result.at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(503).json({
      error: `Não foi possível sincronizar com o GitHub via gh: ${message}`,
    });
  }
});
