import { Router } from "express";
import {
  appendHistory,
  assertProject,
  nextTestId,
  readCatalog,
  writeCatalog,
} from "../storage.js";
import {
  createMuralHomologationRecords,
  listMaestroFlows,
  runMaestroFlow,
} from "../automation.js";
import { MURAL_HOMOLOGATION_SLUG } from "../homologation-config.js";
import {
  computeHomologationProgress,
  findHomologationBySlug,
  linkTestsToHomologation,
  readHomologationCatalog,
  resolveHomologationForTest,
  syncMuralHomologation,
  writeHomologationCatalog,
} from "../homologations.js";
import {
  deriveTestKey,
  findByTestKey,
  nextRunNumber,
  testKeyFromFlow,
} from "../test-key.js";
import { CURRENT_USER } from "../config/user.js";
import type { TestRecord } from "../types.js";

function param(req: { params: Record<string, string | string[] | undefined> }, key: string) {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : (v ?? "");
}

export const automationRouter = Router({ mergeParams: true });

automationRouter.get("/flows", (req, res) => {
  const module = typeof req.query.module === "string" ? req.query.module : undefined;
  res.json(listMaestroFlows(module));
});

automationRouter.post("/mural-checklist", (req, res) => {
  const project = assertProject(param(req, "slug"));
  if (project !== "polygonus") {
    return res.status(400).json({ error: "Checklist Mural só para polygonus" });
  }

  const homCatalog = readHomologationCatalog(project);
  const mural = findHomologationBySlug(homCatalog, MURAL_HOMOLOGATION_SLUG)!;
  const catalog = readCatalog(project);
  const created: TestRecord[] = [];
  const skipped: string[] = [];

  for (const draft of createMuralHomologationRecords(project)) {
    const { _sort, ...body } = draft as typeof draft & { _sort: number };
    const testKey = testKeyFromFlow(body.automation!.flowPath);
    const existing = findByTestKey(catalog, testKey);

    if (existing) {
      existing.homologationId = mural.id;
      existing.campaign = MURAL_HOMOLOGATION_SLUG;
      skipped.push(existing.id);
      appendHistory(existing, {
        actor: "system",
        action: "checklist_synced",
        detail: `Checklist sincronizado — vinculado à ${mural.title}`,
        meta: { homologationId: mural.id, homologationSlug: mural.slug },
      });
      continue;
    }

    const id = nextTestId(project, catalog);
    const report: TestRecord = {
      id,
      testKey,
      recordType: "teste",
      title: body.title!,
      description: body.description ?? "",
      steps: body.steps ?? [],
      reportedAt: body.reportedAt!,
      project,
      channel: body.channel ?? "app",
      platform: body.platform ?? "android",
      module: body.module,
      status: body.status ?? "rascunho",
      homologationStatus: "pendente",
      homologationId: mural.id,
      executionMode: "automated",
      priority: body.priority,
      campaign: MURAL_HOMOLOGATION_SLUG,
      automation: body.automation,
      tags: body.tags,
      history: [],
      evidence: [],
      showInPortfolio: false,
    };
    appendHistory(report, {
      actor: "system",
      action: "test_created",
      detail: `Caso de teste criado (${mural.title})`,
      meta: { testKey, homologationId: mural.id, homologationSlug: mural.slug },
    });
    catalog.reports.unshift(report);
    created.push(report);
  }

  linkTestsToHomologation(catalog, mural);
  writeCatalog(project, catalog);
  writeHomologationCatalog(project, homCatalog);

  const progress = computeHomologationProgress(mural, catalog);

  res.status(201).json({
    created: created.length,
    skipped: skipped.length,
    reports: created,
    homologation: mural,
    progress,
    message:
      created.length > 0
        ? `${created.length} novo(s), ${skipped.length} já na homologação`
        : `Checklist completo — ${progress.total} teste(s) no escopo`,
  });
});

