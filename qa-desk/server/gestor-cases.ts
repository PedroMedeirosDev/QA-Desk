/**
 * Repasse ao gestor (Moacir) — casos numerados por analista, mensagem Discord.
 * Persistência: data/projects/{slug}/gestor-cases.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ProjectSlug } from "./types.js";
import { ensureDirs } from "./storage.js";

export type GestorCaseStatus = "pendente" | "devolvido";
export type GestorCaseEntryKind = "intro" | "continuacao";

export interface GestorCaseEntry {
  at: string;
  kind: GestorCaseEntryKind;
  body: string;
}

export interface GestorCase {
  id: string;
  number: number;
  author: string;
  title: string;
  status: GestorCaseStatus;
  discordUrl: string;
  internalRef?: string;
  linkedTestId?: string;
  entries: GestorCaseEntry[];
  createdAt: string;
  updatedAt: string;
  devolvidoAt?: string;
}

export interface GestorCasesCatalog {
  meta: { project: ProjectSlug; updatedAt: string };
  cases: GestorCase[];
  lastNumberByAuthor: Record<string, number>;
  /** Canal onde o analista cola o report (não é o link da mensagem). */
  discordChannelUrl?: string;
}

/** Canal do report ao Moacir (Polygonus). */
export const POLYGONUS_GESTOR_DISCORD_CHANNEL =
  "https://discord.com/channels/1339775689209024612/1524389844153925662";

export function defaultDiscordChannelUrl(project: ProjectSlug): string | undefined {
  return project === "polygonus" ? POLYGONUS_GESTOR_DISCORD_CHANNEL : undefined;
}

