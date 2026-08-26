import { Router, type Request, type Response } from "express";
import multer from "multer";
import path from "node:path";
import { v4 as uuid } from "uuid";
import {
  appendHistory,
  assertProject,
  nextTestId,
  nextBugId,
  nextBugCode,
  readCatalog,
  writeCatalog,
} from "../storage.js";
import {
  makeStoredEvidenceFilename,
  uploadEvidenceBuffer,
  deleteEvidenceObject,
} from "../supabase-storage.js";
import { deriveTestKey, findByTestKey } from "../test-key.js";
import { fixUtf8Mojibake } from "../utf8-mojibake.js";
import {
  actorOf,
  attachUser,
  filterPortfolioReports,
  isVisitor,
  rejectVisitorMutations,
  requireAdmin,
} from "../middleware/auth.js";
import {
  sanitizeVisitorCatalog,
  sanitizeVisitorTestRecord,
} from "../privacy/sanitize-visitor.js";
import type { EvidenceFile, TestRecord } from "../types.js";
import { emitGestorReplyFromReport } from "../gestor-replies-sse.js";
import {
  CT_DRAFT_EXAMPLE,
  CT_FIELDS_LLM_SYSTEM_PROMPT,
  normalizeCtFields,
  type CtDraftFields,
} from "../../src/lib/ct-field-contract.js";

function param(req: Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : (v ?? "");
}

function wantsNdjson(req: Request): boolean {
  return (
    req.query.stream === "1" ||
    String(req.headers.accept ?? "").includes("application/x-ndjson")
  );
}

function startNdjson(res: Response): (obj: unknown) => void {
  res.status(200);
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  return (obj: unknown) => {
    res.write(`${JSON.stringify(obj)}\n`);
    (res as Response & { flush?: () => void }).flush?.();
  };
}

/** Prints + vídeos de tela (gravidade / repro). */
const EVIDENCE_MAX_BYTES = 50 * 1024 * 1024;
const EVIDENCE_IMAGE_MIME = /^image\/(png|jpe?g|webp)$/i;
const EVIDENCE_VIDEO_MIME =
  /^video\/(mp4|webm|quicktime|x-msvideo|x-matroska|3gpp)$/i;
const EVIDENCE_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".mp4",
  ".webm",
  ".mov",
  ".mkv",
  ".avi",
  ".3gp",
]);

function isAllowedEvidenceFile(file: Express.Multer.File): boolean {
  if (EVIDENCE_IMAGE_MIME.test(file.mimetype)) return true;
  if (EVIDENCE_VIDEO_MIME.test(file.mimetype)) return true;
  const ext = path.extname(file.originalname || "").toLowerCase();
  return EVIDENCE_EXTS.has(ext);
}

function evidenceTypeFromUpload(
  mimeType: string,
  originalName: string,
): EvidenceFile["type"] {
  if (EVIDENCE_VIDEO_MIME.test(mimeType)) return "video";
  const ext = path.extname(originalName || "").toLowerCase();
  if ([".mp4", ".webm", ".mov", ".mkv", ".avi", ".3gp"].includes(ext)) {
    return "video";
  }
  if (EVIDENCE_IMAGE_MIME.test(mimeType) || [".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
    return "screenshot";
  }
  return "log";
}

/** Atualiza metadados (ex.: purpose) sem permitir inventar arquivos novos. */
function mergeEvidenceMeta(
  prev: EvidenceFile[] | undefined,
  incoming: EvidenceFile[] | undefined,
): EvidenceFile[] | undefined {
  if (incoming === undefined) return prev;
  const byId = new Map((prev ?? []).map((ev) => [ev.fileId, ev]));
  const merged: EvidenceFile[] = [];
  for (const item of incoming) {
    const existing = byId.get(item.fileId);
    if (!existing) continue;
    merged.push({
      ...existing,
      purpose: item.purpose ?? existing.purpose,
      label: item.label ?? existing.label,
    });
    byId.delete(item.fileId);
  }
  // Mantém evidências que o cliente omitiu (não usa o body para apagar — DELETE dedicado).
  for (const leftover of byId.values()) merged.push(leftover);
  return merged;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: EVIDENCE_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (isAllowedEvidenceFile(file)) cb(null, true);
    else cb(new Error("Apenas PNG, JPG, WebP ou vídeo (MP4, WebM, MOV…)"));
  },
});

