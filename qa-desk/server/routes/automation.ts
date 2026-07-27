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
  maestroIdleTimeoutMs,
  muralDomainTestKey,
  needsMuralIdPipeline,
  runMaestroFlowWithMuralCardId,
} from "../automation.js";
import { captureMuralCardId } from "../mural-card-id.js";
import {
  MURAL_HOMOLOGATION_SLUG,
  muralLegacyFlowTestKey,
  muralTestKeys,
} from "../homologation-config.js";
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
  forceKillMaestroProcesses,
  getActiveMaestroRun,
  markMaestroRunCancelled,
  wasMaestroRunCancelled,
} from "../maestro-run-registry.js";
import {
  cancelPlaywrightRun,
  listPlaywrightSpecs,
  runPlaywrightSpec,
} from "../playwright-run.js";
import {
  hasMaestroAutomation,
  hasPlaywrightAutomation,
  parseAutomationRunner,
  type AutomationRunner,
} from "../automation-runners.js";
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
  applyAutomationReadinessAfterRun,
} from "../test-key.js";
import { normalizeMaestroOutput } from "../maestro-output.js";
import { redactPii } from "../privacy/redact-pii.js";
import {
  dismissAndroidSystemOverlays,
  ensureAndroidDeviceReady,
  ensureEmulatorTimezoneBr,
  ensureMaestroFixturesOnDevice,
  getAndroidDeviceStatus,
  isAutoEmulatorEnabled,
  startAndroidEmulator,
  waitForAndroidDevice,
} from "../android-device.js";
import { actorOf, attachUser, requireAdmin } from "../middleware/auth.js";
import { recordTestRun } from "../db/test-runs.js";
import type { TestRecord } from "../types.js";
import {
  agentTokenConfigured,
  cancelAgentJobByRunId,
  enqueueAgentJob,
  getAgentPresence,
  isAgentOnline,
  waitForAgentJob,
} from "../agent-jobs.js";

function localAutomationEnabled(): boolean {
  return process.env.QA_AUTOMATION_RUN === "1";
}

function agentRemoteUnavailableMessage(): string {
  if (!agentTokenConfigured()) {
    return "Automação remota não configurada. Defina QA_AGENT_TOKEN no servidor ou QA_AUTOMATION_RUN=1 no PC.";
  }
  if (!isAgentOnline()) {
    return "Agente offline. No PC, rode: npm run agent (com QA_DESK_URL e QA_AGENT_TOKEN).";
  }
  return "Agente indisponível";
}

function param(req: { params: Record<string, string | string[] | undefined> }, key: string) {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : (v ?? "");
}

export const automationRouter = Router({ mergeParams: true });

automationRouter.use(attachUser);
automationRouter.use(requireAdmin);

automationRouter.get("/flows", (req, res) => {
  const module = typeof req.query.module === "string" ? req.query.module : undefined;
  res.json(listMaestroFlows(module));
});

automationRouter.get("/specs", (req, res) => {
  const module = typeof req.query.module === "string" ? req.query.module : undefined;
  res.json(listPlaywrightSpecs(module));
});

automationRouter.get("/device", async (_req, res) => {
  if (!localAutomationEnabled()) {
    const agent = getAgentPresence();
    return res.json({
      ready: false,
      devices: [],
      avdName: process.env.QA_AVD_NAME?.trim() || "Medium_Phone",
      booting: false,
      message: agent.online
        ? `Agente online${agent.hostname ? ` (${agent.hostname})` : ""} — use Ligar emulador`
        : agentTokenConfigured()
          ? "Agente offline — inicie npm run agent no PC"
          : "Sem execução local nem agente (QA_AGENT_TOKEN)",
      agentOnline: agent.online,
      agentHostname: agent.hostname,
    });
  }

  try {
    res.json(await getAndroidDeviceStatus());
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erro ao consultar device",
    });
  }
});

