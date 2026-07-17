#!/usr/bin/env node
/**
 * Limpa artefatos gerados pelos testes Maestro:
 *
 * 1) Device/emulador — downloads de Salvar/Compartilhar anexos (app baixa antes do share sheet)
 * 2) Maestro — apaga pasta do run quando PASS; mantém quando FAIL
 * 3) Prune — remove runs antigos (padrão: falhas > 14 dias)
 *
 * Uso:
 *   node scripts/cleanup-test-artifacts.mjs --emulator
 *   node scripts/cleanup-test-artifacts.mjs --post-run --ok --since 1710000000000
 *   node scripts/cleanup-test-artifacts.mjs --prune-days 14
 *   node scripts/cleanup-test-artifacts.mjs --dry-run --emulator --prune-days 7
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAESTRO_ROOT = path.resolve(__dirname, "..");
const FIXTURES_DIR = path.join(MAESTRO_ROOT, "fixtures");
const DEFAULT_OUTPUT_DIR = path.join(MAESTRO_ROOT, ".maestro-output");

const APP_ID = "br.com.polygonus.mobile.amostra";

/** Salvar/Compartilhar depositam aqui — remover tudo ligado a fixture */
const DOWNLOAD_DIRS = new Set(["/sdcard/Download", "/sdcard/Downloads"]);

const DEVICE_SCAN_DIRS = [
  ...DOWNLOAD_DIRS,
  "/sdcard/Pictures",
  "/sdcard/Movies",
  "/sdcard/Documents",
  "/sdcard/DCIM/Camera",
  `/sdcard/Android/data/${APP_ID}/files`,
  `/sdcard/Android/data/${APP_ID}/cache`,
];

function parseArgs(argv) {
  const flags = {
    emulator: false,
    device: process.env.MAESTRO_DEVICE || process.env.ADB_DEVICE || "",
    postRun: false,
    ok: false,
    fail: false,
    since: 0,
    pruneDays: 0,
    outputDir: process.env.MAESTRO_TEST_OUTPUT_DIR || DEFAULT_OUTPUT_DIR,
    dryRun: false,
    quiet: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--emulator") flags.emulator = true;
    else if (a === "--device" && argv[i + 1]) flags.device = argv[++i];
    else if (a === "--post-run") flags.postRun = true;
    else if (a === "--ok") flags.ok = true;
    else if (a === "--fail") flags.fail = true;
    else if (a === "--since" && argv[i + 1]) flags.since = Number(argv[++i]) || 0;
    else if (a === "--prune-days" && argv[i + 1]) flags.pruneDays = Number(argv[++i]) || 0;
    else if (a === "--output-dir" && argv[i + 1]) flags.outputDir = path.resolve(argv[++i]);
    else if (a === "--dry-run") flags.dryRun = true;
    else if (a === "--quiet") flags.quiet = true;
    else if (a === "--help" || a === "-h") {
      console.log(`Uso: node cleanup-test-artifacts.mjs [opções]

  --emulator              Limpa cópias no device (Foto_1 (N), UUIDs do addMedia, downloads)
  --device <serial>       Serial adb (default: único device conectado)
  --post-run              Modo pós-execução Maestro
  --ok / --fail           Resultado do run (--post-run)
  --since <ms>            Timestamp (Date.now()) do início do run
  --prune-days <n>        Remove pastas Maestro mais antigas que n dias
  --output-dir <path>     Pasta de artefatos Maestro (default: .maestro-output)
  --dry-run               Só lista o que seria removido
  --quiet                 Menos logs`);
      process.exit(0);
    }
  }

  return flags;
}

function log(msg, flags) {
  if (!flags.quiet) console.log(msg);
}

function loadProtectedFixtureNames() {
  if (!fs.existsSync(FIXTURES_DIR)) return [];
  return fs
    .readdirSync(FIXTURES_DIR)
    .filter((f) => f !== ".gitkeep" && !f.startsWith("."));
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fixtureCopyPatterns(base, ext) {
  return [
    new RegExp(`^${escapeRegex(base)}\\s*\\(\\d+\\)${escapeRegex(ext)}$`, "i"),
    new RegExp(`^${escapeRegex(base)}\\s*-\\s*\\d+${escapeRegex(ext)}$`, "i"),
    new RegExp(`^${escapeRegex(base)}_\\d+${escapeRegex(ext)}$`, "i"),
    new RegExp(`^${escapeRegex(base)}\\s*-\\s*cop(y|ia)${escapeRegex(ext)}$`, "i"),
    new RegExp(`^${escapeRegex(base)}\\s*\\(\\d+\\)${escapeRegex(ext)}\\.crdownload$`, "i"),
  ];
}

function matchesFixtureVariant(filename, base, ext) {
  if (new RegExp(`^${escapeRegex(base)}${escapeRegex(ext)}$`, "i").test(filename)) {
    return true;
  }
  return fixtureCopyPatterns(base, ext).some((p) => p.test(filename));
}

/** addMedia do Maestro gera nomes tipo 1784054731047_<uuid>.jpeg */
const ADDMEDIA_UUID_RE =
  /^\d{10,}_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpe?g|png|gif|webp|mp4|mov)$/i;

