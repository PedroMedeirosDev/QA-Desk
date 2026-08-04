/**
 * Registry + runner de suites Newman (Postman CLI) por projeto.
 * Relatório: digest (summary/failures) + rawCli (log fiel).
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POSTMAN_ROOT = path.join(__dirname, "../postman/projects");
const isWin = process.platform === "win32";

export type ApiSuiteManifest = {
  id: string;
  /** Projeto da UI (`polygonus`, `desk`, …). Se omitido, usa `id`. */
  project?: string;
  /** Ordem estável dos cards (menor primeiro). */
  order?: number;
  label: string;
  ready: boolean;
  bootMock?: boolean;
  collection: string;
  environment: string;
  description?: string;
  reason?: string;
  envFromProcess?: string[];
};

export type ApiSuiteFailure = {
  name: string;
  assertion?: string;
  error?: string;
};

export type ApiSuiteRunResult = {
  ok: boolean;
  suiteId: string;
  label: string;
  summary: {
    requests: number;
    assertions: number;
    failed: number;
    durationMs: number;
  };
  failures: ApiSuiteFailure[];
  rawCli: string;
  ranAt: string;
  exitCode: number;
};

const lastRuns = new Map<string, ApiSuiteRunResult>();

function spawnNpm(args: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv; stdio?: "pipe" | "inherit" } = {}) {
  return spawn(isWin ? "npm.cmd" : "npm", args, {
    cwd: opts.cwd ?? path.join(__dirname, ".."),
    env: opts.env ?? process.env,
    shell: isWin,
    stdio: opts.stdio ?? "pipe",
  });
}

function spawnNewman(newmanArgs: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) {
  const root = opts.cwd ?? path.join(__dirname, "..");
  const newmanJs = path.join(root, "node_modules", "newman", "bin", "newman.js");
  return spawn(process.execPath, [newmanJs, ...newmanArgs], {
    cwd: root,
    env: opts.env ?? process.env,
    shell: false,
    stdio: "pipe",
  });
}

function killTree(pid?: number) {
  if (!pid) return;
  if (isWin) {
    spawn("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore", shell: true });
  } else {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        /* already dead */
      }
    }
  }
}

async function waitForHealth(url: string, timeoutMs = 90_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`API mock não respondeu em ${url}`);
}