export const testsRouter = Router({ mergeParams: true });

testsRouter.use(attachUser);
testsRouter.use(rejectVisitorMutations);

testsRouter.get("/", async (req, res) => {
  const project = assertProject(param(req, "slug"));
  const catalog = await readCatalog(project);
  if (isVisitor(req)) {
    // showInPortfolio é hardcoded no backend — nunca ler de query/body
    const filtered = {
      ...catalog,
      reports: filterPortfolioReports(catalog.reports, true),
    };
    return res.json(sanitizeVisitorCatalog(filtered));
  }
  res.json(catalog);
});

/**
 * Normaliza rascunho de CT (IA / N8N / corretor).
 * Move "Pré-requisito:" da description → preconditions; valida campos vazios.
 */
testsRouter.post("/normalize-fields", requireAdmin, (req, res) => {
  assertProject(param(req, "slug"));
  const body = (req.body ?? {}) as CtDraftFields;
  const result = normalizeCtFields(body);
  res.json({
    ...result,
    meta: {
      example: CT_DRAFT_EXAMPLE,
      llmSystemPrompt: CT_FIELDS_LLM_SYSTEM_PROMPT,
      schemaPath:
        "projects/polygonus/automation/n8n/ct-draft.schema.json",
    },
  });
});

testsRouter.get("/:id", async (req, res) => {
  const project = assertProject(param(req, "slug"));
  const test = (await readCatalog(project)).reports.find((r) => r.id === param(req, "id"));
  if (!test) return res.status(404).json({ error: "Teste não encontrado" });
  if (isVisitor(req)) {
    if (!test.showInPortfolio) {
      return res.status(404).json({ error: "Teste não encontrado" });
    }
    return res.json(sanitizeVisitorTestRecord(test));
  }
  res.json(test);
});

/** Marca o último comentário do gestor como lido (some o “não lido”). */
testsRouter.post("/:id/gestor-comment/seen", requireAdmin, async (req, res) => {
  const project = assertProject(param(req, "slug"));
  const catalog = await readCatalog(project);
  const testId = param(req, "id");
  const idx = catalog.reports.findIndex((r) => r.id === testId);
  if (idx < 0) return res.status(404).json({ error: "Teste não encontrado" });

  const report = catalog.reports[idx];
  if (!report.githubIssueLastCommentAt) {
    return res.json(report);
  }
  if (report.githubIssueLastCommentSeenAt === report.githubIssueLastCommentAt) {
    return res.json(report);
  }

  report.githubIssueLastCommentSeenAt = report.githubIssueLastCommentAt;
  catalog.reports[idx] = report;
  await writeCatalog(project, catalog);
  res.json(report);
});