/**
 * Retorna 'keep' | 'delete' | null (não relacionado a fixture).
 * Download: Salvar e Compartilhar baixam antes de concluir — remove qualquer variante.
 * Galeria (Pictures/DCIM): mantém só o original exato (Foto_1.jpeg); apaga (1)(2)… e UUIDs do addMedia.
 */
function classifyFixtureFile(filename, protectedNames, dir) {
  const inDownload = DOWNLOAD_DIRS.has(dir);

  // Cópias do addMedia (uuid) — sempre lixo de teste na galeria/download
  if (ADDMEDIA_UUID_RE.test(filename)) {
    return "delete";
  }

  for (const orig of protectedNames) {
    const dot = orig.lastIndexOf(".");
    const base = dot >= 0 ? orig.slice(0, dot) : orig;
    const ext = dot >= 0 ? orig.slice(dot) : "";
    const isExact = new RegExp(`^${escapeRegex(orig)}$`, "i").test(filename);
    const isCopy = fixtureCopyPatterns(base, ext).some((p) => p.test(filename));

    // Originais (PDF TESTE.pdf, Video_teste.mp4, Foto_*.jpeg) ficam — só apaga cópias.
    if (isExact) return "keep";
    if (isCopy) return "delete";
  }

  if (inDownload && /\.(jpe?g|png|gif|webp|pdf|mp4|mov|avi)$/i.test(filename)) {
    const lower = filename.toLowerCase();
    if (
      lower.includes("anexo") ||
      lower.includes("attachment") ||
      lower.startsWith("download") ||
      /^file_\d+/i.test(filename)
    ) {
      return "delete";
    }
  }

  return null;
}

function adbArgs(device, shellCmd) {
  const base = ["shell", shellCmd];
  return device ? ["-s", device, ...base] : base;
}

function runAdb(device, shellCmd) {
  const r = spawnSync("adb", adbArgs(device, shellCmd), {
    encoding: "utf8",
    windowsHide: true,
  });
  return {
    ok: r.status === 0,
    stdout: (r.stdout || "").trim(),
    stderr: (r.stderr || "").trim(),
  };
}

function resolveAdbDevice(preferred) {
  if (preferred) return preferred;
  const r = spawnSync("adb", ["devices"], { encoding: "utf8", windowsHide: true });
  const lines = (r.stdout || "")
    .split(/\r?\n/)
    .slice(1)
    .map((l) => l.trim())
    .filter((l) => l.endsWith("device"))
    .map((l) => l.split(/\s+/)[0]);
  if (lines.length === 1) return lines[0];
  if (lines.length === 0) return null;
  return lines.find((d) => d.startsWith("emulator-")) || lines[0];
}

function listDeviceFiles(device, dir) {
  const quoted = `'${dir.replace(/'/g, `'\\''`)}'`;
  const r = runAdb(device, `ls -1 ${quoted} 2>/dev/null`);
  if (!r.ok || !r.stdout) return [];
  return r.stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !l.includes("No such file"))
    .map((name) => ({ name, dir, full: `${dir}/${name}` }));
}

function listDeviceFilesRecursive(device, dir, maxDepth = 3) {
  const quoted = `'${dir.replace(/'/g, `'\\''`)}'`;
  const r = runAdb(device, `find ${quoted} -maxdepth ${maxDepth} -type f 2>/dev/null`);
  if (!r.ok || !r.stdout) return [];
  return r.stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((full) => {
      const slash = full.lastIndexOf("/");
      return {
        full,
        dir: slash >= 0 ? full.slice(0, slash) : dir,
        name: slash >= 0 ? full.slice(slash + 1) : full,
      };
    });
}

