import { execFileSync } from "node:child_process";

function adbBin(): string {
  const home = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  if (home) {
    return process.platform === "win32"
      ? `${home}\\platform-tools\\adb.exe`
      : `${home}/platform-tools/adb`;
  }
  return process.platform === "win32" ? "adb.exe" : "adb";
}

function sleepMs(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function adbShell(args: string[]): string {
  return execFileSync(adbBin(), ["shell", ...args], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  }).trim();
}

/** Dump com retry — uiautomator costuma falhar (exit 137) logo após o Maestro soltar o device. */
function dumpUiXml(): string {
  let lastErr: unknown;
  // Espera inicial: instrumentation Maestro ainda pode segurar o device.
  sleepMs(2500);
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      if (attempt > 1) sleepMs(2000 * attempt);
      adbShell(["uiautomator", "dump", "/sdcard/uidump_mural_qa.xml"]);
      return adbShell(["cat", "/sdcard/uidump_mural_qa.xml"]);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(`uiautomator dump falhou após retries: ${String(lastErr)}`);
}

function decodeDesc(raw: string): string {
  return raw.replace(/&#10;/g, " ").replace(/&amp;/g, "&");
}

function idFromMenuDesc(desc: string): string | null {
  const idMatch = decodeDesc(desc).match(/ID\s*([0-9]+)/);
  return idMatch?.[1] ? `ID ${idMatch[1]}` : null;
}

/** Lê o ID do N-ésimo card Mural (0 = mais recente em Enviadas). */
export function captureMuralCardId(cardIndex = 0): string | null {
  const index = Number.isFinite(cardIndex) && cardIndex >= 0 ? Math.floor(cardIndex) : 0;
  const xml = dumpUiXml();

  const pattern = /resource-id="mural_card_menu"[^>]*content-desc="([^"]*)"/g;
  let match: RegExpExecArray | null = null;
  for (let i = 0; i <= index; i++) {
    match = pattern.exec(xml);
    if (!match) return null;
  }

  return idFromMenuDesc(match[1]);
}

export type MuralCardSnapshot = {
  idComunicado: string;
  contentDesc: string;
};

/** Lista IDs visíveis (ordem da hierarquia = topo → baixo). */
export function listMuralCardIds(): MuralCardSnapshot[] {
  const xml = dumpUiXml();
  const pattern = /resource-id="mural_card_menu"[^>]*content-desc="([^"]*)"/g;
  const out: MuralCardSnapshot[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml))) {
    const id = idFromMenuDesc(match[1]);
    if (id) {
      out.push({ idComunicado: id, contentDesc: decodeDesc(match[1]) });
    }
  }
  return out;
}

/**
 * Confirma que o texto está na UI e que o 1º card (mais recente) tem o ID esperado.
 * Usado após editar: texto novo no topo + mesmo ID capturado antes.
 */
export function assertTopCardMatches(opts: {
  expectedId: string;
  expectedText: string;
}): { ok: true; idComunicado: string } | { ok: false; reason: string; topId?: string | null } {
  const xml = dumpUiXml();
  const expectedDigits = opts.expectedId.replace(/[^0-9]/g, "");
  const expectedLabel = `ID ${expectedDigits}`;

  if (!xml.includes(opts.expectedText)) {
    return {
      ok: false,
      reason: `Texto não encontrado na UI: "${opts.expectedText}"`,
    };
  }

  const pattern = /resource-id="mural_card_menu"[^>]*content-desc="([^"]*)"/g;
  const first = pattern.exec(xml);
  const topId = first ? idFromMenuDesc(first[1]) : null;

  if (!topId) {
    return { ok: false, reason: "Nenhum mural_card_menu com ID na hierarquia", topId };
  }

  if (topId !== expectedLabel) {
    return {
      ok: false,
      reason: `ID do card no topo diverge após edição: esperado ${expectedLabel}, atual ${topId}. O texto novo pode ter gerado outro comunicado.`,
      topId,
    };
  }

  // content-desc do topo deve mencionar o ID (validação cruzada)
  const topDesc = decodeDesc(first![1]);
  if (!topDesc.includes(expectedDigits)) {
    return {
      ok: false,
      reason: `content-desc do topo não contém ${expectedLabel}`,
      topId,
    };
  }

  return { ok: true, idComunicado: topId };
}

/** Confirma que o ID sumiu da lista (após excluir). */
export function assertCardIdAbsent(expectedId: string): {
  ok: true;
} | { ok: false; reason: string } {
  const digits = expectedId.replace(/[^0-9]/g, "");
  const cards = listMuralCardIds();
  const found = cards.find((c) => c.idComunicado.replace(/[^0-9]/g, "") === digits);
  if (found) {
    return {
      ok: false,
      reason: `ID ${digits} ainda visível na lista após exclusão`,
    };
  }
  return { ok: true };
}