testsRouter.post("/", requireAdmin, async (req, res) => {
  const project = assertProject(param(req, "slug"));
  const catalog = await readCatalog(project);
  const body = req.body as Partial<TestRecord>;

  if (!body.title?.trim()) {
    return res.status(400).json({ error: "Título obrigatório" });
  }

  const testKey = deriveTestKey(body);
  if (testKey) {
    const dup = findByTestKey(catalog, testKey);
    if (dup) {
      return res.status(409).json({
        error: "Já existe um registro para este teste",
        existingId: dup.id,
        testKey,
        hint: "Abra o teste existente e use Executar — o histórico acumula lá.",
      });
    }
  }

  const recordType = body.recordType ?? (body.campaign ? "teste" : "bug");
  const id = recordType === "bug" ? nextBugId(project, catalog) : nextTestId(project, catalog);
  const channel = body.channel ?? (project === "polygonus" ? "app" : undefined);
  const platform = body.platform ?? "web";
  const now = new Date().toISOString();
  const report: TestRecord = {
    id,
    testKey,
    recordType,
    title: body.title.trim(),
    description: body.description?.trim() ?? "",
    preconditions: body.preconditions?.trim(),
    steps: body.steps?.filter(Boolean) ?? [],
    stepsDetailed: body.stepsDetailed,
    expectedResult: body.expectedResult?.trim(),
    actualResult: body.actualResult?.trim(),
    reportedAt: now.slice(0, 10),
    project,
    channel,
    platform,
    module: body.module?.trim(),
    status: body.status ?? "rascunho",
    homologationStatus: recordType === "teste" ? (body.homologationStatus ?? "pendente") : undefined,
    executionMode: body.automation?.flowPath ? "automated" : (body.executionMode ?? "manual"),
    priority: body.priority,
    severity: body.severity ?? (recordType === "bug" ? "media" : undefined),
    build: body.build?.trim(),
    osVersion: body.osVersion?.trim(),
    deviceLabel: body.deviceLabel?.trim(),
    browser: body.browser?.trim(),
    testLogin: body.testLogin?.trim(),
    bugCode:
      recordType === "bug"
        ? body.bugCode?.trim() || nextBugCode(catalog, channel, platform)
        : undefined,
    technicalEvidence: body.technicalEvidence?.trim(),
    evidence: [],
    comments: [],
    history: [],
    showInPortfolio: body.showInPortfolio ?? false,
    automation: body.automation,
    campaign: body.campaign?.trim(),
    tags: body.tags ?? [],
  };

  appendHistory(report, {
    actor: actorOf(req),
    action: "test_created",
    detail: recordType === "teste" ? "Caso de teste criado" : "Bug registrado",
    meta: testKey ? { testKey } : undefined,
  });

  catalog.reports.unshift(report);
  await writeCatalog(project, catalog);
  res.status(201).json(report);
});

testsRouter.put("/:id", requireAdmin, async (req, res) => {
  const project = assertProject(param(req, "slug"));
  const catalog = await readCatalog(project);
  const testId = param(req, "id");
  const idx = catalog.reports.findIndex((r) => r.id === testId);
  if (idx < 0) return res.status(404).json({ error: "Teste não encontrado" });

  const prev = catalog.reports[idx];
  const body = req.body as Partial<TestRecord>;
  const updated: TestRecord = {
    ...prev,
    ...body,
    id: prev.id,
    project,
    history: prev.history,
    evidence: mergeEvidenceMeta(prev.evidence, body.evidence),
    automation: body.automation ?? prev.automation,
    testKey: prev.testKey ?? deriveTestKey({ ...prev, ...body }),
    recordType: body.recordType ?? prev.recordType,
    campaign: body.campaign ?? prev.campaign,
    comments: body.comments ?? prev.comments,
    executionMode: (body.automation ?? prev.automation)?.flowPath ? "automated" : "manual",
    bugCode: prev.bugCode, // código público imutável após criação
    githubIssueLastCommentAt: prev.githubIssueLastCommentAt,
    githubIssueLastCommentBy: prev.githubIssueLastCommentBy,
    githubIssueLastCommentBody: prev.githubIssueLastCommentBody,
    githubIssueLastCommentUrl: prev.githubIssueLastCommentUrl,
    githubIssueLastCommentSeenAt: prev.githubIssueLastCommentSeenAt,
  };

  const asBug =
    (updated.recordType ?? (updated.campaign ? "teste" : "bug")) === "bug";
  if (asBug && !updated.bugCode?.trim()) {
    updated.bugCode = nextBugCode(
      catalog,
      updated.channel,
      updated.platform,
    );
  }

  if (body.status && body.status !== prev.status && updated.recordType === "bug") {
    appendHistory(updated, {
      actor: actorOf(req),
      action: "status_changed",
      detail: `${prev.status} → ${body.status}`,
      meta: { previousStatus: prev.status, newStatus: body.status },
    });
  } else if (body.homologationStatus && body.homologationStatus !== prev.homologationStatus) {
    appendHistory(updated, {
      actor: actorOf(req),
      action: "homologation_changed",
      detail: `${prev.homologationStatus ?? "pendente"} → ${body.homologationStatus}`,
    });
  } else {
    appendHistory(updated, {
      actor: actorOf(req),
      action: "updated",
      detail: "Campos atualizados",
    });
  }

  if (body.homologationStatus === "homologado" && prev.homologationStatus !== "homologado") {
    updated.homologatedAt = new Date().toISOString();
    appendHistory(updated, {
      actor: actorOf(req),
      action: "homologated",
      detail: "Homologação manual confirmada",
    });
  }

  if (body.status === "homologado" && prev.status !== "homologado" && updated.recordType === "bug") {
    updated.homologatedAt = new Date().toISOString();
    appendHistory(updated, {
      actor: actorOf(req),
      action: "homologated",
      detail: "Homologação manual confirmada (bug)",
    });
    if (updated.discordMessageId) {
      void import("../discord-bot.js")
        .then(({ reactQaHomologatedOnDiscord }) =>
          reactQaHomologatedOnDiscord({
            messageId: updated.discordMessageId!,
            channelId: updated.discordChannelId,
          }),
        )
        .catch((err) => {
          console.warn(
            "[discord-bot] 💯 pós-homologação:",
            err instanceof Error ? err.message : err,
          );
        });
    }
  }

  catalog.reports[idx] = updated;
  await writeCatalog(project, catalog);
  res.json(updated);
});

