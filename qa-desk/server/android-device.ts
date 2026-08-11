import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface AdbDevice {
  serial: string;
  state: string;
  kind: "emulator" | "physical";
}

export interface AndroidDeviceStatus {
  ready: boolean;
  devices: AdbDevice[];
  primarySerial?: string;
  avdName: string;
  booting: boolean;
  message: string;
}

const DEFAULT_AVD = "Medium_Phone";
const DEFAULT_TIMEZONE = "America/Sao_Paulo";

export function getConfiguredAvdName(): string {
  return (process.env.QA_ANDROID_AVD ?? DEFAULT_AVD).trim() || DEFAULT_AVD;
}

function isAutoEmulatorEnabled(): boolean {
  return process.env.QA_ANDROID_AUTO_EMULATOR === "1";
}

export { isAutoEmulatorEnabled };

function parseAdbDevices(stdout: string): AdbDevice[] {
  const lines = stdout.split(/\r?\n/).slice(1);
  const devices: AdbDevice[] = [];
  for (const line of lines) {
    const m = /^(\S+)\s+(\S+)/.exec(line.trim());
    if (!m) continue;
    devices.push({
      serial: m[1],
      state: m[2],
      kind: m[1].startsWith("emulator-") ? "emulator" : "physical",
    });
  }
  return devices;
}

export async function listAdbDevices(): Promise<AdbDevice[]> {
  try {
    const { stdout } = await execFileAsync("adb", ["devices"], {
      encoding: "utf8",
      timeout: 10000,
      windowsHide: true,
    });
    return parseAdbDevices(stdout);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/ENOENT|not found/i.test(msg)) {
      throw new Error(
        "adb não encontrado no PATH — instale Android SDK Platform-Tools",
      );
    }
    throw err;
  }
}

function pickPrimaryDevice(devices: AdbDevice[]): AdbDevice | undefined {
  const ready = devices.filter((d) => d.state === "device");
  return (
    ready.find((d) => d.kind === "emulator") ??
    ready[0] ??
    devices.find((d) => d.kind === "emulator") ??
    devices[0]
  );
}

export async function getAndroidDeviceStatus(): Promise<AndroidDeviceStatus> {
  const avdName = getConfiguredAvdName();
  let devices: AdbDevice[];
  try {
    devices = await listAdbDevices();
  } catch (err) {
    return {
      ready: false,
      devices: [],
      avdName,
      booting: false,
      message: err instanceof Error ? err.message : "Erro ao consultar adb",
    };
  }

  const primary = pickPrimaryDevice(devices);
  const ready = devices.some((d) => d.state === "device");
  const booting = devices.some(
    (d) =>
      d.kind === "emulator" &&
      (d.state === "offline" || d.state === "authorizing"),
  );

  let message: string;
  if (ready && primary) {
    message =
      primary.kind === "emulator"
        ? `Emulador pronto (${primary.serial})`
        : `Device pronto (${primary.serial})`;
  } else if (booting) {
    message = "Emulador ligando — aguarde boot completo…";
  } else if (devices.some((d) => d.state === "unauthorized")) {
    message = "Device não autorizado — aceite depuração USB no aparelho";
  } else {
    message = `Nenhum device — use o botão ou ligue o AVD ${avdName}`;
  }

  return {
    ready,
    devices,
    primarySerial: primary?.serial,
    avdName,
    booting,
    message,
  };
}

function resolveEmulatorBin(): string {
  const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  if (sdk) {
    const bin =
      process.platform === "win32"
        ? path.join(sdk, "emulator", "emulator.exe")
        : path.join(sdk, "emulator", "emulator");
    if (fs.existsSync(bin)) return bin;
  }
  return process.platform === "win32" ? "emulator.exe" : "emulator";
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Inicia o AVD configurado (processo detached — janela visível). */
export async function startAndroidEmulator(): Promise<{ started: boolean; message: string }> {
  const avdName = getConfiguredAvdName();
  const status = await getAndroidDeviceStatus();
  if (status.ready) {
    return { started: false, message: status.message };
  }
  if (status.booting) {
    return { started: false, message: status.message };
  }

  const bin = resolveEmulatorBin();
  const args = ["-avd", avdName, "-timezone", DEFAULT_TIMEZONE];

  await new Promise<void>((resolve, reject) => {
    const child = spawn(bin, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    });
    child.on("error", reject);
    child.unref();
    resolve();
  });

  return {
    started: true,
    message: `Iniciando ${avdName} — o boot pode levar 1–2 minutos`,
  };
}

