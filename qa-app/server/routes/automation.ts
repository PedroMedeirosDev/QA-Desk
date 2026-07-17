import { Router, type Response } from "express";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  appendHistory,
  assertProject,
  nextTestId,
  readCatalog,
  uploadsDir,
  writeCatalog,
} from "../storage.js";
import type { EvidenceFile } from "../types.js";
import {
  createMuralHomologationRecords,
  listMaestroFlows,
  needsMuralIdPipeline,
  runMaestroFlowWithMuralCardId,
} from "../automation.js";
import { captureMuralCardId } from "../mural-card-id.js";
import { MURAL_HOMOLOGATION_SLUG } from "../homologation-config.js";
import {
  computeHomologationProgress,
  findHomologationBySlug,
  linkTestsToHomologation,
  readHomologationCatalog,
  resolveHomologationForTest,
  writeHomologationCatalog,
} from "../homologations.js";
import {
  cancelMaestroRun,
  clearMaestroRunCancelled,
  getActiveMaestroRun,
} from "../maestro-run-registry.js";
import {
  appendRunSessionOutput,
  clearRunSession,
  getRunSession,
  markRunSessionPersisted,
  persistCancelledRunSession,
  registerRunSession,
} from "../maestro-run-session.js";
import {
  deriveTestKey,
  findByTestKey,
  nextRunNumber,
  testKeyFromFlow,
  applyAutomationReadinessAfterRun,
} from "../test-key.js";
import { normalizeMaestroOutput } from "../maestro-output.js";
import {
  ensureAndroidDeviceReady,
  getAndroidDeviceStatus,
  isAutoEmulatorEnabled,
  startAndroidEmulator,
  waitForAndroidDevice,
} from "../android-device.js";
import { CURRENT_USER } from "../config/user.js";
import { recordTestRun } from "../db/test-runs.js";
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

automationRouter.get("/device", async (_req, res) => {
  try {
    res.json(await getAndroidDeviceStatus());
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erro ao consultar device",
    });
  }
});

automationRouter.get("/mural-card-id", (req, res) => {
  if (process.env.QA_AUTOMATION_RUN !== "1") {
    return res.status(403).json({
      error: "Automação local desabilitada. Defina QA_AUTOMATION_RUN=1 no .env",
    });
  }

  const rawIndex = typeof req.query.index === "string" ? req.query.index : "0";
  const index = Number.parseInt(rawIndex, 10);

  try {
    const idComunicado = captureMuralCardId(Number.isFinite(index) ? index : 0);
    if (!idComunicado) {
      return res.status(404).json({
        error: "ID do card não encontrado (confira filtro Enviadas e lista visível).",
      });
    }
    res.json({ idComunicado, index: Number.isFinite(index) ? index : 0 });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erro ao capturar ID do card",
    });
  }
});

automationRouter.post("/emulator/start", async (req, res) => {
  if (process.env.QA_AUTOMATION_RUN !== "1") {
    return res.status(403).json({
      error: "Automação local desabilitada. Defina QA_AUTOMATION_RUN=1 no .env",
    });
  }

  const wait = req.query.wait === "1";

  try {
    const start = await startAndroidEmulator();
    if (!wait) {
      return res.json(start);
    }

    const status = await waitForAndroidDevice({ timeoutMs: 180_000 });
    res.json({ ...start, ready: status.ready, status });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Falha ao iniciar emulador",
    });
  }
});