testsRouter.post(
  "/:id/evidence",
  requireAdmin,
  (req, res, next) => {
    upload.single("file")(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            error: `Arquivo acima de ${Math.round(EVIDENCE_MAX_BYTES / (1024 * 1024))} MB`,
          });
        }
        return res.status(400).json({ error: err.message });
      }
      if (err) {
        return res.status(400).json({
          error: err instanceof Error ? err.message : "Arquivo inválido",
        });
      }
      next();
    });
  },
  async (req, res) => {
  const project = assertProject(param(req, "slug"));
  const catalog = await readCatalog(project);
  const testId = param(req, "id");
  const idx = catalog.reports.findIndex((r) => r.id === testId);
  if (idx < 0) return res.status(404).json({ error: "Teste não encontrado" });
  if (!req.file?.buffer) return res.status(400).json({ error: "Arquivo obrigatório" });

  const originalName = fixUtf8Mojibake(req.file.originalname || "arquivo");
  const fileId = uuid();
  const storedFilename = makeStoredEvidenceFilename(originalName, fileId);
  let storageKey: string;
  try {
    const uploaded = await uploadEvidenceBuffer({
      project,
      testId,
      buffer: req.file.buffer,
      originalName,
      mimeType: req.file.mimetype,
      storedFilename,
    });
    storageKey = uploaded.storageKey;
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return res.status(status).json({
      error: err instanceof Error ? err.message : "Falha no upload",
    });
  }

  const evidence: EvidenceFile = {
    fileId,
    type: evidenceTypeFromUpload(req.file.mimetype, originalName),
    filename: originalName,
    mimeType: req.file.mimetype,
    sizeBytes: req.file.size,
    uploadedAt: new Date().toISOString(),
    storageKey,
  };

  const report = catalog.reports[idx];
  report.evidence = [...(report.evidence ?? []), evidence];
  appendHistory(report, {
    actor: actorOf(req),
    action: "evidence_uploaded",
    detail: originalName,
  });

  catalog.reports[idx] = report;
  await writeCatalog(project, catalog);
  res.status(201).json(evidence);
  },
);