export async function waitForAndroidDevice(options?: {
  timeoutMs?: number;
  pollMs?: number;
  onTick?: (status: AndroidDeviceStatus) => void;
}): Promise<AndroidDeviceStatus> {
  const timeoutMs = options?.timeoutMs ?? 180_000;
  const pollMs = options?.pollMs ?? 2_000;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const status = await getAndroidDeviceStatus();
    options?.onTick?.(status);
    if (status.ready) return status;
    await sleep(pollMs);
  }

  const last = await getAndroidDeviceStatus();
  throw new Error(
    last.ready
      ? last.message
      : `Timeout aguardando device (${Math.round(timeoutMs / 1000)}s) — ${last.message}`,
  );
}

const SYSTEM_OVERLAY_PACKAGES = [
  "com.google.android.documentsui",
  "com.android.documentsui",
  "com.google.android.providers.media.module",
  "com.android.intentresolver",
  "com.google.android.apps.photos",
  "com.android.gallery3d",
];

async function forceStopPackages(packages: string[]): Promise<void> {
  for (const pkg of packages) {
    try {
      await execFileAsync("adb", ["shell", "am", "force-stop", pkg], {
        timeout: 8_000,
        windowsHide: true,
      });
    } catch {
      /* pacote ausente no AVD */
    }
  }
}

/**
 * Fecha overlays do sistema que bloqueiam o app (picker de arquivo/galeria).
 * Cascata típica: CT de anexo deixa DocumentsUI na frente → todos os CTs
 * seguintes falham no resume (não veem ENTRAR / Pedro Jesus / MURAL).
 */
export async function dismissAndroidSystemOverlays(options?: {
  onProgress?: (message: string) => void;
}): Promise<void> {
  try {
    await forceStopPackages(SYSTEM_OVERLAY_PACKAGES);
    // Vários Back: um só não basta se o picker empilhou Activities
    for (let i = 0; i < 4; i++) {
      try {
        await execFileAsync("adb", ["shell", "input", "keyevent", "4"], {
          timeout: 5_000,
          windowsHide: true,
        });
      } catch {
        break;
      }
    }
    // Segunda passada — DocumentsUI às vezes revive após o Back
    await forceStopPackages([
      "com.google.android.documentsui",
      "com.android.documentsui",
    ]);
    options?.onProgress?.(
      "Overlays do sistema (picker/arquivo) fechados antes do Maestro",
    );
  } catch {
    /* device offline — ensureAndroidDeviceReady já falha depois */
  }
}