automationRouter.post("/tests/:id/run", async (req, res) => {
  if (process.env.QA_AUTOMATION_RUN !== "1") {
    return res.status(403).json({
      error: "Execução local desabilitada. Defina QA_AUTOMATION_RUN=1 no .env",
    });
  }

  const project = assertProject(param(req, "slug"));
  const testId = param(req, "id");
  const body = (req.body ?? {}) as { homologationId?: string };
  const catalog = readCatalog(project);
  const idx = catalog.reports.findIndex((r) => r.id === testId);
  if (idx < 0) return res.status(404).json({ error: "Teste não encontrado" });

  const report = catalog.reports[idx];
  if (!report.automation?.flowPath) {
    return res.status(400).json({ error: "Nenhuma automação vinculada" });
  }

  const stream =
    req.query.stream === "1" ||
    String(req.headers.accept ?? "").includes("application/x-ndjson");

  const homologation = resolveHomologationForTest(project, report, body.homologationId);
  const runNumber = nextRunNumber(report.history);
  const startedAt = new Date().toISOString();
  const outputTail = (text: string, max = 6000) => text.slice(-max);

  const {
    createLineSplitter,
    interpretMaestroLine,
    labelForFlowPath,
  } = await import("../maestro-progress.js");

  const send = (obj: unknown) => {
    if (!stream) return;
    res.write(`${JSON.stringify(obj)}\n`);
  };

  if (stream) {
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();
    send({
      type: "start",
      testId: report.id,
      title: report.title,
      runNumber,
      flowPath: report.automation.flowPath,
      phase: labelForFlowPath(report.automation.flowPath),
    });
    send({ type: "log", line: "Iniciando Maestro (CLI)…" });
    send({
      type: "progress",
      phase: "Aguardando device / Maestro…",
      action: report.automation.flowPath,
      status: "running",
    });
  }

  const splitter = createLineSplitter((line) => {
    send({ type: "log", line });
    const info = interpretMaestroLine(line);
    if (info?.phase || info?.action) {
      send({
        type: "progress",
        phase: info.phase,
        action: info.action,
        status: info.status,
      });
    }
  });

  const result = await runMaestroFlow(report.automation.flowPath, {
    onOutput: (chunk) => splitter.push(chunk),
  });
  splitter.flush();

  const output = outputTail(result.output);

  const { enrichFailureWithStep } = await import("../maestro-diagnostics.js");
  const failure =
    !result.ok && result.failure
      ? enrichFailureWithStep(result.failure, report.steps ?? [])
      : result.failure;

  if (result.appVersion) {
    report.build = result.appVersion;
  }

  if (homologation && result.appVersion) {
    const homCatalog = readHomologationCatalog(project);
    const idxHom = homCatalog.homologations.findIndex((h) => h.id === homologation.id);
    if (idxHom >= 0) {
      homCatalog.homologations[idxHom] = {
        ...homCatalog.homologations[idxHom],
        build: result.appVersion,
      };
      writeHomologationCatalog(project, homCatalog);
    }
  }

  report.automation = {
    ...report.automation,
    lastRunAt: new Date().toISOString(),
    lastRunStatus: result.ok ? "success" : "failed",
    lastRunOutput: output,
  };

  if (report.recordType !== "bug") {
    report.homologationStatus = result.ok ? "passou" : "falhou";
  }

  if (homologation) {
    report.homologationId = homologation.id;
    report.campaign = homologation.slug;
  }

  const failureDetail = failure
    ? [
        failure.failedStepLabel
          ? `Passo: ${failure.failedStepLabel}`
          : undefined,
        failure.failedAction ? `Ação: ${failure.failedAction}` : undefined,
        failure.failedFlow ? `Flow: ${failure.failedFlow}` : undefined,
      ]
        .filter(Boolean)
        .join(" · ")
    : undefined;

  appendHistory(report, {
    at: startedAt,
    actor: CURRENT_USER.actor,
    action: "test_run",
    detail: [
      homologation ? `Homologação: ${homologation.title}` : undefined,
      result.appVersion ? `App ${result.appVersion}` : undefined,
      failureDetail,
    ]
      .filter(Boolean)
      .join(" · "),
    meta: {
      runNumber,
      result: result.ok ? "success" : "failed",
      exitCode: result.exitCode,
      via: "maestro",
      flowPath: report.automation.flowPath,
      output,
      appVersion: result.appVersion,
      homologationId: homologation?.id,
      homologationSlug: homologation?.slug,
      failedAction: failure?.failedAction,
      failedFlow: failure?.failedFlow,
      failedStepIndex: failure?.failedStepIndex,
      failedStepLabel: failure?.failedStepLabel,
      errorSummary: failure?.errorSummary,
    },
  });

  catalog.reports[idx] = report;
  writeCatalog(project, catalog);

  const payload = {
    ok: result.ok,
    exitCode: result.exitCode,
    runNumber,
    output,
    appVersion: result.appVersion,
    failure,
    homologationId: homologation?.id,
    report,
  };

  if (stream) {
    send({ type: "done", ...payload });
    res.end();
    return;
  }

  res.json(payload);
});
