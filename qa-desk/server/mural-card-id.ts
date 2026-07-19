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

type CardMenuNode = {
  text: string;
  contentDesc: string;
  rawTag: string;
};

/** Extrai nodes mural_card_menu (attrs em qualquer ordem). */
function parseMuralCardMenus(xml: string): CardMenuNode[] {
  const tags = xml.match(/<node\b[^>]*resource-id="mural_card_menu"[^>]*>/g) ?? [];
  return tags.map((rawTag) => ({
    rawTag,
    text: (rawTag.match(/\btext="([^"]*)"/) || [])[1] ?? "",
    contentDesc: decodeDesc((rawTag.match(/\bcontent-desc="([^"]*)"/) || [])[1] ?? ""),
  }));
}

/**
 * Lê o ID do N-ésimo card Mural (0 = mais recente em Enviadas).
 *
 * Comunicado: ID vem no content-desc de mural_card_menu.
 * Evento: o badge "ID N" pode aparecer VISUALMENTE, mas o content-desc fica
 * vazio (só text=titulo) — uiautomator não vê o ID. Nesse caso retorna null
 * e loga o diagnóstico (BUG-2026-004).
 */
export function captureMuralCardId(cardIndex = 0): string | null {
  const index = Number.isFinite(cardIndex) && cardIndex >= 0 ? Math.floor(cardIndex) : 0;
  const xml = dumpUiXml();
  const cards = parseMuralCardMenus(xml);
  const card = cards[index];
  if (!card) {
    console.warn(
      `[mural-card-id] card index ${index} ausente (só ${cards.length} mural_card_menu)`,
    );
    return null;
  }

  const fromDesc = idFromMenuDesc(card.contentDesc);
  if (fromDesc) return fromDesc;

  // Fallback: text="ID 123" no próprio tag (raro)
  const fromTextAttr = card.text.match(/^ID\s*([0-9]+)$/i);
  if (fromTextAttr?.[1]) return `ID ${fromTextAttr[1]}`;

  // Diagnóstico — típico de Evento: text preenchido, content-desc vazio, ID só no pixel
  const anyIdInXml = [...xml.matchAll(/(?:text|content-desc)="([^"]*ID\s*[0-9]+[^"]*)"/g)].map(
    (m) => decodeDesc(m[1]).slice(0, 80),
  );
  console.warn(
    `[mural-card-id] card#${index} SEM ID na acessibilidade` +
      ` · text=${JSON.stringify(card.text)}` +
      ` · content-desc=${JSON.stringify(card.contentDesc.slice(0, 60))}` +
      ` · IDs visíveis noutros nodes: ${anyIdInXml.length ? anyIdInXml.join(" || ") : "(nenhum)"}` +
      ` · (se o badge aparece na tela = BUG-2026-004: falta Semantics no evento)`,
  );
  return null;
}

export type MuralCardSnapshot = {
  idComunicado: string;
  contentDesc: string;
};

/** Lista IDs visíveis (ordem da hierarquia = topo → baixo). */
export function listMuralCardIds(): MuralCardSnapshot[] {
  const xml = dumpUiXml();
  const out: MuralCardSnapshot[] = [];
  for (const card of parseMuralCardMenus(xml)) {
    const id = idFromMenuDesc(card.contentDesc);
    if (id) {
      out.push({ idComunicado: id, contentDesc: card.contentDesc });
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
