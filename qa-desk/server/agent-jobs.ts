import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ProjectSlug } from "./types.js";
import type { AutomationRunner } from "./automation-runners.js";

export type AgentJobKind = "run_test" | "start_emulator";

export type AgentJobStatus =
  | "queued"
  | "running"
  | "done"
  | "failed"
  | "cancelled";

export type AgentRunTestPayload = {
  kind: "run_test";
  project: ProjectSlug;
  testId: string;
  runId: string;
  runNumber: number;
  runner: AutomationRunner;
  stage: "all" | "prep" | "maestro";
  flowPath?: string;
  specPath?: string;
  prepSpecPath?: string;
  homologationId?: string;
  homologationSlug?: string;
  homologationTitle?: string;
  recordVideo?: boolean;
  startedAt: string;
};

export type AgentStartEmulatorPayload = {
  kind: "start_emulator";
  wait?: boolean;
};

export type AgentJobPayload = AgentRunTestPayload | AgentStartEmulatorPayload;

export type AgentJob = {
  id: string;
  status: AgentJobStatus;
  createdAt: string;
  claimedAt?: string;
  finishedAt?: string;
  payload: AgentJobPayload;
  log: string;
  exitCode: number | null;
  error?: string;
  appVersion?: string;
};

/** Snapshot de device enviado no heartbeat do agente (adb no PC). */
export type AgentDeviceSnapshot = {
  ready: boolean;
  booting: boolean;
  message: string;
  primarySerial?: string;
  avdName?: string;
  devices?: Array<{ serial: string; state: string; kind: "emulator" | "physical" }>;
};

export type AgentPresence = {
  lastSeenAt: number;
  hostname?: string;
  version?: string;
  device?: AgentDeviceSnapshot;
};

/** TTL folgado: heartbeat ~10–15s; blips de rede / job longo não pintam offline. */
const AGENT_ONLINE_MS = 120_000;
const MAX_LOG_CHARS = 512_000;

const jobs = new Map<string, AgentJob>();
const queue: string[] = [];
let presence: AgentPresence | null = null;

const PRESENCE_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../data/agent-presence.json",
);

function clipLog(text: string): string {
  if (text.length <= MAX_LOG_CHARS) return text;
  return text.slice(-MAX_LOG_CHARS);
}

function persistPresence(): void {
  if (!presence) return;
  try {
    fs.mkdirSync(path.dirname(PRESENCE_FILE), { recursive: true });
    fs.writeFileSync(PRESENCE_FILE, JSON.stringify(presence), "utf8");
  } catch {
    /* disco cheio / permissão — presença em memória segue */
  }
}