export function discordUrlKind(url: string): "message" | "channel" | "other" {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace(/^www\./, "");
    if (!["discord.com", "canary.discord.com", "ptb.discord.com"].includes(host)) {
      return "other";
    }
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts[0] !== "channels") return "other";
    const ids = parts.slice(1);
    if (ids.length >= 3 && ids.slice(0, 3).every((p) => /^\d+$/.test(p))) return "message";
    if (ids.length === 2 && ids.every((p) => /^\d+$/.test(p))) return "channel";
    return "other";
  } catch {
    return "other";
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.join(__dirname, "../data/projects");

function catalogPath(project: ProjectSlug) {
  return path.join(DATA_ROOT, project, "gestor-cases.json");
}

function emptyCatalog(project: ProjectSlug): GestorCasesCatalog {
  return {
    meta: { project, updatedAt: new Date().toISOString().slice(0, 10) },
    cases: [],
    lastNumberByAuthor: {},
    discordChannelUrl: defaultDiscordChannelUrl(project),
  };
}

export function readGestorCasesCatalog(project: ProjectSlug): GestorCasesCatalog {
  ensureDirs(project);
  const file = catalogPath(project);
  if (!fs.existsSync(file)) {
    const empty = emptyCatalog(project);
    writeGestorCasesCatalog(project, empty);
    return empty;
  }
  const catalog = JSON.parse(fs.readFileSync(file, "utf8")) as GestorCasesCatalog;
  if (!catalog.discordChannelUrl) {
    catalog.discordChannelUrl = defaultDiscordChannelUrl(project);
  }
  return catalog;
}

export function writeGestorCasesCatalog(project: ProjectSlug, catalog: GestorCasesCatalog) {
  ensureDirs(project);
  catalog.meta.updatedAt = new Date().toISOString().slice(0, 10);
  catalog.meta.project = project;
  fs.writeFileSync(catalogPath(project), `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
}

function nextCaseId(cases: GestorCase[]): string {
  const year = new Date().getFullYear();
  const max = cases.reduce((acc, c) => {
    const m = c.id.match(/^CASO-\d{4}-(\d+)$/);
    if (!m) return acc;
    const n = Number(m[1]);
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 0);
  return `CASO-${year}-${String(max + 1).padStart(3, "0")}`;
}

function nextNumberForAuthor(catalog: GestorCasesCatalog, author: string): number {
  const last = catalog.lastNumberByAuthor[author] ?? 0;
  return last + 1;
}

export function findGestorCase(catalog: GestorCasesCatalog, id: string): GestorCase | undefined {
  return catalog.cases.find((c) => c.id === id);
}

export function listCasesByAuthor(catalog: GestorCasesCatalog, author: string): GestorCase[] {
  return catalog.cases.filter((c) => c.author === author);
}

function introBody(caseItem: GestorCase): string {
  const intro = caseItem.entries.find((e) => e.kind === "intro");
  return intro?.body ?? caseItem.title;
}

function summaryLine(caseItem: GestorCase): string {
  const body = introBody(caseItem).trim();
  const firstLine = body.split(/\r?\n/).find((l) => l.trim()) ?? caseItem.title;
  return firstLine.slice(0, 200);
}

/** Linha do bloco Pendente: sempre o link da mensagem original. */
export function pendingDiscordLine(caseItem: GestorCase): string {
  const url = caseItem.discordUrl.trim();
  return url
    ? `**Caso ${caseItem.number}** — ${url}`
    : `**Caso ${caseItem.number}**`;
}

function formatDataLabel(raw: string): string {
  const n = raw.toLowerCase();
  if (n === "escola") return "Escola";
  if (n === "unidade") return "Unidade";
  if (n === "aluno") return "Aluno";
  if (n === "login") return "Login";
  if (/^per[ií]odo\s+no\s+portal$/.test(n)) return "Período no portal";
  if (/^per[ií]odo/.test(n)) return "Período";
  return raw;
}

function styleGestorLine(line: string): string {
  const t = line.trim();
  if (!t) return line;

  if (/^(\*\*)?pendente \(com link\)(\*\*)?$/i.test(t)) {
    return "**Pendente (com link)**";
  }

  const casoOnly = t.match(/^(\*\*)?caso\s+(\d+)(\*\*)?\.?$/i);
  if (casoOnly) return `**Caso ${casoOnly[2]}**`;

  const casoLink = t.match(/^(\*\*)?caso\s+(\d+)(\*\*)?\s+[—–-]\s+(\S+)/i);
  if (casoLink) return `**Caso ${casoLink[2]}** — ${casoLink[4]}`;

  const cont = t.match(/^(\*\*)?continua[cç][aã]o do caso\s+(\d+)\.?(\*\*)?$/i);
  if (cont) return `**Continuação do caso ${cont[2]}.**`;

  if (/^\*\*[^*]+:\*\*/.test(t)) return line;

  const casoTitle = t.match(/^(\*\*)?caso\s+(\d+)(\*\*)?:\s+(.+)$/i);
  if (casoTitle) return `**Caso ${casoTitle[2]}:** ${casoTitle[4]}`;

  const erro = t.match(/^erro exibido\s*:\s*(.*)$/i);
  if (erro) {
    const rest = erro[1].trim().replace(/^"([^"]+)"$/, '**"$1"**');
    return `**Erro exibido:** ${rest}`;
  }

  const combo = t.match(
    /^login\s*:\s*(.+?)\s+\|\s+per[ií]odo(?:\s+no\s+portal)?\s*:\s*(.+)$/i,
  );
  if (combo) {
    const login = combo[1].trim().replace(/^`|`$/g, "");
    const periodo = combo[2].trim().replace(/^`|`$/g, "");
    return `**Login:** \`${login}\`  |  **Período:** \`${periodo}\``;
  }

  const label = t.match(
    /^(escola|unidade|aluno|login|per[ií]odo(?:\s+no\s+portal)?)\s*:\s*(.*)$/i,
  );
  if (label) {
    const name = formatDataLabel(label[1]);
    const value = label[2].trim().replace(/^`|`$/g, "");
    const key = label[1].toLowerCase();
    if (key === "login" || /^per[ií]odo/.test(key)) {
      return `**${name}:** \`${value}\``;
    }
    return `**${name}:** ${value}`;
  }

  const section = t.match(
    /^(confer[eê]ncias(?:\s+ok)?|obs(?:erva[cç][aã]o)?)\s*:?\s*(.*)$/i,
  );
  if (section) {
    const isObs = /^obs/i.test(section[1]);
    const name = isObs
      ? "Obs"
      : /ok$/i.test(section[1])
        ? "Conferências OK"
        : "Conferências";
    const rest = section[2].trim();
    return rest ? `**${name}:** ${rest}` : `**${name}**`;
  }

  const bullet = t.match(/^([-*])\s+(?:\*\*)?([^:*]+):(?:\*\*)?\s*(.*)$/);
  if (bullet) {
    return `${bullet[1]} **${bullet[2].trim()}:** ${bullet[3]}`;
  }

  if (!t.startsWith("**") && /"/.test(t)) {
    return line.replace(/"([^"]{8,})"/g, '**"$1"**');
  }

  return line;
}

/** Markdown que o Discord renderiza — só na cópia, a descrição no bug fica simples. */
export function applyDiscordGestorStyle(text: string): string {
  return text.split(/\r?\n/).map(styleGestorLine).join("\n");
}

