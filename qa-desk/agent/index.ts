/**
 * Agente QA Desk — roda no PC com Maestro/Playwright/emulador
 * e atende jobs enfileirados pela API online (QA_AUTOMATION_RUN=0).
 *
 * Env:
 *   QA_DESK_URL      — ex. https://qa-desk-pedro.duckdns.org
 *   QA_AGENT_TOKEN   — mesmo token do servidor
 *   QA_AUTOMATION_RUN=1 (local, para spawn Maestro)
 */
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "../server/load-env.js";
import {
  runMaestroFlowWithMuralCardId,
} from "../server/automation.js";
import { runPlaywrightSpec, cancelPlaywrightRun } from "../server/playwright-run.js";
import {
  dismissAndroidSystemOverlays,
  ensureAndroidDeviceReady,
  ensureEmulatorTimezoneBr,
  ensureMaestroFixturesOnDevice,
  getAndroidDeviceStatus,
  isAutoEmulatorEnabled,
  startAndroidEmulator,
  waitForAndroidDevice,
} from "../server/android-device.js";
import {
  forceKillMaestroProcesses,
  markMaestroRunCancelled,
  wasMaestroRunCancelled,
} from "../server/maestro-run-registry.js";

loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VERSION = "0.1.0";

const BASE = (process.env.QA_DESK_URL ?? "http://127.0.0.1:3001").replace(
  /\/$/,
  "",
);
const TOKEN = process.env.QA_AGENT_TOKEN?.trim() ?? "";
const POLL_MS = Number(process.env.QA_AGENT_POLL_MS ?? 2500);
const HEARTBEAT_MS = Number(process.env.QA_AGENT_HEARTBEAT_MS ?? 10_000);
const FETCH_TIMEOUT_MS = Number(process.env.QA_AGENT_FETCH_TIMEOUT_MS ?? 20_000);

if (!TOKEN) {
  console.error(
    "[agente] Defina QA_AGENT_TOKEN (mesmo valor do servidor online).",
  );
  process.exit(1);
}

if (process.env.QA_AUTOMATION_RUN !== "1") {
  console.warn(
    "[agente] Aviso: QA_AUTOMATION_RUN≠1 — Maestro/emulador locais podem falhar. Defina QA_AUTOMATION_RUN=1 no .env do PC.",
  );
}

type JobPayload =
  | {
      kind: "run_test";
      project: string;
      testId: string;
      runId: string;
      runNumber: number;
      runner: "maestro" | "playwright";
      stage: "all" | "prep" | "maestro";
      flowPath?: string;
      specPath?: string;
      prepSpecPath?: string;
      recordVideo?: boolean;
    }
  | { kind: "start_emulator"; wait?: boolean };

type ClaimedJob = { id: string; payload: JobPayload; createdAt: string };