function loadPersistedPresence(): void {
  try {
    if (!fs.existsSync(PRESENCE_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(PRESENCE_FILE, "utf8")) as AgentPresence;
    if (
      typeof raw?.lastSeenAt === "number" &&
      Date.now() - raw.lastSeenAt < AGENT_ONLINE_MS
    ) {
      presence = raw;
    }
  } catch {
    /* ignore */
  }
}

loadPersistedPresence();

export function touchAgent(meta?: {
  hostname?: string;
  version?: string;
  device?: AgentDeviceSnapshot;
}): void {
  presence = {
    lastSeenAt: Date.now(),
    hostname: meta?.hostname ?? presence?.hostname,
    version: meta?.version ?? presence?.version,
    device: meta?.device ?? presence?.device,
  };
  persistPresence();
}

export function isAgentOnline(): boolean {
  if (!presence) return false;
  return Date.now() - presence.lastSeenAt < AGENT_ONLINE_MS;
}

export function getAgentPresence(): {
  online: boolean;
  hostname?: string;
  version?: string;
  lastSeenAt?: string;
  device?: AgentDeviceSnapshot;
} {
  if (!presence) return { online: false };
  return {
    online: isAgentOnline(),
    hostname: presence.hostname,
    version: presence.version,
    lastSeenAt: new Date(presence.lastSeenAt).toISOString(),
    device: presence.device,
  };
}

export function enqueueAgentJob(payload: AgentJobPayload): AgentJob {
  const job: AgentJob = {
    id: randomUUID(),
    status: "queued",
    createdAt: new Date().toISOString(),
    payload,
    log: "",
    exitCode: null,
  };
  jobs.set(job.id, job);
  queue.push(job.id);
  return job;
}

export function getAgentJob(id: string): AgentJob | undefined {
  return jobs.get(id);
}

export function claimNextAgentJob(): AgentJob | null {
  touchAgent();
  while (queue.length > 0) {
    const id = queue.shift()!;
    const job = jobs.get(id);
    if (!job || job.status !== "queued") continue;
    job.status = "running";
    job.claimedAt = new Date().toISOString();
    return job;
  }
  return null;
}

export function appendAgentJobLog(id: string, chunk: string): { ok: boolean; cancelled: boolean } {
  const job = jobs.get(id);
  if (!job) return { ok: false, cancelled: false };
  if (job.status === "cancelled") return { ok: true, cancelled: true };
  if (job.status !== "running" && job.status !== "queued") {
    return { ok: false, cancelled: false };
  }
  job.log = clipLog(job.log + chunk);
  return { ok: true, cancelled: false };
}

export function completeAgentJob(
  id: string,
  opts: {
    exitCode: number | null;
    output?: string;
    error?: string;
    appVersion?: string;
    cancelled?: boolean;
  },
): AgentJob | null {
  const job = jobs.get(id);
  if (!job) return null;
  if (opts.output != null) {
    job.log = clipLog(opts.output);
  }
  job.exitCode = opts.exitCode;
  job.error = opts.error;
  job.appVersion = opts.appVersion;
  job.finishedAt = new Date().toISOString();
  if (opts.cancelled || job.status === "cancelled") {
    job.status = "cancelled";
  } else if (opts.exitCode === 0) {
    job.status = "done";
  } else {
    job.status = "failed";
  }
  return job;
}

export function cancelAgentJob(id: string): boolean {
  const job = jobs.get(id);
  if (!job) return false;
  if (job.status === "done" || job.status === "failed") return false;
  job.status = "cancelled";
  job.finishedAt = new Date().toISOString();
  const qi = queue.indexOf(id);
  if (qi >= 0) queue.splice(qi, 1);
  return true;
}

export function cancelAgentJobByRunId(runId: string): boolean {
  for (const job of jobs.values()) {
    if (
      job.payload.kind === "run_test" &&
      job.payload.runId === runId &&
      (job.status === "queued" || job.status === "running")
    ) {
      return cancelAgentJob(job.id);
    }
  }
  return false;
}

export function findAgentJobByRunId(runId: string): AgentJob | undefined {
  for (const job of jobs.values()) {
    if (job.payload.kind === "run_test" && job.payload.runId === runId) {
      return job;
    }
  }
  return undefined;
}

export function agentTokenConfigured(): boolean {
  return Boolean(process.env.QA_AGENT_TOKEN?.trim());
}

export function verifyAgentToken(header: string | undefined): boolean {
  const expected = process.env.QA_AGENT_TOKEN?.trim();
  if (!expected) return false;
  if (!header?.startsWith("Bearer ")) return false;
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 && token === expected;
}

/** Aguarda job terminar; callback a cada pedaço novo de log. */
export async function waitForAgentJob(
  jobId: string,
  opts: {
    onLog?: (chunk: string) => void;
    pollMs?: number;
    timeoutMs?: number;
  } = {},
): Promise<AgentJob> {
  const pollMs = opts.pollMs ?? 800;
  const timeoutMs = opts.timeoutMs ?? 45 * 60_000;
  const started = Date.now();
  let sentLen = 0;

  for (;;) {
    const job = jobs.get(jobId);
    if (!job) throw new Error("Job do agente não encontrado");

    if (job.log.length > sentLen) {
      const chunk = job.log.slice(sentLen);
      sentLen = job.log.length;
      opts.onLog?.(chunk);
    }

    if (
      job.status === "done" ||
      job.status === "failed" ||
      job.status === "cancelled"
    ) {
      return job;
    }

    if (Date.now() - started > timeoutMs) {
      cancelAgentJob(jobId);
      throw new Error("Tempo esgotado aguardando o agente no PC");
    }

    await new Promise((r) => setTimeout(r, pollMs));
  }
}
