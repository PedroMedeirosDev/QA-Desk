/**
 * Executa spec Playwright (seed web) a partir da qa-desk.
 * Spec path: relativo à raiz do repo OU relativo a projects/.../playwright.
 */
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const PLAYWRIGHT_ROOT = path.join(
  REPO_ROOT,
  "projects",
  "polygonus",
  "automation",
  "playwright",
);

export type PlaywrightRunResult = {
  ok: boolean;
  exitCode: number | null;
  output: string;
  cancelled?: boolean;
  durationMs: number;
  /** Versão do rodapé login amostra CQ (CTs WEB) — parseada do log */
  appVersion?: string;
};

/** Marcador emitido pelos specs WEB (`shared/gestao-auth.ts`). */
export const WEB_BUILD_MARKER = "[qa-desk] web-build:";

export function parseWebBuildFromPlaywrightOutput(
  output: string,
): string | undefined {
  const lines = output.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const idx = line.indexOf(WEB_BUILD_MARKER);
    if (idx < 0) continue;
    const value = line.slice(idx + WEB_BUILD_MARKER.length).trim();
    if (value) return value;
  }
  return undefined;
}

export type PlaywrightSpecInfo = {
  id: string;
  label: string;
  type: "playwright";
  /** Relativo à raiz do monorepo */
  specPath: string;
  module?: string;
};

let activePw: { runId?: string; child: ChildProcess } | null = null;

export function getActivePlaywrightRun(): { runId?: string; pid?: number } | null {
  if (!activePw?.child.pid) return null;
  return { runId: activePw.runId, pid: activePw.child.pid };
}

/** Mata o Playwright do run atual (cancel pelo usuário). */
export function cancelPlaywrightRun(runId?: string): boolean {
  if (!activePw) return false;
  if (runId && activePw.runId && activePw.runId !== runId) return false;
  const child = activePw.child;
  try {
    if (process.platform === "win32" && child.pid) {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
    } else {
      child.kill("SIGTERM");
    }
  } catch {
    /* ignore */
  }
  return true;
}

function resolveSpecRelativeToPlaywright(specPath: string): string {
  const abs = path.isAbsolute(specPath)
    ? specPath
    : path.resolve(REPO_ROOT, specPath);

  if (!fs.existsSync(abs)) {
    throw new Error(`Spec Playwright não encontrado: ${specPath}`);
  }

  const rel = path.relative(PLAYWRIGHT_ROOT, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(
      `Spec Playwright fora de ${path.relative(REPO_ROOT, PLAYWRIGHT_ROOT)}: ${specPath}`,
    );
  }
  return rel.replace(/\\/g, "/");
}

/** Lista specs `.spec.ts` sob projects/polygonus/automation/playwright. */
export function listPlaywrightSpecs(module?: string): PlaywrightSpecInfo[] {
  if (!fs.existsSync(PLAYWRIGHT_ROOT)) return [];

  const specs: PlaywrightSpecInfo[] = [];

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "test-results") continue;
        walk(abs);
        continue;
      }
      if (!entry.isFile() || !/\.spec\.ts$/i.test(entry.name)) continue;
      const relToPw = path.relative(PLAYWRIGHT_ROOT, abs).replace(/\\/g, "/");
      const mod = relToPw.includes("/") ? relToPw.split("/")[0] : undefined;
      if (module && mod && mod.toLowerCase() !== module.toLowerCase()) continue;
      const repoRel = path.relative(REPO_ROOT, abs).replace(/\\/g, "/");
      specs.push({
        id: repoRel,
        label: relToPw.replace(/\.spec\.ts$/i, ""),
        type: "playwright",
        specPath: repoRel,
        module: mod,
      });
    }
  };

  walk(PLAYWRIGHT_ROOT);
  return specs.sort((a, b) => a.specPath.localeCompare(b.specPath));
}

export async function runPlaywrightSpec(
  specPath: string,
  opts?: {
    headed?: boolean;
    timeoutMs?: number;
    onOutput?: (chunk: string) => void;
    runId?: string;
    /** Se retornar true, aborta */
    shouldCancel?: () => boolean;
  },
): Promise<PlaywrightRunResult> {
  if (!fs.existsSync(PLAYWRIGHT_ROOT)) {
    throw new Error(`Diretório Playwright ausente: ${PLAYWRIGHT_ROOT}`);
  }

  const relSpec = resolveSpecRelativeToPlaywright(specPath);
  const headed = opts?.headed !== false;
  const timeoutMs = opts?.timeoutMs ?? 240_000;
  const args = ["playwright", "test", relSpec, "--timeout=180000"];
  if (headed) args.push("--headed");

  const started = Date.now();
  let output = "";
  let cancelled = false;

  const child = spawn("npx", args, {
    cwd: PLAYWRIGHT_ROOT,
    env: {
      ...process.env,
      FORCE_COLOR: "0",
      PLAYWRIGHT_HEADED: headed ? "1" : "0",
    },
    shell: true,
    windowsHide: false,
  });

  activePw = { runId: opts?.runId, child };

  const append = (chunk: Buffer | string) => {
    const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
    output += text;
    opts?.onOutput?.(text);
  };

  child.stdout?.on("data", append);
  child.stderr?.on("data", append);

  const cancelWatch = setInterval(() => {
    if (opts?.shouldCancel?.()) {
      cancelled = true;
      cancelPlaywrightRun(opts.runId);
    }
  }, 500);

  const exitCode = await new Promise<number | null>((resolve) => {
    const timer = setTimeout(() => {
      cancelled = true;
      cancelPlaywrightRun(opts?.runId);
      append(
        `\n[qa-desk] Playwright abortado por timeout (${Math.round(timeoutMs / 1000)}s).\n`,
      );
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      append(`\n[qa-desk] Playwright spawn error: ${err.message}\n`);
      resolve(1);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });

  clearInterval(cancelWatch);
  if (activePw?.child === child) activePw = null;

  const ok = !cancelled && exitCode === 0;
  return {
    ok,
    exitCode,
    output,
    cancelled: cancelled || undefined,
    durationMs: Date.now() - started,
    appVersion: parseWebBuildFromPlaywrightOutput(output),
  };
}

/**
 * PNG mais recente gerado pelo Playwright em falha (`screenshot: "only-on-failure"`).
 * Procura sob `test-results/` (nomes `test-failed*.png`).
 */
export function findLatestPlaywrightFailureScreenshot(
  underRoot: string = PLAYWRIGHT_ROOT,
): string | null {
  const resultsDir = path.join(underRoot, "test-results");
  if (!fs.existsSync(resultsDir)) return null;

  let best: { abs: string; mtime: number } | null = null;

  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      const lower = entry.name.toLowerCase();
      if (!lower.startsWith("test-failed") || !lower.endsWith(".png")) continue;
      try {
        const mtime = fs.statSync(abs).mtimeMs;
        if (!best || mtime > best.mtime) best = { abs, mtime };
      } catch {
        /* ignore */
      }
    }
  };

  walk(resultsDir);
  return best?.abs ?? null;
}