testsRouter.delete("/:id/evidence/:fileId", requireAdmin, async (req, res) => {
  const project = assertProject(param(req, "slug"));
  const catalog = await readCatalog(project);
  const testId = param(req, "id");
  const fileId = param(req, "fileId");
  const idx = catalog.reports.findIndex((r) => r.id === testId);
  if (idx < 0) return res.status(404).json({ error: "Teste não encontrado" });

  const report = catalog.reports[idx];
  const current = report.evidence ?? [];
  const ev = current.find((e) => e.fileId === fileId);
  if (!ev) return res.status(404).json({ error: "Evidência não encontrada" });

  report.evidence = current.filter((e) => e.fileId !== fileId);
  appendHistory(report, {
    actor: actorOf(req),
    action: "evidence_removed",
    detail: ev.filename,
  });
  catalog.reports[idx] = report;
  await writeCatalog(project, catalog);

  try {
    await deleteEvidenceObject(ev.storageKey);
  } catch (err) {
    console.warn(
      "[evidence] catálogo atualizado, arquivo residual:",
      err instanceof Error ? err.message : err,
    );
  }

  res.json(report);
});

/**
 * Abre GitHub Issue no repo KB (label bug) — handoff oficial ao time / agente.
 * Se já existir issue vinculada, devolve a existente (não duplica).
 */
testsRouter.post("/:id/github-issue", requireAdmin, async (req, res) => {
  const project = assertProject(param(req, "slug"));
  const catalog = await readCatalog(project);
  const testId = param(req, "id");
  const idx = catalog.reports.findIndex((r) => r.id === testId);
  if (idx < 0) return res.status(404).json({ error: "Teste não encontrado" });

  const report = catalog.reports[idx];
  const isBug =
    (report.recordType ?? (report.campaign ? "teste" : "bug")) === "bug";
  if (!isBug) {
    return res.status(400).json({ error: "Só bugs podem abrir issue no GitHub" });
  }

  try {
    const stream = wantsNdjson(req);
    const send = stream ? startNdjson(res) : null;
    const { createBugGithubIssue } = await import("../github/create-bug-issue.js");
    const alreadyLinked = Boolean(report.githubIssueNumber && report.githubIssueUrl);
    const result = await createBugGithubIssue(report, send ?? undefined);

    if (!alreadyLinked) {
      report.githubIssueNumber = result.number;
      report.githubIssueUrl = result.url;
      report.githubIssueCreatedAt = new Date().toISOString();
      if (
        report.status !== "enviado_gestor" &&
        report.status !== "em_tratamento" &&
        report.status !== "corrigido_gestor" &&
        report.status !== "sem_correcao" &&
        report.status !== "cancelado" &&
        report.status !== "homologado"
      ) {
        report.status = "enviado_gestor";
      }
      appendHistory(report, {
        actor: actorOf(req),
        action: "github_issue_created",
        detail: `#${result.number} · ${result.repository}`,
        meta: {
          githubIssueNumber: result.number,
          githubIssueUrl: result.url,
          repository: result.repository,
          title: result.title,
          evidenceUploaded: result.evidenceUploaded,
          evidenceSkipped: result.evidenceSkipped,
        },
      });
      catalog.reports[idx] = report;
      await writeCatalog(project, catalog);
    }

    const payload = {
      ok: true as const,
      alreadyLinked,
      number: result.number,
      url: result.url,
      title: result.title,
      repository: result.repository,
      evidenceUploaded: result.evidenceUploaded,
      evidenceSkipped: result.evidenceSkipped,
      report,
    };
    if (send) {
      send({ type: "done", ...payload });
      res.end();
      return;
    }
    res.json(payload);
  } catch (e) {
    const err = e as Error & { status?: number };
    const status = err.status && err.status >= 400 ? err.status : 500;
    const error = err.message || "Falha ao abrir issue";
    if (res.headersSent) {
      res.write(`${JSON.stringify({ type: "error", error })}\n`);
      res.end();
      return;
    }
    res.status(status).json({ error });
  }
});

/**
 * Sincroniza issue GitHub já vinculada (título + body + evidências).
 * Use após editar o bug no Desk — não cria issue nova.
 */