automationRouter.post("/mural-checklist", async (req, res) => {
  const project = assertProject(param(req, "slug"));
  if (project !== "polygonus") {
    return res.status(400).json({ error: "Checklist Mural só para polygonus" });
  }

  const homCatalog = await readHomologationCatalog(project);
  const mural = findHomologationBySlug(homCatalog, MURAL_HOMOLOGATION_SLUG)!;
  const catalog = await readCatalog(project);
  const created: TestRecord[] = [];
  const skipped: string[] = [];

  for (const draft of createMuralHomologationRecords(project)) {
    const { _sort, ...body } = draft as typeof draft & { _sort: number };
    const testKey = testKeyFromFlow(body.automation!.flowPath);
    const existing = findByTestKey(catalog, testKey);

    if (existing) {
      existing.homologationId = mural.id;
      existing.campaign = MURAL_HOMOLOGATION_SLUG;
      // Catálogo canônico → descrição / pré-condições / resultado esperado / passos
      existing.title = body.title ?? existing.title;
      existing.description = body.description ?? existing.description;
      existing.preconditions = body.preconditions ?? existing.preconditions;
      existing.expectedResult = body.expectedResult ?? existing.expectedResult;
      if (body.steps?.length) existing.steps = body.steps;
      skipped.push(existing.id);
      appendHistory(existing, {
        actor: "system",
        action: "checklist_synced",
        detail: `Checklist sincronizado — campos do CT atualizados (${mural.title})`,
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
      preconditions: body.preconditions,
      expectedResult: body.expectedResult,
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
  await writeCatalog(project, catalog);
  await writeHomologationCatalog(project, homCatalog);

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

automationRouter.post("/runs/cancel", async (req, res) => {
  if (process.env.QA_AUTOMATION_RUN !== "1") {
    return res.status(403).json({
      error: "Execução local desabilitada. Defina QA_AUTOMATION_RUN=1 no .env",
    });
  }

  const body = (req.body ?? {}) as { runId?: string };
  const active = getActiveMaestroRun();
  const cancelled = cancelMaestroRun(body.runId);
  const persisted = body.runId
    ? (
        await persistCancelledRunSession(
          body.runId,
          "\n[qa-app] Execução cancelada pelo usuário.\n",
        )
      ).persisted
    : false;
  res.json({
    cancelled: cancelled || Boolean(body.runId),
    persisted,
    active: active
      ? { runId: active.runId, testId: active.testId, flowPath: active.flowPath }
      : null,
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
  const body = (req.body ?? {}) as {
    homologationId?: string;
    recordVideo?: boolean;
  };
  const recordVideo = Boolean(body.recordVideo);
  const catalog = await readCatalog(project);
  const idx = catalog.reports.findIndex((r) => r.id === testId);
  if (idx < 0) return res.status(404).json({ error: "Teste não encontrado" });

  const report = catalog.reports[idx];
  if (!report.automation?.flowPath) {
    return res.status(400).json({ error: "Nenhuma automação vinculada" });
  }

  const stream =
    req.query.stream === "1" ||
    String(req.headers.accept ?? "").includes("application/x-ndjson");

  const homologation = await resolveHomologationForTest(project, report, body.homologationId);
  const runNumber = nextRunNumber(report.history);
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  const outputTail = (text: string, max = 6000) => text.slice(-max);

  registerRunSession({
    runId,
    project,
    testId: report.id,
    runNumber,
    startedAt,
    flowPath: report.automation.flowPath,
    homologationId: homologation?.id,
    homologationSlug: homologation?.slug,
    homologationTitle: homologation?.title,
  });

  const {
    createLineSplitter,
    interpretMaestroLine,
    labelForFlowPath,
  } = await import("../maestro-progress.js");

  const send = (obj: unknown) => {
    if (!stream) return;
    res.write(`${JSON.stringify(obj)}\n`);
    const flush = (res as Response & { flush?: () => void }).flush;
    flush?.();
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
      runId,
      project,
      flowPath: report.automation!.flowPath,
      phase: labelForFlowPath(report.automation.flowPath),
    });
    send({ type: "log", line: "Iniciando Maestro (CLI)…" });
    appendRunSessionOutput(runId, "Iniciando Maestro (CLI)…\n");
  }

  try {
    await ensureAndroidDeviceReady({
      autoStart: isAutoEmulatorEnabled(),
      onProgress: (message) => {
        if (stream) {
          appendRunSessionOutput(runId, `${message}\n`);
          send({ type: "progress", phase: message, status: "running" });
          send({ type: "log", line: message });
        }
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Device Android indisponível";
    if (stream) {
      send({ type: "error", message });
      return res.end();
    }
    return res.status(503).json({ error: message });
  }

  if (stream) {
    send({
      type: "progress",
      phase: labelForFlowPath(report.automation.flowPath),
      action: report.automation.flowPath.split("/").pop(),
      flowFile: report.automation.flowPath.split("/").pop(),
      status: "running",
    });
  }

  let lastOutputAt = Date.now();
  const heartbeat = stream
    ? setInterval(() => {
        const idleMs = Date.now() - lastOutputAt;
        if (idleMs >= 20_000) {
          send({
            type: "heartbeat",
            idleMs,
            phase:
              idleMs >= 120_000
                ? "Maestro sem saída há 2+ min — pode estar travado"
                : "Maestro em execução (aguardando saída)…",
          });
        }
      }, 15_000)
    : null;

  const splitter = createLineSplitter((line) => {
    lastOutputAt = Date.now();
    const normalized = normalizeMaestroOutput(line);
    appendRunSessionOutput(runId, `${normalized}\n`);
    send({ type: "log", line: normalized });
    const info = interpretMaestroLine(line);
    if (info?.phase || info?.action || info?.flowFile) {
      send({
        type: "progress",
        phase: info.phase,
        action: info.action,
        flowFile: info.flowFile,
        status: info.status,
      });
    }
  });

  if (needsMuralIdPipeline(report.automation.flowPath)) {
    const pipelineMsg =
      "[qa-app] Pipeline ID ativo (pré-ação editar/excluir OU pós-envio assert/responsável)";
    appendRunSessionOutput(runId, `${pipelineMsg}\n`);
    send({ type: "log", line: pipelineMsg });
    send({
      type: "progress",
      phase: "Pipeline ID (adb + Maestro)",
      status: "running",
    });
  }

  let screenRec: Awaited<
    ReturnType<typeof import("../screen-record.js").startAdbScreenRecord>
  > | null = null;
  let videoPaths: string[] = [];
  let videoNote = "";

  if (recordVideo) {
    const { startAdbScreenRecord } = await import("../screen-record.js");
    const videoDir = path.join(uploadsDir(project, report.id), "runs", runId);
    send({ type: "log", line: "[qa-app] Gravação de vídeo (adb screenrecord) iniciada…" });
    appendRunSessionOutput(runId, "[qa-app] Gravação de vídeo iniciada…\n");
    try {
      screenRec = startAdbScreenRecord({
        localDir: videoDir,
        onLog: (line) => {
          appendRunSessionOutput(runId, `${line}\n`);
          send({ type: "log", line });
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      send({
        type: "log",
        line: `[qa-app] Não foi possível iniciar screenrecord: ${msg}`,
      });
    }
  }

  let result;
  try {
    result = await runMaestroFlowWithMuralCardId(report.automation.flowPath, {
      onOutput: (chunk) => splitter.push(chunk),
      runMeta: { runId, project, testId: report.id },
    });
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    clearMaestroRunCancelled(runId);
    if (screenRec) {
      try {
        const stopped = await screenRec.stop();
        videoPaths = stopped.localPaths;
        videoNote = stopped.note;
        send({ type: "log", line: `[qa-app] ${videoNote}` });
        appendRunSessionOutput(runId, `[qa-app] ${videoNote}\n`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send({
          type: "log",
          line: `[qa-app] Falha ao finalizar vídeo: ${msg}`,
        });
      }
    }
  }
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
    const homCatalog = await readHomologationCatalog(project);
    const idxHom = homCatalog.homologations.findIndex((h) => h.id === homologation.id);
    if (idxHom >= 0) {
      homCatalog.homologations[idxHom] = {
        ...homCatalog.homologations[idxHom],
        build: result.appVersion,
      };
      await writeHomologationCatalog(project, homCatalog);
    }
  }

  report.automation = {
    ...report.automation,
    lastRunAt: new Date().toISOString(),
    lastRunStatus: result.cancelled
      ? "cancelled"
      : result.ok
        ? "success"
        : "failed",
    lastRunOutput: output,
  };

  if (report.recordType !== "bug" && !result.cancelled) {
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

  const alreadyPersisted = getRunSession(runId)?.persisted ?? false;

  const videoEvidence: EvidenceFile[] = [];
  for (const localPath of videoPaths) {
    try {
      const filename = path.basename(localPath);
      const destDir = uploadsDir(project, report.id);
      const destName = `${runId.slice(0, 8)}_${filename}`;
      const destPath = path.join(destDir, destName);
      if (path.resolve(localPath) !== path.resolve(destPath)) {
        fs.copyFileSync(localPath, destPath);
      }
      const st = fs.statSync(destPath);
      videoEvidence.push({
        fileId: randomUUID(),
        type: "video",
        filename: destName,
        mimeType: "video/mp4",
        sizeBytes: st.size,
        uploadedAt: new Date().toISOString(),
        storageKey: `uploads/${project}/${report.id}/${destName}`,
      });
    } catch {
      /* ignore copy errors */
    }
  }
  if (videoEvidence.length) {
    report.evidence = [...(report.evidence ?? []), ...videoEvidence];
  }

  if (!alreadyPersisted) {
    appendHistory(report, {
      at: startedAt,
      actor: CURRENT_USER.actor,
      action: "test_run",
      detail: [
        result.cancelled ? "Cancelado pelo usuário" : undefined,
        homologation ? `Homologação: ${homologation.title}` : undefined,
        result.appVersion ? `App ${result.appVersion}` : undefined,
        failureDetail,
        recordVideo
          ? videoEvidence.length
            ? `Vídeo: ${videoEvidence.length} arquivo(s)`
            : videoNote || "Vídeo solicitado"
          : undefined,
      ]
        .filter(Boolean)
        .join(" · "),
      meta: {
        runNumber,
        runId,
        result: result.cancelled ? "cancelled" : result.ok ? "success" : "failed",
        exitCode: result.exitCode,
        via: "maestro",
        flowPath: report.automation!.flowPath,
        output,
        appVersion: result.appVersion,
        homologationId: homologation?.id,
        homologationSlug: homologation?.slug,
        failedAction: failure?.failedAction,
        failedFlow: failure?.failedFlow,
        failedStepIndex: failure?.failedStepIndex,
        failedStepLabel: failure?.failedStepLabel,
        errorSummary: failure?.errorSummary,
        recordVideo,
        videoFiles: videoEvidence.map((e) => e.storageKey),
      },
    });
    markRunSessionPersisted(runId);
  } else {
    const fresh = await readCatalog(project);
    const updated = fresh.reports.find((r) => r.id === testId);
    if (updated) Object.assign(report, updated);
  }

  if (report.automation && !alreadyPersisted) {
    const promoted = applyAutomationReadinessAfterRun(report.automation, report.history);
    if (promoted) {
      appendHistory(report, {
        actor: CURRENT_USER.actor,
        action: "automation_passed",
        detail: "Flow promovido para pronto (2 execuções com sucesso no emulador)",
        meta: { readiness: "ready", via: "maestro" },
      });
    }
  }

  if (!alreadyPersisted) {
    catalog.reports[idx] = report;
    await writeCatalog(project, catalog);
    await recordTestRun({
      project,
      testId: report.id,
      runId,
      runNumber,
      status: result.cancelled ? "cancelled" : result.ok ? "success" : "failed",
      exitCode: result.exitCode,
      flowPath: report.automation?.flowPath,
      output,
      appVersion: result.appVersion,
      homologationId: homologation?.id,
      startedAt,
      meta: {
        via: "maestro",
        failedAction: failure?.failedAction,
        failedFlow: failure?.failedFlow,
        failedStepIndex: failure?.failedStepIndex,
        failedStepLabel: failure?.failedStepLabel,
        errorSummary: failure?.errorSummary,
        recordVideo,
      },
      evidencePaths: videoEvidence.map((e) => e.storageKey),
    });
  }

  clearRunSession(runId);

  const { analyzeMaestroOutputAsync } = await import("../maestro-run-analysis.js");
  analyzeMaestroOutputAsync(result.output, {
    testId: report.id,
    flowPath: report.automation.flowPath,
    runNumber,
    ok: result.ok,
  });

  const payload = {
    ok: result.ok,
    exitCode: result.exitCode,
    runNumber,
    runId,
    cancelled: result.cancelled,
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
