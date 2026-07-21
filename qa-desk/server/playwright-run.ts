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
  const normalized = specPath.replace(/\\/g, "/");
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
    env: { ...process.env, FORCE_COLOR: "0" },
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
  };
}