async function agentFetch(
  pathname: string,
  init?: RequestInit,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(`${BASE}/api/agent${pathname}`, {
      ...init,
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function heartbeat(): Promise<void> {
  let device:
    | {
        ready: boolean;
        booting: boolean;
        message: string;
        primarySerial?: string;
        avdName?: string;
        devices: Array<{ serial: string; state: string; kind: "emulator" | "physical" }>;
      }
    | undefined;
  try {
    const status = await getAndroidDeviceStatus();
    device = {
      ready: status.ready,
      booting: status.booting,
      message: status.message,
      primarySerial: status.primarySerial,
      avdName: status.avdName,
      devices: status.devices,
    };
  } catch (err) {
    device = {
      ready: false,
      booting: false,
      message: err instanceof Error ? err.message : "adb indisponível",
      devices: [],
    };
  }

  const res = await agentFetch("/heartbeat", {
    method: "POST",
    body: JSON.stringify({
      hostname: os.hostname(),
      version: VERSION,
      device,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`heartbeat ${res.status}: ${text}`);
  }
}

async function claimJob(): Promise<ClaimedJob | null> {
  const res = await agentFetch("/jobs/next");
  if (res.status === 204) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`claim ${res.status}: ${text}`);
  }
  return (await res.json()) as ClaimedJob;
}

async function postLog(
  jobId: string,
  chunk: string,
): Promise<{ cancelled: boolean }> {
  const res = await agentFetch(`/jobs/${jobId}/log`, {
    method: "POST",
    body: JSON.stringify({ chunk }),
  });
  if (!res.ok) return { cancelled: false };
  const body = (await res.json()) as { cancelled?: boolean };
  return { cancelled: Boolean(body.cancelled) };
}

async function isCancelled(jobId: string): Promise<boolean> {
  const res = await agentFetch(`/jobs/${jobId}`);
  if (!res.ok) return false;
  const body = (await res.json()) as { cancelled?: boolean; status?: string };
  return Boolean(body.cancelled) || body.status === "cancelled";
}

async function complete(
  jobId: string,
  opts: {
    exitCode: number | null;
    output?: string;
    error?: string;
    appVersion?: string;
    cancelled?: boolean;
  },
): Promise<void> {
  await agentFetch(`/jobs/${jobId}/complete`, {
    method: "POST",
    body: JSON.stringify(opts),
  });
}

function makeLogger(jobId: string) {
  let cancelled = false;
  let buffer = "";
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  const flush = async () => {
    if (!buffer) return;
    const chunk = buffer;
    buffer = "";
    const r = await postLog(jobId, chunk);
    if (r.cancelled) cancelled = true;
  };

  return {
    isCancelled: () => cancelled,
    write: (text: string) => {
      buffer += text;
      if (flushTimer) return;
      flushTimer = setTimeout(() => {
        flushTimer = null;
        void flush();
      }, 400);
    },
    flush,
    markCancelled: () => {
      cancelled = true;
    },
  };
}

async function runStartEmulator(
  jobId: string,
  wait: boolean,
): Promise<void> {
  const log = makeLogger(jobId);
  try {
    log.write("[agente] Iniciando emulador Android…\n");
    const start = await startAndroidEmulator();
    log.write(`${start.message}\n`);
    if (wait) {
      log.write("[agente] Aguardando device ready…\n");
      const status = await waitForAndroidDevice({ timeoutMs: 180_000 });
      log.write(`${status.message}\n`);
      await log.flush();
      if (!status.ready) {
        await complete(jobId, {
          exitCode: 1,
          output: status.message,
          error: status.message,
        });
        return;
      }
    }
    await log.flush();
    await complete(jobId, { exitCode: 0, output: "Emulador pronto" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.write(`[agente] Erro: ${message}\n`);
    await log.flush();
    await complete(jobId, { exitCode: 1, error: message, output: message });
  }
}

async function runTestJob(
  jobId: string,
  payload: Extract<JobPayload, { kind: "run_test" }>,
): Promise<void> {
  const log = makeLogger(jobId);
  const { runId, runner, stage, flowPath, specPath, prepSpecPath } = payload;
  let combined = "";
  let appVersion: string | undefined;

  const onOutput = (chunk: string) => {
    combined += chunk;
    log.write(chunk);
  };

  const shouldCancel = async () => {
    if (log.isCancelled() || wasMaestroRunCancelled(runId)) return true;
    if (await isCancelled(jobId)) {
      log.markCancelled();
      markMaestroRunCancelled(runId);
      forceKillMaestroProcesses();
      cancelPlaywrightRun(runId);
      return true;
    }
    return false;
  };

  const cancelWatcher = setInterval(() => {
    void shouldCancel();
  }, 2000);

  try {
    log.write(
      `[agente] Job run_test ${payload.testId} runner=${runner} stage=${stage}\n`,
    );

    if (runner === "playwright") {
      if (!specPath) throw new Error("specPath ausente no job");
      const pw = await runPlaywrightSpec(specPath, {
        headed: true,
        runId,
        onOutput,
        shouldCancel: () =>
          log.isCancelled() || wasMaestroRunCancelled(runId),
      });
      await log.flush();
      await complete(jobId, {
        exitCode: pw.cancelled ? null : pw.exitCode,
        output: combined || pw.output,
        cancelled: pw.cancelled || log.isCancelled(),
      });
      return;
    }

    const wantPrep =
      (stage === "all" || stage === "prep") && Boolean(prepSpecPath);
    const wantMaestro = stage === "all" || stage === "maestro";

    if (wantPrep && prepSpecPath) {
      log.write(`[agente] Playwright seed: ${prepSpecPath}\n`);
      const pw = await runPlaywrightSpec(prepSpecPath, {
        headed: true,
        runId,
        onOutput,
        shouldCancel: () =>
          log.isCancelled() || wasMaestroRunCancelled(runId),
      });
      if (!pw.ok || pw.cancelled) {
        await log.flush();
        await complete(jobId, {
          exitCode: pw.exitCode,
          output: combined || pw.output,
          cancelled: pw.cancelled || log.isCancelled(),
          error: pw.cancelled ? "Playwright cancelado" : "Playwright seed falhou",
        });
        return;
      }
      if (!wantMaestro) {
        await log.flush();
        await complete(jobId, { exitCode: 0, output: combined });
        return;
      }
    }

    if (wantMaestro) {
      if (!flowPath) throw new Error("flowPath ausente no job");

      await ensureAndroidDeviceReady({
        autoStart: isAutoEmulatorEnabled(),
        onProgress: (message) => onOutput(`${message}\n`),
      });
      await ensureEmulatorTimezoneBr({
        onProgress: (m) => onOutput(`[qa-desk] ${m}\n`),
      });
      await ensureMaestroFixturesOnDevice({
        onProgress: (m) => onOutput(`[qa-desk] ${m}\n`),
      });
      await dismissAndroidSystemOverlays({
        onProgress: (m) => onOutput(`[qa-desk] ${m}\n`),
      });

      if (await shouldCancel()) {
        await log.flush();
        await complete(jobId, {
          exitCode: null,
          output: combined,
          cancelled: true,
        });
        return;
      }

      const maestro = await runMaestroFlowWithMuralCardId(flowPath, {
        onOutput,
        runMeta: {
          runId,
          project: payload.project,
          testId: payload.testId,
        },
      });
      appVersion = maestro.appVersion;
      combined = combined || maestro.output;
      await log.flush();
      await complete(jobId, {
        exitCode: maestro.cancelled ? null : maestro.exitCode,
        output: combined,
        appVersion,
        cancelled: maestro.cancelled || log.isCancelled(),
        error: maestro.ok
          ? undefined
          : maestro.failure?.errorSummary || "Maestro falhou",
      });
      return;
    }

    await log.flush();
    await complete(jobId, {
      exitCode: 1,
      output: combined,
      error: "Nada a executar neste stage",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.write(`[agente] Erro: ${message}\n`);
    await log.flush();
    await complete(jobId, {
      exitCode: 1,
      output: combined || message,
      error: message,
      cancelled: log.isCancelled(),
    });
  } finally {
    clearInterval(cancelWatcher);
  }
}

async function handleJob(job: ClaimedJob): Promise<void> {
  console.log(`[agente] Claim ${job.id} kind=${job.payload.kind}`);
  if (job.payload.kind === "start_emulator") {
    await runStartEmulator(job.id, job.payload.wait !== false);
    return;
  }
  await runTestJob(job.id, job.payload);
}

async function main(): Promise<void> {
  console.log(`[agente] QA Desk agent ${VERSION}`);
  console.log(`[agente] API: ${BASE}`);
  console.log(`[agente] Host: ${os.hostname()}`);
  console.log(`[agente] Root: ${path.resolve(__dirname, "..")}`);
  console.log(
    `[agente] Heartbeat a cada ${HEARTBEAT_MS}ms (timeout fetch ${FETCH_TIMEOUT_MS}ms)`,
  );

  await heartbeat();
  console.log("[agente] Heartbeat OK — aguardando jobs…");

  let heartbeatFails = 0;
  setInterval(() => {
    void heartbeat()
      .then(() => {
        if (heartbeatFails > 0) {
          console.log("[agente] Heartbeat recuperado");
        }
        heartbeatFails = 0;
      })
      .catch((err) => {
        heartbeatFails += 1;
        console.error(
          `[agente] heartbeat falhou (#${heartbeatFails}):`,
          err instanceof Error ? err.message : err,
        );
      });
  }, HEARTBEAT_MS);

  for (;;) {
    try {
      const job = await claimJob();
      if (job) {
        await handleJob(job);
        console.log(`[agente] Job ${job.id} finalizado`);
      }
    } catch (err) {
      console.error(
        "[agente] loop:",
        err instanceof Error ? err.message : err,
      );
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