export function listSuiteIds(): string[] {
  if (!fs.existsSync(POSTMAN_ROOT)) return [];
  return fs
    .readdirSync(POSTMAN_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((id) => fs.existsSync(path.join(POSTMAN_ROOT, id, "manifest.json")));
}

export function readManifest(suiteId: string): ApiSuiteManifest {
  const file = path.join(POSTMAN_ROOT, suiteId, "manifest.json");
  if (!fs.existsSync(file)) {
    throw new Error(`Suite API desconhecida: ${suiteId}`);
  }
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as ApiSuiteManifest;
  return { ...raw, id: raw.id || suiteId };
}

export function getSuiteStatus(suiteId: string) {
  const manifest = readManifest(suiteId);
  return {
    ...manifest,
    lastRun: lastRuns.get(suiteId) ?? null,
  };
}

export function suitesForProject(projectSlug: string): ApiSuiteManifest[] {
  const all = listSuiteIds().map((id) => readManifest(id));
  return all
    .filter((s) => (s.project ?? s.id) === projectSlug)
    .sort((a, b) => {
      const oa = a.order ?? 999;
      const ob = b.order ?? 999;
      if (oa !== ob) return oa - ob;
      return a.label.localeCompare(b.label, "pt-BR");
    });
}

type NewmanJson = {
  run?: {
    timings?: { completed?: number; started?: number };
    stats?: {
      requests?: { total?: number; failed?: number };
      assertions?: { total?: number; failed?: number };
    };
    failures?: Array<{
      error?: { test?: string; message?: string; name?: string };
      source?: { name?: string };
      at?: string;
    }>;
  };
};

function digestNewman(json: NewmanJson | null, cli: string, exitCode: number, suite: ApiSuiteManifest): ApiSuiteRunResult {
  const stats = json?.run?.stats;
  const requests = stats?.requests?.total ?? 0;
  const assertions = stats?.assertions?.total ?? 0;
  const failedAsserts = stats?.assertions?.failed ?? 0;
  const failedReqs = stats?.requests?.failed ?? 0;
  const failed = Math.max(failedAsserts, failedReqs, exitCode === 0 ? 0 : 1);
  const started = json?.run?.timings?.started ?? 0;
  const completed = json?.run?.timings?.completed ?? 0;
  const durationMs = completed && started ? Math.max(0, completed - started) : 0;

  const failures: ApiSuiteFailure[] = (json?.run?.failures ?? []).map((f) => ({
    name: f.source?.name || f.at || "request",
    assertion: f.error?.test || f.error?.name,
    error: f.error?.message,
  }));

  return {
    ok: exitCode === 0 && failed === 0,
    suiteId: suite.id,
    label: suite.label,
    summary: {
      requests,
      assertions,
      failed: failedAsserts,
      durationMs,
    },
    failures,
    rawCli: cli,
    ranAt: new Date().toISOString(),
    exitCode,
  };
}

function envOverridesForSuite(suite: ApiSuiteManifest): string[] {
  const map: Record<string, string> = {
    POLY_API_BASE_URL: "baseUrl",
    POLY_API_LOGIN: "login",
    POLY_API_SENHA: "senha",
    POLY_API_UNIDADE: "unidade",
    POLY_API_HOSTNAME: "hostname",
    POLY_API_ANO: "ano",
  };
  const args: string[] = [];
  const keys = suite.envFromProcess ?? Object.keys(map);
  for (const procKey of keys) {
    const val = process.env[procKey]?.trim();
    if (!val) continue;
    const envKey = map[procKey];
    if (envKey) args.push("--env-var", `${envKey}=${val}`);
  }
  // Defaults sensatos se env não setou
  if (suite.id === "polygonus") {
    if (!process.env.POLY_API_BASE_URL) {
      args.push("--env-var", "baseUrl=https://amostra.polygonus.com.br:8443/api/v2");
    }
    if (!process.env.POLY_API_LOGIN) args.push("--env-var", "login=SUPPETER");
    if (!process.env.POLY_API_UNIDADE) {
      args.push("--env-var", "unidade=Colégio Demonstração");
    }
    if (!process.env.POLY_API_SENHA && process.env.PLAYWRIGHT_SENHA) {
      args.push("--env-var", `senha=${process.env.PLAYWRIGHT_SENHA}`);
    }
  }
  return args;
}

export async function runSuite(suiteId: string): Promise<ApiSuiteRunResult> {
  const suite = readManifest(suiteId);
  if (!suite.ready) {
    const blocked: ApiSuiteRunResult = {
      ok: false,
      suiteId: suite.id,
      label: suite.label,
      summary: { requests: 0, assertions: 0, failed: 1, durationMs: 0 },
      failures: [
        {
          name: suite.label,
          error: suite.reason || "Suite ainda não está pronta (ready: false).",
        },
      ],
      rawCli: suite.reason || "ready: false",
      ranAt: new Date().toISOString(),
      exitCode: 1,
    };
    lastRuns.set(suiteId, blocked);
    return blocked;
  }

  const dir = path.join(POSTMAN_ROOT, suiteId);
  const collection = path.join(dir, suite.collection);
  const environment = path.join(dir, suite.environment);
  if (!fs.existsSync(collection)) throw new Error(`Collection ausente: ${collection}`);
  if (!fs.existsSync(environment)) throw new Error(`Environment ausente: ${environment}`);

  const tmpJson = path.join(os.tmpdir(), `qa-desk-newman-${suiteId}-${Date.now()}.json`);
  const deskRoot = path.join(__dirname, "..");
  const HEALTH = "http://127.0.0.1:3011/api/health";

  let mockPid: number | undefined;
  let cli = "";

  try {
    if (suite.bootMock) {
      const server = spawnNpm(["run", "e2e:api"], {
        cwd: deskRoot,
        stdio: "pipe",
        env: process.env,
      });
      mockPid = server.pid;
      server.stdout?.on("data", (b: Buffer) => {
        cli += b.toString("utf8");
      });
      server.stderr?.on("data", (b: Buffer) => {
        cli += b.toString("utf8");
      });
      await waitForHealth(HEALTH);
    }

    const newmanArgs = [
      "run",
      collection,
      "-e",
      environment,
      "--reporters",
      "cli,json",
      "--reporter-json-export",
      tmpJson,
      ...envOverridesForSuite(suite),
    ];

    const { exitCode, output } = await new Promise<{ exitCode: number; output: string }>((resolve) => {
      let out = "";
      const child = spawnNewman(newmanArgs, { cwd: deskRoot, env: process.env });
      child.stdout?.on("data", (b: Buffer) => {
        out += b.toString("utf8");
      });
      child.stderr?.on("data", (b: Buffer) => {
        out += b.toString("utf8");
      });
      child.on("error", (err) => {
        out += `\n${err.message}`;
        resolve({ exitCode: 1, output: out });
      });
      child.on("exit", (code) => resolve({ exitCode: code ?? 1, output: out }));
    });

    cli += (cli ? "\n" : "") + output;

    let parsed: NewmanJson | null = null;
    if (fs.existsSync(tmpJson)) {
      try {
        parsed = JSON.parse(fs.readFileSync(tmpJson, "utf8")) as NewmanJson;
      } catch {
        parsed = null;
      }
    }

    const result = digestNewman(parsed, cli, exitCode, suite);
    lastRuns.set(suiteId, result);
    return result;
  } finally {
    killTree(mockPid);
    try {
      if (fs.existsSync(tmpJson)) fs.unlinkSync(tmpJson);
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
}