/** Monta texto Discord para novo caso (intro) com bloco Pendente. */
export function composeIntroMessage(
  catalog: GestorCasesCatalog,
  author: string,
  newCase: GestorCase,
): string {
  const lines: string[] = [];
  const pendentes = listCasesByAuthor(catalog, author).filter(
    (c) => c.status === "pendente" && c.id !== newCase.id,
  );

  if (pendentes.length > 0) {
    lines.push("**Pendente (com link)**");
    for (const p of pendentes.sort((a, b) => a.number - b.number)) {
      lines.push(pendingDiscordLine(p));
      const sum = summaryLine(p);
      if (sum) lines.push(applyDiscordGestorStyle(sum));
      lines.push("");
    }
  }

  lines.push(composeOwnCaseMessage(newCase));
  return lines.join("\n").trimEnd();
}

/** Só este caso — o que aparece no card e o que o Grok / analista manda. */
export function composeOwnCaseMessage(caseItem: GestorCase): string {
  const title = caseItem.title.trim();
  const lines = [
    title ? `**Caso ${caseItem.number}:** ${title}` : `**Caso ${caseItem.number}**`,
  ];
  const body = introBody(caseItem)
    .trim()
    .replace(new RegExp(`^(\\*\\*)?caso\\s+${caseItem.number}(\\*\\*)?:\\s*.+\\n*`, "i"), "")
    .trim();
  if (body) lines.push(applyDiscordGestorStyle(body));
  return lines.join("\n").trimEnd();
}

/** Monta texto Discord para continuação (sem bloco Pendente). */
export function composeContinuacaoMessage(caseItem: GestorCase, body: string): string {
  return `**Continuação do caso ${caseItem.number}.**\n${applyDiscordGestorStyle(body.trim())}`;
}