testsRouter.post("/:id/github-issue/sync", requireAdmin, async (req, res) => {
  const project = assertProject(param(req, "slug"));
  const catalog = await readCatalog(project);
  const testId = param(req, "id");
  const idx = catalog.reports.findIndex((r) => r.id === testId);
  if (idx < 0) return res.status(404).json({ error: "Teste não encontrado" });

  const report = catalog.reports[idx];
  const isBug =
    (report.recordType ?? (report.campaign ? "teste" : "bug")) === "bug";
  if (!isBug) {
    return res.status(400).json({ error: "Só bugs podem sincronizar issue no GitHub" });
  }
  if (!report.githubIssueNumber || !report.githubIssueUrl) {
    return res.status(400).json({
      error: "Bug sem issue vinculada — use Abrir issue GitHub primeiro",
    });
  }

  try {
    const stream = wantsNdjson(req);
    const send = stream ? startNdjson(res) : null;
    const { updateBugGithubIssue } = await import("../github/create-bug-issue.js");
    const { pullGestorCommentsIntoReport } = await import(
      "../github/sync-bug-issue.js"
    );
    const result = await updateBugGithubIssue(report, send ?? undefined);

    send?.({
      type: "progress",
      phase: "comments",
      message: "Buscando comentários do gestor…",
    });
    const catchup = await pullGestorCommentsIntoReport(report, {
      actor: actorOf(req),
    });

    appendHistory(report, {
      actor: actorOf(req),
      action: "github_issue_synced",
      detail: `#${result.number} · ${result.repository}`,
      meta: {
        githubIssueNumber: result.number,
        githubIssueUrl: result.url,
        repository: result.repository,
        title: result.title,
        evidenceUploaded: result.evidenceUploaded,
        evidenceSkipped: result.evidenceSkipped,
        commentCatchup: catchup.applied,
        commentAuthor: catchup.commentAuthor ?? null,
      },
    });
    catalog.reports[idx] = report;
    await writeCatalog(project, catalog);
    if (catchup.applied) {
      emitGestorReplyFromReport(project, report, "catchup");
    }

    const payload = {
      ok: true as const,
      number: result.number,
      url: result.url,
      title: result.title,
      repository: result.repository,
      evidenceUploaded: result.evidenceUploaded,
      evidenceSkipped: result.evidenceSkipped,
      commentCatchup: catchup,
      report,
    };
    if (send) {
      send({ type: "done", ...payload });
      res.end();
      return;
    }
    res.json(payload);
  } catch (e) {
    const err = e as Error & { status?: number };
    const status = err.status && err.status >= 400 ? err.status : 500;
    const error = err.message || "Falha ao sincronizar issue";
    if (res.headersSent) {
      res.write(`${JSON.stringify({ type: "error", error })}\n`);
      res.end();
      return;
    }
    res.status(status).json({ error });
  }
});

/**
 * Fecha a issue GitHub vinculada (gh issue close) e alinha status no Desk.
 * Body opcional: `{ comment?: string }` — comentário de homologação na issue.
 */
