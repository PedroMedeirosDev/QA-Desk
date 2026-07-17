/**
 * Gravação de tela via adb screenrecord (paralela ao Maestro).
 *
 * Motivo: `maestro record` limita ~2 min — insuficiente para CTs Mural.
 * Android limita ~180s por arquivo; aqui encadeamos chunks até o stop.
 */

import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CHUNK_SECONDS = 180;
const MAX_CHUNKS_DEFAULT = 6; // ~18 min
const REMOTE_PREFIX = "/sdcard/qa_maestro_rec";

function adbBin(): string {
  const home = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  if (home) {
    return process.platform === "win32"
      ? `${home}\\platform-tools\\adb.exe`
      : `${home}/platform-tools/adb`;
  }
  return process.platform === "win32" ? "adb.exe" : "adb";
}

function adb(args: string[], opts?: { timeout?: number }): string {
  return execFileSync(adbBin(), args, {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    timeout: opts?.timeout ?? 30_000,
    windowsHide: true,
  }).trim();
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function interruptScreenrecord() {
  const tries = [
    ["shell", "pkill", "-2", "screenrecord"],
    ["shell", "killall", "-2", "screenrecord"],
  ];
  for (const args of tries) {
    try {
      adb(args, { timeout: 5000 });
    } catch {
      /* ignore */
    }
  }
}

export type ScreenRecordHandle = {
  /** Encerra a gravação, faz pull e devolve paths locais. */
  stop: () => Promise<{
    localPaths: string[];
    note: string;
  }>;
};

/**
 * Inicia gravação em chunks no device; arquivos finais em `localDir`.
 */
export function startAdbScreenRecord(opts: {
  localDir: string;
  onLog?: (line: string) => void;
  maxChunks?: number;
}): ScreenRecordHandle {
  const log = (line: string) => opts.onLog?.(line);
  const maxChunks = opts.maxChunks ?? MAX_CHUNKS_DEFAULT;
  fs.mkdirSync(opts.localDir, { recursive: true });

  let active = true;
  let child: ChildProcess | null = null;
  let chunkIndex = 0;
  const remoteFiles: string[] = [];
  let loopDone: Promise<void> | null = null;

  const runChunk = (index: number): Promise<void> =>
    new Promise((resolve) => {
      const remote = `${REMOTE_PREFIX}_${String(index).padStart(2, "0")}.mp4`;
      remoteFiles.push(remote);
      log(`[qa-app] screenrecord chunk ${index}/${maxChunks} → ${remote}`);

      child = spawn(
        adbBin(),
        [
          "shell",
          "screenrecord",
          "--bit-rate",
          "4000000",
          "--time-limit",
          String(CHUNK_SECONDS),
          remote,
        ],
        { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
      );

      child.on("close", () => {
        child = null;
        resolve();
      });
      child.on("error", () => {
        child = null;
        resolve();
      });
    });

  loopDone = (async () => {
    try {
      adb(["shell", "rm", "-f", `${REMOTE_PREFIX}_*.mp4`], { timeout: 8000 });
    } catch {
      /* glob pode falhar em alguns adb — ignora */
    }

    while (active && chunkIndex < maxChunks) {
      chunkIndex += 1;
      await runChunk(chunkIndex);
      if (!active) break;
      if (chunkIndex >= maxChunks) {
        log(
          `[qa-app] screenrecord: limite de ${maxChunks} chunks (~${(maxChunks * CHUNK_SECONDS) / 60} min) atingido`,
        );
        break;
      }
    }
  })();

  return {
    async stop() {
      active = false;
      interruptScreenrecord();
      if (child?.pid) {
        try {
          child.kill("SIGTERM");
        } catch {
          /* ignore */
        }
      }
      await sleep(800);
      await loopDone;

      const localPaths: string[] = [];
      for (const remote of remoteFiles) {
        const base = path.basename(remote);
        const local = path.join(opts.localDir, base);
        try {
          // Arquivo vazio/inexistente se o chunk não chegou a gravar
          const sizeOut = adb(["shell", "stat", "-c", "%s", remote], {
            timeout: 8000,
          });
          const size = Number.parseInt(sizeOut, 10);
          if (!Number.isFinite(size) || size < 1000) continue;
          adb(["pull", remote, local], { timeout: 120_000 });
          if (fs.existsSync(local) && fs.statSync(local).size > 1000) {
            localPaths.push(local);
          }
        } catch {
          /* chunk ausente */
        }
        try {
          adb(["shell", "rm", "-f", remote], { timeout: 5000 });
        } catch {
          /* ignore */
        }
      }

      const note =
        localPaths.length === 0
          ? "Gravação solicitada, mas nenhum MP4 válido foi obtido (device/adb)."
          : localPaths.length === 1
            ? `Vídeo salvo (${CHUNK_SECONDS}s máx. por chunk Android).`
            : `${localPaths.length} partes de vídeo (chunks de até ${CHUNK_SECONDS}s).`;

      log(`[qa-app] screenrecord fim: ${localPaths.length} arquivo(s)`);
      return { localPaths, note };
    },
  };
}
