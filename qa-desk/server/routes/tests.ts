import { Router, type Request } from "express";
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
  uploadsDir,
  writeCatalog,
} from "../storage.js";
import { deriveTestKey, findByTestKey } from "../test-key.js";
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

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const project = assertProject(param(req, "slug"));
      const testId = param(req, "id");
      cb(null, uploadsDir(project, testId));
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".png";
      cb(null, `${uuid()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(png|jpe?g|webp)$/i.test(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error("Apenas PNG, JPG ou WebP"));
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
    evidence: prev.evidence,
    automation: body.automation ?? prev.automation,
    testKey: prev.testKey ?? deriveTestKey({ ...prev, ...body }),
    recordType: body.recordType ?? prev.recordType,
    campaign: body.campaign ?? prev.campaign,
    comments: body.comments ?? prev.comments,
    executionMode: (body.automation ?? prev.automation)?.flowPath ? "automated" : "manual",
    bugCode: prev.bugCode, // código público imutável após criação
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

testsRouter.post("/:id/evidence", requireAdmin, upload.single("file"), async (req, res) => {
  const project = assertProject(param(req, "slug"));
  const catalog = await readCatalog(project);
  const testId = param(req, "id");
  const idx = catalog.reports.findIndex((r) => r.id === testId);
  if (idx < 0) return res.status(404).json({ error: "Teste não encontrado" });
  if (!req.file) return res.status(400).json({ error: "Arquivo obrigatório" });

  const fileId = uuid();
  const storageKey = `uploads/${project}/${testId}/${req.file.filename}`;
  const evidence: EvidenceFile = {
    fileId,
    type: "screenshot",
    filename: req.file.originalname,
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
    detail: req.file.originalname,
  });

  catalog.reports[idx] = report;
  await writeCatalog(project, catalog);
  res.status(201).json(evidence);
});

/**
 * Envia report Discord (texto + evidências) via bot (preferencial) ou webhook.
 * Bugs: status → enviado_gestor. Clipboard continua como fallback na UI.
 * Com messageId salvo, reação ✅ do gestor → corrigido_gestor (bot).
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
