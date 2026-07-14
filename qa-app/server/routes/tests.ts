import { Router, type Request } from "express";
import multer from "multer";
import path from "node:path";
import { v4 as uuid } from "uuid";
import {
  appendHistory,
  assertProject,
  nextTestId,
  readCatalog,
  uploadsDir,
  writeCatalog,
} from "../storage.js";
import { deriveTestKey, findByTestKey } from "../test-key.js";
import { CURRENT_USER } from "../config/user.js";
import type { EvidenceFile, ProjectSlug, TestRecord } from "../types.js";

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

testsRouter.get("/", (req, res) => {
  const project = assertProject(param(req, "slug"));
  res.json(readCatalog(project));
});

testsRouter.get("/:id", (req, res) => {
  const project = assertProject(param(req, "slug"));
  const test = readCatalog(project).reports.find((r) => r.id === param(req, "id"));
  if (!test) return res.status(404).json({ error: "Teste não encontrado" });
  res.json(test);
});

testsRouter.post("/", (req, res) => {
  const project = assertProject(param(req, "slug"));
  const catalog = readCatalog(project);
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
  const id = nextTestId(project, catalog);
  const now = new Date().toISOString();
  const report: TestRecord = {
    id,
    testKey,
    recordType,
    title: body.title.trim(),
    description: body.description?.trim() ?? "",
    preconditions: body.preconditions?.trim(),
    steps: body.steps?.filter(Boolean) ?? [],
    expectedResult: body.expectedResult?.trim(),
    actualResult: body.actualResult?.trim(),
    reportedAt: now.slice(0, 10),
    project,
    channel: body.channel ?? (project === "polygonus" ? "app" : undefined),
    platform: body.platform ?? "web",
    module: body.module?.trim(),
    status: body.status ?? "rascunho",
    homologationStatus: recordType === "teste" ? (body.homologationStatus ?? "pendente") : undefined,
    executionMode: body.automation?.flowPath ? "automated" : (body.executionMode ?? "manual"),
    priority: body.priority,
    severity: body.severity,
    build: body.build?.trim(),
    evidence: [],
    comments: [],
    history: [],
    showInPortfolio: body.showInPortfolio ?? false,
    automation: body.automation,
    campaign: body.campaign?.trim(),
    tags: body.tags ?? [],
  };

  appendHistory(report, {
    actor: CURRENT_USER.actor,
    action: "test_created",
    detail: recordType === "teste" ? "Caso de teste criado" : "Bug registrado",
    meta: testKey ? { testKey } : undefined,
  });

  catalog.reports.unshift(report);
  writeCatalog(project, catalog);
  res.status(201).json(report);
});

testsRouter.put("/:id", (req, res) => {
  const project = assertProject(param(req, "slug"));
  const catalog = readCatalog(project);
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
  };

  if (body.status && body.status !== prev.status && updated.recordType === "bug") {
    appendHistory(updated, {
      actor: CURRENT_USER.actor,
      action: "status_changed",
      detail: `${prev.status} → ${body.status}`,
      meta: { previousStatus: prev.status, newStatus: body.status },
    });
  } else if (body.homologationStatus && body.homologationStatus !== prev.homologationStatus) {
    appendHistory(updated, {
      actor: CURRENT_USER.actor,
      action: "homologation_changed",
      detail: `${prev.homologationStatus ?? "pendente"} → ${body.homologationStatus}`,
    });
  } else {
    appendHistory(updated, {
      actor: CURRENT_USER.actor,
      action: "updated",
      detail: "Campos atualizados",
    });
  }

  if (body.homologationStatus === "homologado" && prev.homologationStatus !== "homologado") {
    updated.homologatedAt = new Date().toISOString();
    appendHistory(updated, {
      actor: CURRENT_USER.actor,
      action: "homologated",
      detail: "Homologação manual confirmada",
    });
  }

  if (body.status === "homologado" && prev.status !== "homologado" && updated.recordType === "bug") {
    updated.homologatedAt = new Date().toISOString();
    appendHistory(updated, {
      actor: CURRENT_USER.actor,
      action: "homologated",
      detail: "Homologação manual confirmada (bug)",
    });
  }

  catalog.reports[idx] = updated;
  writeCatalog(project, catalog);
  res.json(updated);
});

testsRouter.post("/:id/evidence", upload.single("file"), (req, res) => {
  const project = assertProject(param(req, "slug"));
  const catalog = readCatalog(project);
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
    actor: CURRENT_USER.actor,
    action: "evidence_uploaded",
    detail: req.file.originalname,
  });

  catalog.reports[idx] = report;
  writeCatalog(project, catalog);
  res.status(201).json(evidence);
});
