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
  return url ? `Caso ${caseItem.number} — ${url}` : `Caso ${caseItem.number}`;
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
    lines.push("Pendente (com link)");
    for (const p of pendentes.sort((a, b) => a.number - b.number)) {
      lines.push(pendingDiscordLine(p));
      const sum = summaryLine(p);
      if (sum) lines.push(sum);
      lines.push("");
    }
  }

  lines.push(`Caso ${newCase.number}`);
  lines.push(introBody(newCase).trim());
  return lines.join("\n").trimEnd();
}

/** Monta texto Discord para continuação (sem bloco Pendente). */
export function composeContinuacaoMessage(caseItem: GestorCase, body: string): string {
  return `Continuação do caso ${caseItem.number}.\n${body.trim()}`;
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

export function updateGestorCaseDiscordUrl(caseItem: GestorCase, discordUrl: string): void {
  caseItem.discordUrl = discordUrl.trim();
  caseItem.updatedAt = new Date().toISOString();
}