testsRouter.post("/:id/github-issue/close", requireAdmin, async (req, res) => {
  const project = assertProject(param(req, "slug"));
  const catalog = await readCatalog(project);
  const testId = param(req, "id");
  const idx = catalog.reports.findIndex((r) => r.id === testId);
  if (idx < 0) return res.status(404).json({ error: "Teste não encontrado" });

  const report = catalog.reports[idx];
  const isBug =
    (report.recordType ?? (report.campaign ? "teste" : "bug")) === "bug";
  if (!isBug) {
    return res.status(400).json({ error: "Só bugs podem fechar issue no GitHub" });
  }
  if (!report.githubIssueNumber || !report.githubIssueUrl) {
    return res.status(400).json({
      error: "Bug sem issue vinculada — use Abrir issue GitHub primeiro",
    });
  }

  try {
    const { closeBugGithubIssue } = await import("../github/close-bug-issue.js");
    const comment =
      typeof req.body?.comment === "string" ? req.body.comment : "";
    const result = await closeBugGithubIssue(report, { comment });

    report.githubIssueClosedAt = new Date().toISOString();
    const prev = report.status;
    const protectedStatus = new Set([
      "homologado",
      "arquivado",
      "nao_reproduzido",
    ]);
    if (!protectedStatus.has(prev)) {
      report.status = "corrigido_gestor";
    }

    const commentNote = result.commentPosted ? " · comentário na issue" : "";
    appendHistory(report, {
      actor: actorOf(req),
      action: "github_issue_closed_from_desk",
      detail: result.alreadyClosed
        ? `#${result.number} já estava fechada no GH · Desk → ${report.status}${commentNote}`
        : `#${result.number} fechada no GH · Desk → ${report.status}${commentNote}`,
      meta: {
        githubIssueNumber: result.number,
        githubIssueUrl: result.url,
        repository: result.repository,
        alreadyClosed: result.alreadyClosed,
        commentPosted: result.commentPosted,
        fromStatus: prev,
        toStatus: report.status,
      },
    });

    catalog.reports[idx] = report;
    await writeCatalog(project, catalog);

    res.json({
      ok: true,
      number: result.number,
      url: result.url,
      repository: result.repository,
      alreadyClosed: result.alreadyClosed,
      commentPosted: result.commentPosted,
      report,
    });
  } catch (e) {
    const err = e as Error & { status?: number };
    const status = err.status && err.status >= 400 ? err.status : 500;
    res.status(status).json({ error: err.message || "Falha ao fechar issue" });
  }
});

/**
 * Envia report Discord (legado — handoff oficial é GitHub Issue).
 * Mantido na API; UI não expõe mais o botão.
 */
testsRouter.post("/:id/discord-send", requireAdmin, async (req, res) => {
  const project = assertProject(param(req, "slug"));
  const catalog = await readCatalog(project);
  const testId = param(req, "id");
  const idx = catalog.reports.findIndex((r) => r.id === testId);
  if (idx < 0) return res.status(404).json({ error: "Teste não encontrado" });

  const report = catalog.reports[idx];
  try {
    const { sendBugReportToDiscord } = await import("../discord-send.js");
    const result = await sendBugReportToDiscord(report);

    const isBug =
      (report.recordType ?? (report.campaign ? "teste" : "bug")) === "bug";
    if (
      isBug &&
      report.status !== "enviado_gestor" &&
      report.status !== "em_tratamento" &&
      report.status !== "corrigido_gestor" &&
      report.status !== "sem_correcao" &&
      report.status !== "cancelado" &&
      report.status !== "homologado"
    ) {
      report.status = "enviado_gestor";
    }
    if (result.messageId) {
      report.discordMessageId = result.messageId;
      report.discordChannelId = result.channelId;
      report.discordSentAt = new Date().toISOString();
    }
    appendHistory(report, {
      actor: actorOf(req),
      action: "discord_sent",
      detail: [
        `via ${result.via}`,
        result.attached.length
          ? `${result.attached.length} anexo(s)`
          : "só texto",
        result.skipped.length ? `${result.skipped.length} pulado(s)` : undefined,
        result.truncatedContent ? "texto truncado" : undefined,
        result.messageId ? `msg ${result.messageId}` : undefined,
      ]
        .filter(Boolean)
        .join(" · "),
      meta: {
        via: result.via,
        attached: result.attached,
        skipped: result.skipped,
        truncatedContent: result.truncatedContent,
        discordMessageId: result.messageId,
        discordChannelId: result.channelId,
      },
    });

    catalog.reports[idx] = report;
    await writeCatalog(project, catalog);
    const { ok: _ok, ...payload } = result;
    res.json({ ok: true, report, ...payload });
  } catch (e) {
    const err = e as Error & { status?: number };
    const status = err.status && err.status >= 400 ? err.status : 500;
    res.status(status).json({ error: err.message || "Falha ao enviar Discord" });
  }
});
