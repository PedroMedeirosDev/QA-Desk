import type { ChildProcess } from "node:child_process";
import { execFile, execFileSync, exec } from "node:child_process";
import { persistCancelledRunSession } from "./maestro-run-session.js";

export type MaestroRunMeta = {
  runId: string;
  project: string;
  testId: string;
  flowPath: string;
  startedAt: number;
};

type ActiveMaestroRun = MaestroRunMeta & {
  child: ChildProcess;
  cancelRequested: boolean;
};

let activeRun: ActiveMaestroRun | null = null;

/** Cancel persiste entre fases (prep → adb → CT) quando não há processo Maestro ativo. */
const cancelledRunIds = new Set<string>();

export function markMaestroRunCancelled(runId: string): void {
  if (runId) cancelledRunIds.add(runId);
}

export function clearMaestroRunCancelled(runId: string): void {
  cancelledRunIds.delete(runId);
}

function runDetached(command: string, args: string[]): void {
  try {
    execFile(command, args, { windowsHide: true, timeout: 15_000 }, () => {
      /* ignore */
    });
  } catch {
    /* ignore */
  }
}

/** Mata processos Maestro/Java órfãos no Windows (CLI costuma sobreviver ao cmd). Não bloqueia o event loop. */
export function forceKillMaestroProcesses(): void {
  if (process.platform !== "win32") return;

  try {
    exec(
      'powershell -NoProfile -ExecutionPolicy Bypass -Command "' +
        "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and ($_.CommandLine -match 'maestro' -or $_.CommandLine -match 'Maestro') } | " +
        'ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"',
      { windowsHide: true, timeout: 15_000 },
      () => {
        /* ignore */
      },
    );
  } catch {
    /* ignore */
  }

  runDetached("taskkill", ["/F", "/IM", "maestro.exe", "/T"]);
}

/** Encerra o processo Maestro e a árvore. Async — não usar execSync (trava o lote no Windows). */
export function killProcessTree(child: ChildProcess): void {
  const pid = child.pid;
  try {
    child.stdout?.destroy();
  } catch {
    /* ignore */
  }
  try {
    child.stderr?.destroy();
  } catch {
    /* ignore */
  }

  if (process.platform === "win32" && pid) {
    runDetached("taskkill", ["/PID", String(pid), "/T", "/F"]);
    forceKillMaestroProcesses();
    return;
  }

  if (!pid) {
    try {
      child.kill("SIGKILL");
    } catch {
      /* ignore */
    }
    forceKillMaestroProcesses();
    return;
  }

  try {
    child.kill("SIGTERM");
    setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
    }, 2000);
  } catch {
    /* ignore */
  }
}

/** Kill síncrono só para shutdown do processo Node (evitar órfãos). */
export function forceKillMaestroProcessesSync(): void {
  if (process.platform !== "win32") return;
  try {
    execFileSync("taskkill", ["/F", "/IM", "maestro.exe", "/T"], {
      windowsHide: true,
      timeout: 8000,
    });
  } catch {
    /* ignore */
  }
}

export function getActiveMaestroRun(): MaestroRunMeta | null {
  if (!activeRun) return null;
  const { child: _c, cancelRequested: _r, ...meta } = activeRun;
  return meta;
}

export function registerMaestroRun(
  meta: MaestroRunMeta,
  child: ChildProcess,
): void {
  // Preserva cancel se o usuário pediu parada entre prep → adb → CT.
  activeRun = {
    ...meta,
    child,
    cancelRequested: cancelledRunIds.has(meta.runId),
  };
}

export function clearMaestroRun(runId: string): void {
  if (activeRun?.runId === runId) activeRun = null;
}

export function wasMaestroRunCancelled(runId: string): boolean {
  if (cancelledRunIds.has(runId)) return true;
  return activeRun?.runId === runId && activeRun.cancelRequested;
}

/** Encerra o Maestro em execução. Só há um run ativo — runId divergente ainda cancela. */
export function cancelMaestroRun(runId?: string): boolean {
  if (runId) markMaestroRunCancelled(runId);

  if (!activeRun) {
    forceKillMaestroProcesses();
    return false;
  }

  if (runId && activeRun.runId !== runId) {
    console.warn(
      `[qa-desk] cancel: runId ${runId} ≠ ativo ${activeRun.runId} — encerrando o ativo`,
    );
  }

  activeRun.cancelRequested = true;
  const child = activeRun.child;
  killProcessTree(child);
  void persistCancelledRunSession(
    runId && activeRun.runId !== runId ? runId : activeRun.runId,
    "\n[qa-desk] Execução cancelada pelo usuário.\n",
  ).catch((err) => {
    console.warn("[qa-desk] Falha ao persistir cancelamento:", err);
  });
  return true;
}