/** PDF/vídeo no /sdcard/Download — obrigatório para ANEXO-02/03 e E2E-99. */
export async function ensureMaestroFixturesOnDevice(options?: {
  onProgress?: (message: string) => void;
}): Promise<void> {
  const fromEnv = process.env.QA_MAESTRO_FIXTURES_DIR?.trim();
  // cwd pode ser qa-desk/ ou maestro/ — resolve ambos + caminho relativo a este arquivo
  const candidates = [
    fromEnv ? path.resolve(fromEnv) : "",
    path.resolve(
      process.cwd(),
      "../projects/polygonus/automation/maestro/fixtures",
    ),
    path.resolve(
      process.cwd(),
      "projects/polygonus/automation/maestro/fixtures",
    ),
    path.resolve(process.cwd(), "fixtures"),
    path.resolve(process.cwd(), "../fixtures"),
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../projects/polygonus/automation/maestro/fixtures",
    ),
  ].filter(Boolean);
  const dir = candidates.find((d) => fs.existsSync(d));
  if (!dir) {
    options?.onProgress?.(
      `Aviso: pasta fixtures não encontrada (tentou ${candidates[0]})`,
    );
    return;
  }

  const files = ["PDF_TESTE.pdf", "PDF TESTE.pdf", "Video_teste.mp4"];
  try {
    await execFileAsync("adb", ["shell", "mkdir", "-p", "/sdcard/Download"], {
      timeout: 8_000,
      windowsHide: true,
    });
  } catch {
    /* ignore */
  }

  for (const name of files) {
    const src = path.join(dir, name);
    if (!fs.existsSync(src)) {
      options?.onProgress?.(`Aviso: fixture ausente — ${src}`);
      continue;
    }
    try {
      await execFileAsync(
        "adb",
        ["push", src, `/sdcard/Download/${name}`],
        { timeout: 60_000, windowsHide: true },
      );
      options?.onProgress?.(`Fixture no device: /sdcard/Download/${name}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      options?.onProgress?.(`Aviso: adb push falhou (${name}): ${msg}`);
    }
  }
}

/** Fixa America/Sao_Paulo + relógio 24h + **data/hora atuais** (evita mural em “ontem”). */
export async function ensureEmulatorTimezoneBr(options?: {
  timezone?: string;
  onProgress?: (message: string) => void;
}): Promise<void> {
  const tz = options?.timezone ?? DEFAULT_TIMEZONE;
  try {
    await execFileAsync(
      "adb",
      ["shell", "settings", "put", "global", "auto_time_zone", "0"],
      { timeout: 8_000, windowsHide: true },
    );
    await execFileAsync(
      "adb",
      ["shell", "settings", "put", "global", "auto_time", "0"],
      { timeout: 8_000, windowsHide: true },
    );
    await execFileAsync(
      "adb",
      ["shell", "settings", "put", "global", "time_zone", tz],
      { timeout: 8_000, windowsHide: true },
    );
    // Formato 12h no device pode gerar payload de horário inválido no composer de evento
    try {
      await execFileAsync(
        "adb",
        ["shell", "settings", "put", "system", "time_12_24", "24"],
        { timeout: 8_000, windowsHide: true },
      );
      await execFileAsync(
        "adb",
        ["shell", "settings", "put", "secure", "time_12_24", "24"],
        { timeout: 8_000, windowsHide: true },
      );
    } catch {
      /* ignore */
    }
    try {
      await execFileAsync(
        "adb",
        ["shell", "setprop", "persist.sys.timezone", tz],
        { timeout: 8_000, windowsHide: true },
      );
    } catch {
      /* user builds */
    }
    // settings sozinho às vezes deixa `date` em GMT — alarm binder aplica o fuso
    try {
      await execFileAsync(
        "adb",
        ["shell", "service", "call", "alarm", "3", "s16", tz],
        { timeout: 8_000, windowsHide: true },
      );
    } catch {
      /* ignore */
    }

    await syncEmulatorWallClock({ onProgress: options?.onProgress });

    const { stdout } = await execFileAsync(
      "adb",
      ["shell", "settings", "get", "global", "time_zone"],
      { timeout: 8_000, windowsHide: true },
    );
    let dateLine = "";
    try {
      const d = await execFileAsync("adb", ["shell", "date"], {
        timeout: 8_000,
        windowsHide: true,
      });
      dateLine = String(d.stdout ?? "").trim();
    } catch {
      /* ignore */
    }
    let clockFmt = "";
    try {
      const c = await execFileAsync(
        "adb",
        ["shell", "settings", "get", "system", "time_12_24"],
        { timeout: 8_000, windowsHide: true },
      );
      clockFmt = String(c.stdout ?? "").trim();
    } catch {
      /* ignore */
    }
    const current = String(stdout ?? "").trim();
    const gmtOk = /-[0-9]{2}\b|BRT|America/.test(dateLine) && !/\bGMT\b/.test(dateLine);
    options?.onProgress?.(
      current === tz && gmtOk
        ? `Timezone+clock OK: ${tz} · clock=${clockFmt || "?"}h (${dateLine})`
        : `Timezone settings=${current || "?"} clock=${clockFmt || "?"} date=${dateLine || "?"} — se mural falhar por dia, reinicie o AVD`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    options?.onProgress?.(`Aviso: timezone/clock não aplicado — ${msg}`);
  }
}

/**
 * Alinha o relógio do emulador ao host (UTC epoch).
 * Builds “production” não aceitam `adb root`/`date`; usa time_detector + alarm binder.
 */
async function syncEmulatorWallClock(options?: {
  onProgress?: (message: string) => void;
}): Promise<void> {
  let elapsedMs = 0;
  try {
    const { stdout } = await execFileAsync(
      "adb",
      ["shell", "cat", "/proc/uptime"],
      { timeout: 5_000, windowsHide: true },
    );
    const sec = Number.parseFloat(String(stdout).trim().split(/\s+/)[0] ?? "");
    if (Number.isFinite(sec) && sec >= 0) elapsedMs = Math.floor(sec * 1000);
  } catch {
    elapsedMs = 0;
  }
  const unixMs = Date.now();

  try {
    await execFileAsync(
      "adb",
      ["shell", "cmd", "time_detector", "set_auto_detection_enabled", "false"],
      { timeout: 8_000, windowsHide: true },
    );
  } catch {
    /* API antiga */
  }

  let applied = false;
  try {
    await execFileAsync(
      "adb",
      [
        "shell",
        "cmd",
        "time_detector",
        "set_time_state_for_tests",
        "--elapsed_realtime",
        String(elapsedMs),
        "--unix_epoch_time",
        String(unixMs),
        "--user_should_confirm_time",
        "false",
      ],
      { timeout: 8_000, windowsHide: true },
    );
    applied = true;
  } catch {
    /* fallback abaixo */
  }

  if (!applied) {
    try {
      await execFileAsync(
        "adb",
        ["shell", "service", "call", "alarm", "2", "i64", String(unixMs)],
        { timeout: 8_000, windowsHide: true },
      );
      applied = true;
    } catch {
      /* ignore */
    }
  }

  // Acorda tela — sleep longo costuma acompanhar relógio parado
  try {
    await execFileAsync(
      "adb",
      ["shell", "input", "keyevent", "KEYCODE_WAKEUP"],
      { timeout: 5_000, windowsHide: true },
    );
  } catch {
    /* ignore */
  }

  let dateLine = "";
  try {
    const d = await execFileAsync("adb", ["shell", "date", "+%s"], {
      timeout: 5_000,
      windowsHide: true,
    });
    const deviceSec = Number.parseInt(String(d.stdout).trim(), 10);
    const hostSec = Math.floor(Date.now() / 1000);
    const drift = Number.isFinite(deviceSec) ? deviceSec - hostSec : NaN;
    const human = await execFileAsync("adb", ["shell", "date"], {
      timeout: 5_000,
      windowsHide: true,
    });
    dateLine = String(human.stdout ?? "").trim();
    if (!Number.isFinite(drift) || Math.abs(drift) > 120) {
      options?.onProgress?.(
        `Aviso: relógio do emulador desalinhado (drift=${Number.isFinite(drift) ? `${drift}s` : "?"}) — ${dateLine || "date?"} · applied=${applied}`,
      );
    } else {
      options?.onProgress?.(
        `Relógio sync OK (drift=${drift}s) — ${dateLine}`,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    options?.onProgress?.(`Aviso: não validou date do emulador — ${msg}`);
  }
}

/** Garante device `device` no adb; opcionalmente liga o emulador configurado. */
export async function ensureAndroidDeviceReady(options?: {
  autoStart?: boolean;
  onProgress?: (message: string) => void;
}): Promise<AndroidDeviceStatus> {
  const autoStart = options?.autoStart ?? isAutoEmulatorEnabled();
  let status = await getAndroidDeviceStatus();

  if (status.ready) return status;

  if (status.booting) {
    options?.onProgress?.(status.message);
    return waitForAndroidDevice({
      onTick: (s) => {
        if (s.message !== status.message) {
          status = s;
          options?.onProgress?.(s.message);
        }
      },
    });
  }

  if (!autoStart) {
    throw new Error(
      `${status.message}. Ligue o emulador ou defina QA_ANDROID_AUTO_EMULATOR=1`,
    );
  }

  options?.onProgress?.(`Nenhum device — iniciando ${status.avdName}…`);
  const start = await startAndroidEmulator();
  options?.onProgress?.(start.message);

  return waitForAndroidDevice({
    onTick: (s) => options?.onProgress?.(s.message),
  });
}