function cleanupEmulator(flags) {
  const device = resolveAdbDevice(flags.device);
  if (!device) {
    log("[emulator] Nenhum device adb — pulando limpeza de anexos.", flags);
    return { deleted: 0, kept: 0, skipped: true };
  }

  const protectedNames = loadProtectedFixtureNames();
  let deleted = 0;
  let kept = 0;

  for (const dir of DEVICE_SCAN_DIRS) {
    const recursive =
      DOWNLOAD_DIRS.has(dir) || dir.includes(`/Android/data/${APP_ID}/`);
    const entries = recursive
      ? listDeviceFilesRecursive(device, dir)
      : listDeviceFiles(device, dir);

    for (const entry of entries) {
      const { name, full } = entry;
      const parentDir = entry.dir;
      const verdict = classifyFixtureFile(name, protectedNames, parentDir);
      if (verdict === "keep") {
        kept++;
        continue;
      }
      if (verdict !== "delete") continue;

      log(`[emulator] remover download/cópia: ${full}`, flags);
      if (!flags.dryRun) {
        runAdb(device, `rm -f '${full.replace(/'/g, `'\\''`)}'`);
      }
      deleted++;
    }
  }

  log(`[emulator] device=${device} removidos=${deleted} originais_mantidos=${kept}`, flags);
  return { deleted, kept, device };
}

function parseMaestroRunDirMs(name) {
  const m = name.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})(\d{2})$/);
  if (!m) return null;
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6]),
  ).getTime();
}

function listMaestroRunDirs(outputDir) {
  if (!fs.existsSync(outputDir)) return [];
  return fs
    .readdirSync(outputDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => parseMaestroRunDirMs(name) !== null);
}

function deleteMaestroRunDir(outputDir, name, flags) {
  const full = path.join(outputDir, name);
  log(`[maestro] remover pasta: ${name}`, flags);
  if (!flags.dryRun) {
    fs.rmSync(full, { recursive: true, force: true });
  }
}

function dirSizeBytes(dir) {
  let bytes = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) bytes += dirSizeBytes(p);
    else bytes += fs.statSync(p).size;
  }
  return bytes;
}

function cleanupMaestroPostRun(flags) {
  const since = flags.since || Date.now() - 60_000;
  const threshold = since - 10_000;
  const dirs = listMaestroRunDirs(flags.outputDir);
  let removed = 0;

  if (flags.ok) {
    for (const name of dirs) {
      const ms = parseMaestroRunDirMs(name);
      if (ms !== null && ms >= threshold) {
        deleteMaestroRunDir(flags.outputDir, name, flags);
        removed++;
      }
    }
    log(`[maestro] run PASS — pastas removidas=${removed} (prints só em falha)`, flags);
  } else {
    log(`[maestro] run FAIL — artefatos mantidos em ${flags.outputDir}`, flags);
  }

  return { removed, kept: dirs.length - removed };
}

function pruneMaestroRuns(flags) {
  const days = flags.pruneDays || 14;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const dirs = listMaestroRunDirs(flags.outputDir);
  let removed = 0;

  for (const name of dirs) {
    const ms = parseMaestroRunDirMs(name);
    if (ms !== null && ms < cutoff) {
      deleteMaestroRunDir(flags.outputDir, name, flags);
      removed++;
    }
  }

  log(`[maestro] prune >${days}d — removidas=${removed}`, flags);
  return { removed };
}

function main() {
  const flags = parseArgs(process.argv);
  const summary = { emulator: null, maestro: null, prune: null };

  // Sempre limpa galeria/downloads no pós-run (PASS ou FAIL) — addMedia acumula Foto_1 (N).jpeg
  const doEmulator = flags.emulator || flags.postRun;
  if (doEmulator) {
    summary.emulator = cleanupEmulator(flags);
  }

  if (flags.postRun) {
    summary.maestro = cleanupMaestroPostRun(flags);
  }

  if (flags.pruneDays > 0) {
    summary.prune = pruneMaestroRuns(flags);
  }

  if (!flags.quiet) {
    const outDirs = listMaestroRunDirs(flags.outputDir);
    const totalMb = outDirs.reduce((acc, name) => {
      const p = path.join(flags.outputDir, name);
      return acc + (fs.existsSync(p) ? dirSizeBytes(p) / (1024 * 1024) : 0);
    }, 0);
    log(
      `[resumo] maestro_runs=${outDirs.length} (~${totalMb.toFixed(1)} MB em ${flags.outputDir})`,
      flags,
    );
  }

  if (!flags.quiet && !flags.postRun && !flags.emulator && flags.pruneDays <= 0) {
    console.log("Nada a fazer. Use --help.");
    process.exit(1);
  }

  return summary;
}

main();