export function createGestorCase(
  catalog: GestorCasesCatalog,
  input: {
    author: string;
    title: string;
    body: string;
    discordUrl?: string;
    internalRef?: string;
    linkedTestId?: string;
  },
): GestorCase {
  const now = new Date().toISOString();
  const number = nextNumberForAuthor(catalog, input.author);
  const caseItem: GestorCase = {
    id: nextCaseId(catalog.cases),
    number,
    author: input.author,
    title: input.title.trim(),
    status: "pendente",
    discordUrl: (input.discordUrl ?? "").trim(),
    internalRef: input.internalRef?.trim() || undefined,
    linkedTestId: input.linkedTestId?.trim() || undefined,
    entries: [
      {
        at: now,
        kind: "intro",
        body: input.body.trim(),
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
  catalog.cases.push(caseItem);
  catalog.lastNumberByAuthor[input.author] = number;
  return caseItem;
}

export function appendContinuacao(
  caseItem: GestorCase,
  body: string,
): GestorCaseEntry {
  const entry: GestorCaseEntry = {
    at: new Date().toISOString(),
    kind: "continuacao",
    body: body.trim(),
  };
  caseItem.entries.push(entry);
  caseItem.updatedAt = entry.at;
  return entry;
}

export function markGestorCaseDevolvido(caseItem: GestorCase): void {
  const now = new Date().toISOString();
  caseItem.status = "devolvido";
  caseItem.devolvidoAt = now;
  caseItem.updatedAt = now;
}

export function reopenGestorCase(caseItem: GestorCase): void {
  caseItem.status = "pendente";
  caseItem.devolvidoAt = undefined;
  caseItem.updatedAt = new Date().toISOString();
}

export function updateGestorCaseDiscordUrl(caseItem: GestorCase, discordUrl: string): void {
  caseItem.discordUrl = discordUrl.trim();
  caseItem.updatedAt = new Date().toISOString();
}

/** Bug ainda na mesa do gestor — é o que entra na lista do Repasse. */
export const BUG_STATUSES_WITH_GESTOR = ["enviado_gestor", "em_tratamento"] as const;

export function isBugWithGestor(status: string): boolean {
  return (BUG_STATUSES_WITH_GESTOR as readonly string[]).includes(status);
}

export function replaceGestorCaseIntro(
  caseItem: GestorCase,
  title: string,
  body: string,
): void {
  const now = new Date().toISOString();
  if (title.trim()) caseItem.title = title.trim();
  const intro = caseItem.entries.find((e) => e.kind === "intro");
  if (intro) {
    intro.body = body.trim();
    intro.at = now;
  } else {
    caseItem.entries.unshift({ at: now, kind: "intro", body: body.trim() });
  }
  caseItem.updatedAt = now;
}

export function findGestorCaseByLinkedTest(
  catalog: GestorCasesCatalog,
  testId: string,
  author: string,
): GestorCase | undefined {
  return catalog.cases.find((c) => c.linkedTestId === testId && c.author === author);
}

/** Texto do Discord a partir do bug do Desk. */
export function attachableEvidenceNames(
  evidence?: Array<{ filename?: string; type?: string }>,
): string[] {
  return (evidence ?? [])
    .filter((e) => e.type === "screenshot" || e.type === "video")
    .map((e) => e.filename?.trim())
    .filter((n): n is string => Boolean(n));
}

const REDACTED_LOGIN_RE = /^\[(CPF|CNPJ|EMAIL|TELEFONE|CONFIDENCIAL)\]$/i;

/** Login gravado de verdade — não o token [CPF] de um save antigo. */
export function isUsableGestorLogin(value?: string): boolean {
  const v = value?.trim() ?? "";
  return Boolean(v) && !REDACTED_LOGIN_RE.test(v);
}

function stripPlaceholderLoginLines(desc: string): string {
  return desc
    .split(/\r?\n/)
    .filter((line) => {
      const m = line.match(/^login\s*:\s*(.*)$/i);
      if (!m) return true;
      return isUsableGestorLogin(m[1]);
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function descriptionHasLoginLine(desc: string): boolean {
  return desc.split(/\r?\n/).some((line) => {
    const m = line.match(/^login\s*:\s*(.*)$/i);
    return Boolean(m && isUsableGestorLogin(m[1]));
  });
}

/** Escola / aluno / período — o login entra no fim dessa lista, não depois da obs. */
const GESTOR_DATA_LINE_RE =
  /^(escola|unidade|aluno|per[ií]odo(?:\s+no\s+portal)?)\s*:/i;

function insertLoginAfterDataList(desc: string, login: string): string {
  if (descriptionHasLoginLine(desc)) return desc;
  const lines = desc.split(/\r?\n/);
  const periodoIdx = lines.findIndex((l) =>
    /^per[ií]odo(?:\s+no\s+portal)?\s*:/i.test(l.trim()),
  );
  if (periodoIdx >= 0) {
    const value = lines[periodoIdx]
      .replace(/^per[ií]odo(?:\s+no\s+portal)?\s*:\s*/i, "")
      .trim();
    lines[periodoIdx] = `Login: ${login}  |  Período: ${value}`;
    return lines.join("\n").trim();
  }
  let lastData = -1;
  for (let i = 0; i < lines.length; i++) {
    if (GESTOR_DATA_LINE_RE.test(lines[i].trim())) lastData = i;
  }
  const loginLine = `Login: ${login}`;
  if (lastData >= 0) {
    lines.splice(lastData + 1, 0, loginLine);
    return lines.join("\n").trim();
  }
  return `${desc.trim()}\n\n${loginLine}`;
}

/**
 * Texto do gestor: o que o analista escreveu + login inteiro.
 * Arquivo vai na mesma mensagem do Discord — sem linha de anexos.
 * Ambiente, unidade, device, obtido, esperado e passos ficam no bug.
 */
export function composeGestorBodyFromBug(bug: {
  description?: string;
  testLogin?: string;
  deviceLabel?: string;
  runtimeEnv?: "amostra" | "producao";
  unitLabel?: string;
  actualResult?: string;
  expectedResult?: string;
  steps?: string[];
  technicalEvidence?: string;
  evidence?: Array<{ filename?: string; type?: string }>;
}): string {
  const desc = stripPlaceholderLoginLines(bug.description?.trim() ?? "");
  const login = bug.testLogin?.trim() ?? "";
  if (!isUsableGestorLogin(login)) return desc;
  if (!desc) return `Login: ${login}`;
  return insertLoginAfterDataList(desc, login);
}

/**
 * Lista do Repasse = o que está com o gestor.
 * Corrigido / sem correção / homologado / rascunho: sai (mesmo se o bug continuar aberto).
 * Se o bug voltar para enviado/em tratamento, o caso reabre.
 */
export function syncGestorCasesForBug(
  project: ProjectSlug,
  bugId: string,
  status: string,
): boolean {
  const catalog = readGestorCasesCatalog(project);
  if (!applyBugStatusToGestorCases(catalog, bugId, status)) return false;
  writeGestorCasesCatalog(project, catalog);
  return true;
}

export function applyBugStatusToGestorCases(
  catalog: GestorCasesCatalog,
  bugId: string,
  status: string,
): boolean {
  const withGestor = isBugWithGestor(status);
  let changed = false;
  for (const caseItem of catalog.cases) {
    if (caseItem.linkedTestId !== bugId) continue;
    if (withGestor && caseItem.status === "devolvido") {
      reopenGestorCase(caseItem);
      changed = true;
    } else if (!withGestor && caseItem.status === "pendente") {
      markGestorCaseDevolvido(caseItem);
      changed = true;
    }
  }
  return changed;
}