automationRouter.get("/mural-card-id", (req, res) => {
  if (!localAutomationEnabled()) {
    return res.status(403).json({
      error:
        "Captura de ID do card só no PC com QA_AUTOMATION_RUN=1 (não via agente).",
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
  const wait = req.query.wait === "1";

  if (!localAutomationEnabled()) {
    if (!isAgentOnline()) {
      return res.status(503).json({ error: agentRemoteUnavailableMessage() });
    }

    const job = enqueueAgentJob({
      kind: "start_emulator",
      wait,
    });

    if (!wait) {
      return res.json({
        started: true,
        message: "Pedido enviado ao agente no PC",
        jobId: job.id,
      });
    }

    try {
      const finished = await waitForAgentJob(job.id, {
        timeoutMs: 200_000,
      });
      if (finished.status === "cancelled") {
        return res.status(499).json({ error: "Pedido de emulador cancelado" });
      }
      if (finished.status !== "done") {
        return res.status(500).json({
          error:
            finished.error ||
            finished.log.slice(-500) ||
            "Falha ao iniciar emulador no agente",
        });
      }
      return res.json({
        started: true,
        ready: true,
        message: finished.log.trim() || "Emulador pronto no PC do agente",
        jobId: job.id,
      });
    } catch (err) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : "Falha aguardando agente",
      });
    }
  }

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
    const flowPath = body.automation!.flowPath;
    const testKey =
      body.testKey ??
      (body.automation?.label
        ? muralDomainTestKey(String(body.automation.label))
        : muralLegacyFlowTestKey(flowPath));
    const legacyKey = muralLegacyFlowTestKey(flowPath);
    const existing =
      findByTestKey(catalog, testKey) ??
      findByTestKey(catalog, legacyKey) ??
      catalog.reports.find(
        (r) =>
          r.automation?.flowPath?.replace(/\\/g, "/") === flowPath.replace(/\\/g, "/"),
      );

    if (existing) {
      const prevKey = existing.testKey;
      existing.testKey = testKey;
      existing.homologationId = mural.id;
      existing.campaign = MURAL_HOMOLOGATION_SLUG;
      // Catálogo canônico → descrição / pré-condições / resultado esperado / passos
      existing.title = body.title ?? existing.title;
      existing.description = body.description ?? existing.description;
      existing.preconditions = body.preconditions ?? existing.preconditions;
      existing.expectedResult = body.expectedResult ?? existing.expectedResult;
      if (body.steps?.length) existing.steps = body.steps;
      if (body.tags?.length) existing.tags = body.tags;
      if (body.automation?.label) {
        existing.automation = {
          ...existing.automation!,
          label: body.automation.label,
          flowPath: existing.automation?.flowPath ?? flowPath,
          type: existing.automation?.type ?? "maestro",
        };
      }
      skipped.push(existing.id);
      appendHistory(existing, {
        actor: "system",
        action: "checklist_synced",
        detail:
          prevKey && prevKey !== testKey
            ? `Checklist sincronizado — testKey ${prevKey} → ${testKey}`
            : `Checklist sincronizado — campos do CT atualizados (${mural.title})`,
        meta: {
          homologationId: mural.id,
          homologationSlug: mural.slug,
          testKey,
          previousTestKey: prevKey,
        },
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

  mural.testKeys = muralTestKeys();
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
  const body = (req.body ?? {}) as { runId?: string };

  if (!localAutomationEnabled()) {
    const cancelledAgent = body.runId
      ? cancelAgentJobByRunId(body.runId)
      : false;
    if (body.runId) markMaestroRunCancelled(body.runId);
    const persisted = body.runId
      ? (
          await persistCancelledRunSession(
            body.runId,
            "\n[qa-desk] Execução cancelada pelo usuário (agente).\n",
          )
        ).persisted
      : false;
    return res.json({
      cancelled: cancelledAgent || Boolean(body.runId),
      persisted,
      via: "agent",
      active: null,
    });
  }

  if (body.runId) markMaestroRunCancelled(body.runId);
  const active = getActiveMaestroRun();
  const cancelledPw = cancelPlaywrightRun(body.runId);
  const cancelled = cancelMaestroRun(body.runId) || cancelledPw;
  const persisted = body.runId
    ? (
        await persistCancelledRunSession(
          body.runId,
          "\n[qa-desk] Execução cancelada pelo usuário.\n",
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
  const localRun = localAutomationEnabled();
  if (!localRun && !isAgentOnline()) {
    return res.status(503).json({ error: agentRemoteUnavailableMessage() });
  }

  const project = assertProject(param(req, "slug"));
  const testId = param(req, "id");
  const body = (req.body ?? {}) as {
    homologationId?: string;
    recordVideo?: boolean;
    stage?: "all" | "prep" | "maestro";
    runner?: AutomationRunner;
  };
  const recordVideo = Boolean(body.recordVideo);
  const runner = parseAutomationRunner(body.runner, "maestro");
  const stage: "all" | "prep" | "maestro" =
    body.stage === "prep" || body.stage === "maestro" ? body.stage : "all";
  const catalog = await readCatalog(project);
  const idx = catalog.reports.findIndex((r) => r.id === testId);
  if (idx < 0) return res.status(404).json({ error: "Teste não encontrado" });

  const report = catalog.reports[idx];
  const pwTarget = report.automation?.playwright;
  const hasMaestro = hasMaestroAutomation(report.automation);
  const hasPlaywright = hasPlaywrightAutomation(report.automation);

  if (runner === "playwright") {
    if (!hasPlaywright || !pwTarget?.specPath) {
      return res.status(400).json({
        error: "Nenhum spec Playwright vinculado (automation.playwright)",
      });
    }
  } else if (!hasMaestro) {
    return res.status(400).json({ error: "Nenhuma automação Maestro vinculada" });
  }

  const prep = report.automation?.prep;
  if (runner === "maestro" && stage === "prep" && (!prep || prep.type !== "playwright")) {
    return res.status(400).json({
      error: "Este teste não tem seed Playwright (automation.prep)",
    });
  }

  const wantPrep =
    runner === "maestro" &&
    (stage === "all" || stage === "prep") &&
    prep?.type === "playwright";
  const wantMaestro = runner === "maestro" && (stage === "all" || stage === "maestro");
  const wantPlaywrightOnly = runner === "playwright";

  const stream =
    req.query.stream === "1" ||
    String(req.headers.accept ?? "").includes("application/x-ndjson");

  const homologation = await resolveHomologationForTest(project, report, body.homologationId);
  const runNumber = nextRunNumber(report.history);
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  const outputTail = (text: string, max = 6000) => text.slice(-max);
  const sessionPath =
    wantPlaywrightOnly && pwTarget
      ? pwTarget.specPath
      : (report.automation?.flowPath ?? pwTarget?.specPath ?? "");

  registerRunSession({
    runId,
    project,
    testId: report.id,
    runNumber,
    startedAt,
    flowPath: sessionPath,
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
    let payload = obj;
    if (
      payload &&
      typeof payload === "object" &&
      "type" in payload &&
      (payload as { type?: string }).type === "log" &&
      "line" in payload &&
      typeof (payload as { line?: unknown }).line === "string"
    ) {
      payload = {
        ...(payload as object),
        line: redactPii((payload as { line: string }).line),
      };
    }
    res.write(`${JSON.stringify(payload)}\n`);
    const flush = (res as Response & { flush?: () => void }).flush;
    flush?.();
  };

  if (stream) {
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();
    const startPhase = wantPlaywrightOnly
      ? "Playwright (Web)…"
      : wantPrep
        ? "Playwright (seed)…"
        : labelForFlowPath(report.automation!.flowPath!);
    send({
      type: "start",
      testId: report.id,
      title: report.title,
      runNumber,
      runId,
      project,
      flowPath: sessionPath,
      stage,
      runner,
      phase: startPhase,
    });
    const startLog = wantPlaywrightOnly
      ? "Iniciando Playwright (Web)…"
      : wantPrep
        ? stage === "prep"
          ? "Iniciando Playwright (seed)…"
          : "Iniciando Playwright → Maestro…"
        : "Iniciando Maestro (CLI)…";
    send({ type: "log", line: startLog });
    appendRunSessionOutput(runId, `${startLog}\n`);
  }

  const stagesRun: string[] = [];
  let combinedOutput = "";
  let prepOk: boolean | undefined;
  let failedStage: "playwright" | "maestro" | undefined;
  let videoPaths: string[] = [];
  let videoNote = "";

  type RunResult = {
    ok: boolean;
    exitCode: number | null;
    output: string;
    cancelled?: boolean;
    appVersion?: string;
    failure?: {
      failedAction?: string;
      failedFlow?: string;
      errorSummary?: string;
      failedStepIndex?: number;
      failedStepLabel?: string;
      failedStepSource?: "steps" | "stepsDetailed";
    };
  };

  let result: RunResult | undefined;

  if (!localRun) {
    const queueMsg =
      "[qa-desk] Enfileirado no agente do PC — aguardando claim…";
    send({ type: "log", line: queueMsg });
    appendRunSessionOutput(runId, `${queueMsg}\n`);
    send({
      type: "progress",
      phase: "Agente remoto",
      action: "Na fila",
      status: "running",
    });

    const job = enqueueAgentJob({
      kind: "run_test",
      project,
      testId: report.id,
      runId,
      runNumber,
      runner,
      stage,
      flowPath: report.automation?.flowPath,
      specPath: pwTarget?.specPath,
      prepSpecPath: prep?.type === "playwright" ? prep.specPath : undefined,
      homologationId: homologation?.id,
      homologationSlug: homologation?.slug,
      homologationTitle: homologation?.title,
      recordVideo,
      startedAt,
    });

    try {
      const finished = await waitForAgentJob(job.id, {
        onLog: (chunk) => {
          appendRunSessionOutput(runId, chunk);
          for (const line of chunk.split(/\r?\n/)) {
            if (!line) continue;
            const normalized = normalizeMaestroOutput(line);
            send({ type: "log", line: normalized });
          }
        },
      });

      if (wantPlaywrightOnly) stagesRun.push("playwright");
      else {
        if (wantPrep) stagesRun.push("playwright");
        if (wantMaestro) stagesRun.push("maestro");
      }

      combinedOutput = finished.log;
      const cancelled = finished.status === "cancelled";
      const ok = finished.status === "done" && finished.exitCode === 0;
      if (!ok && !cancelled) {
        failedStage = wantPlaywrightOnly
          ? "playwright"
          : wantMaestro
            ? "maestro"
            : "playwright";
      }
      result = {
        ok,
        exitCode: finished.exitCode,
        output: combinedOutput,
        cancelled,
        appVersion: finished.appVersion,
        failure:
          ok || cancelled
            ? undefined
            : {
                errorSummary:
                  finished.error ||
                  `Agente finalizou com status ${finished.status} (exit ${finished.exitCode ?? "?"})`,
              },
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Falha aguardando o agente";
      if (stream) {
        send({ type: "error", message });
        clearRunSession(runId);
        return res.end();
      }
      clearRunSession(runId);
      return res.status(503).json({ error: message });
    }
  } else if (wantPlaywrightOnly && pwTarget) {
    send({
      type: "progress",
      phase: "Playwright (Web)",
      action: path.basename(pwTarget.specPath),
      status: "running",
    });
    send({
      type: "log",
      line: `[qa-desk] Playwright Web: ${pwTarget.specPath}${pwTarget.headed === false ? "" : " (headed)"}`,
    });
    appendRunSessionOutput(
      runId,
      `[qa-desk] Playwright Web: ${pwTarget.specPath}\n`,
    );

    const pw = await runPlaywrightSpec(pwTarget.specPath, {
      headed: pwTarget.headed !== false,
      runId,
      onOutput: (chunk) => {
        appendRunSessionOutput(runId, chunk);
        send({ type: "log", line: chunk.replace(/\r?\n$/, "") });
      },
      shouldCancel: () => wasMaestroRunCancelled(runId),
    });
    stagesRun.push("playwright");
    combinedOutput += pw.output;
    result = {
      ok: pw.ok && !pw.cancelled,
      exitCode: pw.exitCode,
      output: combinedOutput,
      cancelled: pw.cancelled,
      failure:
        pw.ok && !pw.cancelled
          ? undefined
          : {
              failedAction: "Playwright Web",
              failedFlow: path.basename(pwTarget.specPath),
              errorSummary: pw.cancelled
                ? "Playwright cancelado"
                : `Playwright falhou (exit ${pw.exitCode ?? "?"})`,
            },
    };
    if (!result.ok) failedStage = "playwright";
  }

  if (wantPrep && prep && !result) {
    send({
      type: "progress",
      phase: "Playwright (seed DN)",
      action: path.basename(prep.specPath),
      status: "running",
    });
    send({
      type: "log",
      line: `[qa-desk] Playwright: ${prep.specPath}${prep.headed === false ? "" : " (headed)"}`,
    });
    appendRunSessionOutput(
      runId,
      `[qa-desk] Playwright: ${prep.specPath}\n`,
    );

    const pw = await runPlaywrightSpec(prep.specPath, {
      headed: prep.headed !== false,
      runId,
      onOutput: (chunk) => {
        appendRunSessionOutput(runId, chunk);
        send({ type: "log", line: chunk.replace(/\r?\n$/, "") });
      },
      shouldCancel: () => wasMaestroRunCancelled(runId),
    });
    stagesRun.push("playwright");
    combinedOutput += pw.output;
    prepOk = pw.ok && !pw.cancelled;

    if (!prepOk) {
      failedStage = "playwright";
      result = {
        ok: false,
        exitCode: pw.exitCode,
        output: combinedOutput,
        cancelled: pw.cancelled,
        failure: {
          failedAction: "Playwright seed",
          failedFlow: path.basename(prep.specPath),
          errorSummary: pw.cancelled
            ? "Playwright cancelado"
            : `Playwright falhou (exit ${pw.exitCode ?? "?"})`,
        },
      };
    } else if (!wantMaestro) {
      result = {
        ok: true,
        exitCode: 0,
        output: combinedOutput,
      };
    }
  }

  if (wantMaestro && !result) {
  const maestroFlowPath = report.automation?.flowPath;
  if (!maestroFlowPath) {
    result = {
      ok: false,
      exitCode: 1,
      output: combinedOutput || "Flow Maestro ausente",
      failure: { errorSummary: "Flow Maestro ausente" },
    };
  } else {
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
    const deviceLog = (message: string) => {
      if (stream) {
        appendRunSessionOutput(runId, `[qa-desk] ${message}\n`);
        send({ type: "log", line: `[qa-desk] ${message}` });
      }
    };
    await ensureEmulatorTimezoneBr({ onProgress: deviceLog });
    await ensureMaestroFixturesOnDevice({ onProgress: deviceLog });
    await dismissAndroidSystemOverlays({ onProgress: deviceLog });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Device Android indisponível";
    if (stream) {
      send({ type: "error", message });
      return res.end();
    }
    return res.status(503).json({ error: message });
  }

  if (wasMaestroRunCancelled(runId)) {
    result = {
      ok: false,
      exitCode: null,
      output: combinedOutput + "\n[qa-desk] Cancelado antes do Maestro.\n",
      cancelled: true,
    };
  } else {

  if (stream) {
    send({
      type: "progress",
      phase: labelForFlowPath(maestroFlowPath),
      action: maestroFlowPath.split("/").pop(),
      flowFile: maestroFlowPath.split("/").pop(),
      status: "running",
    });
    if (wantPrep) {
      send({ type: "log", line: "[qa-desk] Seed OK — iniciando Maestro…" });
      appendRunSessionOutput(runId, "[qa-desk] Seed OK — iniciando Maestro…\n");
    }
  }

  let lastOutputAt = Date.now();
  /** Mesmo limiar do watchdog interno (vídeo/compressão = 15 min). */
  const idleAbortMs = maestroIdleTimeoutMs(maestroFlowPath);
  if (/video|compress/i.test(maestroFlowPath)) {
    const tip = `[qa-desk] CT de vídeo: idle permitido até ${Math.round(idleAbortMs / 1000)}s (compressão sem stdout).`;
    appendRunSessionOutput(runId, `${tip}\n`);
    send({ type: "log", line: tip });
  }
  let idleForceArmed = false;
  const heartbeat = stream
    ? setInterval(() => {
        const idleMs = Date.now() - lastOutputAt;
        if (idleMs >= 10_000) {
          const leftSec = Math.max(0, Math.ceil((idleAbortMs - idleMs) / 1000));
          send({
            type: "heartbeat",
            idleMs,
            phase:
              idleMs >= idleAbortMs - 10_000
                ? `Sem saída — abort automático em ~${leftSec}s (lote segue)`
                : "Maestro em execução (aguardando saída)…",
          });
        }
        // Rede de segurança: se o watchdog interno falhar, mata o Maestro sem marcar cancel do usuário
        if (idleMs >= idleAbortMs + 5_000 && !idleForceArmed) {
          idleForceArmed = true;
          send({
            type: "log",
            line: `[qa-desk] Idle ${Math.round(idleMs / 1000)}s — force-kill Maestro (rede de segurança; lote segue).`,
          });
          forceKillMaestroProcesses();
        }
      }, 2_000)
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

  if (needsMuralIdPipeline(maestroFlowPath)) {
    const pipelineMsg =
      "[qa-desk] Pipeline ID ativo (pré-ação editar/excluir OU pós-envio assert/responsável)";
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

  if (recordVideo) {
    const { startAdbScreenRecord } = await import("../screen-record.js");
    const videoDir = path.join(uploadsDir(project, report.id), "runs", runId);
    send({ type: "log", line: "[qa-desk] Gravação de vídeo (adb screenrecord) iniciada…" });
    appendRunSessionOutput(runId, "[qa-desk] Gravação de vídeo iniciada…\n");
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
        line: `[qa-desk] Não foi possível iniciar screenrecord: ${msg}`,
      });
    }
  }

  let maestroResult;
  try {
    maestroResult = await runMaestroFlowWithMuralCardId(maestroFlowPath, {
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
        send({ type: "log", line: `[qa-desk] ${videoNote}` });
        appendRunSessionOutput(runId, `[qa-desk] ${videoNote}\n`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send({
          type: "log",
          line: `[qa-desk] Falha ao finalizar vídeo: ${msg}`,
        });
      }
    }
  }
  splitter.flush();
  stagesRun.push("maestro");
  combinedOutput += (combinedOutput ? "\n" : "") + maestroResult.output;
  if (!maestroResult.ok) failedStage = "maestro";
  result = {
    ...maestroResult,
    output: combinedOutput,
  };
  } // end !cancelled before maestro
  } // end maestroFlowPath present
  } // end wantMaestro && !result

  if (!result) {
    result = {
      ok: false,
      exitCode: 1,
      output: combinedOutput || "Nada a executar",
      failure: { errorSummary: "Nada a executar para este stage" },
    };
  }

  const output = outputTail(result.output);

  const { enrichFailureWithStep } = await import("../maestro-diagnostics.js");
  const failure =
    !result.ok && result.failure
      ? enrichFailureWithStep(
          result.failure,
          report.steps ?? [],
          report.stepsDetailed,
          report.stepsManual,
        )
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
    ...report.automation!,
    lastRunAt:
      wantPlaywrightOnly
        ? report.automation?.lastRunAt
        : new Date().toISOString(),
    lastRunStatus: wantPlaywrightOnly
      ? report.automation?.lastRunStatus
      : result.cancelled
        ? "cancelled"
        : result.ok
          ? "success"
          : "failed",
    lastRunOutput: wantPlaywrightOnly
      ? report.automation?.lastRunOutput
      : output,
    playwright: wantPlaywrightOnly && pwTarget
      ? {
          ...pwTarget,
          lastRunAt: new Date().toISOString(),
          lastRunStatus: result.cancelled
            ? "cancelled"
            : result.ok
              ? "success"
              : "failed",
          lastRunOutput: output,
        }
      : report.automation?.playwright,
  };

  // Sempre atualiza lastRunAt no nível raiz para ordenação na lista
  if (wantPlaywrightOnly) {
    report.automation.lastRunAt = new Date().toISOString();
    report.automation.lastRunStatus = result.cancelled
      ? "cancelled"
      : result.ok
        ? "success"
        : "failed";
    report.automation.lastRunOutput = output;
  }

  if (report.recordType !== "bug" && !result.cancelled && stage !== "prep") {
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
      actor: actorOf(req),
      action: "test_run",
      detail: [
        result.cancelled ? "Cancelado pelo usuário" : undefined,
        failedStage ? `Stage: ${failedStage}` : undefined,
        stagesRun.length ? `Stages: ${stagesRun.join("→")}` : undefined,
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
        runner,
        via: wantPlaywrightOnly
          ? "playwright"
          : stagesRun.includes("playwright") && stagesRun.includes("maestro")
            ? "playwright+maestro"
            : stagesRun.includes("playwright")
              ? "playwright"
              : "maestro",
        stage,
        stages: stagesRun,
        prepOk,
        failedStage,
        flowPath: sessionPath,
        specPath: wantPlaywrightOnly ? pwTarget?.specPath : undefined,
        output,
        appVersion: result.appVersion,
        homologationId: homologation?.id,
        homologationSlug: homologation?.slug,
        failedAction: failure?.failedAction,
        failedFlow: failure?.failedFlow,
        failedStepIndex: failure?.failedStepIndex,
        failedStepLabel: failure?.failedStepLabel,
        failedStepSource: failure?.failedStepSource,
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

  if (
    report.automation &&
    !alreadyPersisted &&
    stagesRun.includes("maestro") &&
    !wantPlaywrightOnly
  ) {
    const promoted = applyAutomationReadinessAfterRun(report.automation, report.history);
    if (promoted) {
      appendHistory(report, {
        actor: actorOf(req),
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
      flowPath: sessionPath,
      output,
      appVersion: result.appVersion,
      homologationId: homologation?.id,
      startedAt,
      meta: {
        runner,
        via: wantPlaywrightOnly
          ? "playwright"
          : stagesRun.includes("playwright") && stagesRun.includes("maestro")
            ? "playwright+maestro"
            : stagesRun.includes("playwright")
              ? "playwright"
              : "maestro",
        stage,
        stages: stagesRun,
        prepOk,
        failedStage,
        failedAction: failure?.failedAction,
        failedFlow: failure?.failedFlow,
        failedStepIndex: failure?.failedStepIndex,
        failedStepLabel: failure?.failedStepLabel,
        failedStepSource: failure?.failedStepSource,
        errorSummary: failure?.errorSummary,
        recordVideo,
        specPath: wantPlaywrightOnly ? pwTarget?.specPath : undefined,
      },
      evidencePaths: videoEvidence.map((e) => e.storageKey),
    });
  }

  clearRunSession(runId);

  if (stagesRun.includes("maestro") && report.automation?.flowPath) {
    const { analyzeMaestroOutputAsync } = await import("../maestro-run-analysis.js");
    analyzeMaestroOutputAsync(result.output, {
      testId: report.id,
      flowPath: report.automation.flowPath,
      runNumber,
      ok: result.ok,
    });
  }

  const payload = {
    ok: result.ok,
    exitCode: result.exitCode,
    runNumber,
    runId,
    cancelled: result.cancelled,
    output,
    appVersion: result.appVersion,
    failure,
    stage,
    runner,
    stages: stagesRun,
    prepOk,
    failedStage,
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
