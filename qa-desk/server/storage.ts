import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDatabaseEnabled } from "./db/config.js";
import { readCatalogFromDb, writeCatalogToDb } from "./db/pg-catalog.js";
import { findHomologationBySlug, readHomologationCatalog } from "./homologations.js";
import { redactPiiDeep } from "./privacy/redact-pii.js";
import { normalizeCatalog } from "./test-key.js";
import type { HistoryEntry, ProductChannel, ProjectSlug, TestCatalog, TestRecord } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.join(__dirname, "../data/projects");
const UPLOADS_ROOT = path.join(__dirname, "../data/uploads");

const VALID_PROJECTS = new Set<ProjectSlug>(["polygonus", "anihype", "desk"]);

export function assertProject(slug: string): ProjectSlug {
  if (!VALID_PROJECTS.has(slug as ProjectSlug)) {
    throw new Error(`Projeto inválido: ${slug}`);
  }
  return slug as ProjectSlug;
}

function catalogPath(project: ProjectSlug) {
  return path.join(DATA_ROOT, project, "tests.json");
}

function legacyCatalogPath(project: ProjectSlug) {
  return path.join(DATA_ROOT, project, "bugs.json");
}

function migrateLegacyCatalog(project: ProjectSlug) {
  const legacy = legacyCatalogPath(project);
  const current = catalogPath(project);
  if (!fs.existsSync(legacy) || fs.existsSync(current)) return;
  fs.copyFileSync(legacy, current);
}

export function ensureDirs(project: ProjectSlug) {
  fs.mkdirSync(path.join(DATA_ROOT, project), { recursive: true });
  fs.mkdirSync(path.join(UPLOADS_ROOT, project), { recursive: true });
}

function readCatalogFromFile(project: ProjectSlug): TestCatalog {
  ensureDirs(project);
  migrateLegacyCatalog(project);
  const file = catalogPath(project);
  if (!fs.existsSync(file)) {
    const empty: TestCatalog = {
      meta: { version: "1.0.0", updatedAt: new Date().toISOString().slice(0, 10), project },
      reports: [],
    };
    fs.writeFileSync(file, JSON.stringify(empty, null, 2));
    return empty;
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as TestCatalog;
}

function writeCatalogToFile(project: ProjectSlug, catalog: TestCatalog) {
  ensureDirs(project);
  catalog.meta.updatedAt = new Date().toISOString().slice(0, 10);
  catalog.meta.project = project;
  fs.writeFileSync(catalogPath(project), `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
}

async function normalizeAndLinkHomologations(
  project: ProjectSlug,
  raw: TestCatalog,
): Promise<{ catalog: TestCatalog; changed: boolean }> {
  const { catalog, changed } = normalizeCatalog(raw);
  const homCatalog = await readHomologationCatalog(project);
  let homChanged = false;
  for (const report of catalog.reports) {
    if (!report.campaign && !report.homologationId) continue;
    const hom = report.campaign
      ? findHomologationBySlug(homCatalog, report.campaign)
      : report.homologationId
        ? homCatalog.homologations.find((h) => h.id === report.homologationId)
        : undefined;
    if (hom && report.homologationId !== hom.id) {
      report.homologationId = hom.id;
      homChanged = true;
    }
  }
  return { catalog, changed: changed || homChanged };
}

export async function readCatalog(project: ProjectSlug): Promise<TestCatalog> {
  if (isDatabaseEnabled()) {
    let catalog = await readCatalogFromDb(project);
    if (catalog.reports.length === 0) {
      const fromFile = readCatalogFromFile(project);
      if (fromFile.reports.length > 0) {
        const { catalog: normalized, changed } = await normalizeAndLinkHomologations(
          project,
          fromFile,
        );
        await writeCatalogToDb(project, normalized);
        if (changed) writeCatalogToFile(project, normalized);
        return normalized;
      }
    }
    // Postgres já é fonte de verdade — não re-normaliza / não re-lê homologações em todo GET
    // (isso dobrava a latência remota em cada lista de testes).
    return catalog;
  }

  const raw = readCatalogFromFile(project);
  const { catalog, changed } = await normalizeAndLinkHomologations(project, raw);
  if (changed) writeCatalogToFile(project, catalog);
  return catalog;
}

export async function writeCatalog(project: ProjectSlug, catalog: TestCatalog): Promise<void> {
  const safe = redactPiiDeep(catalog);
  catalog.meta = safe.meta;
  catalog.reports = safe.reports;
  catalog.meta.updatedAt = new Date().toISOString().slice(0, 10);
  catalog.meta.project = project;
  if (isDatabaseEnabled()) {
    await writeCatalogToDb(project, catalog);
    return;
  }
  writeCatalogToFile(project, catalog);
}

/** Lê o JSON do disco (migração / backup), sem Postgres. */
export function readCatalogFileOnly(project: ProjectSlug): TestCatalog {
  return readCatalogFromFile(project);
}

export function appendHistory(
  report: TestRecord,
  entry: Omit<HistoryEntry, "at"> & { at?: string },
) {
  report.history.push({
    at: entry.at ?? new Date().toISOString(),
    actor: entry.actor,
    action: entry.action,
    detail: entry.detail,
    meta: entry.meta,
  });
}

export function nextTestId(project: ProjectSlug, catalog: TestCatalog) {
  return nextRecordId(project, catalog, "teste");
}

export function nextBugId(project: ProjectSlug, catalog: TestCatalog) {
  return nextRecordId(project, catalog, "bug");
}

/** Código público: APP-01, WEB-02… (por canal; independente do id BUG-YYYY-NNN). */
export function nextBugCode(
  catalog: TestCatalog,
  channel?: ProductChannel,
  platform?: TestRecord["platform"],
): string {
  const prefix = bugCodePrefix(channel, platform);
  const re = new RegExp(`^${prefix}-(\\d+)$`, "i");
  const nums = catalog.reports
    .map((r) => r.bugCode?.trim().match(re))
    .filter(Boolean)
    .map((m) => parseInt(m![1], 10));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}-${String(next).padStart(2, "0")}`;
}

function bugCodePrefix(
  channel?: ProductChannel,
  platform?: TestRecord["platform"],
): string {
  if (channel === "app") return "APP";
  if (channel === "web") return "WEB";
  if (channel === "portal") return "PORTAL";
  if (platform === "android" || platform === "ios") return "APP";
  if (platform === "web") return "WEB";
  if (platform === "api") return "API";
  return "BUG";
}

function nextRecordId(
  project: ProjectSlug,
  catalog: TestCatalog,
  recordType: "teste" | "bug",
) {
  const prefix = recordType === "bug" ? "BUG" : "TEST";
  const year = new Date().getFullYear();
  const re = new RegExp(`^${prefix}-${year}-(\\d+)$`);
  const nums = catalog.reports
    .map((r) => r.id.match(re))
    .filter(Boolean)
    .map((m) => parseInt(m![1], 10));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}-${year}-${String(next).padStart(3, "0")}`;
}

export function uploadsDir(project: ProjectSlug, testId: string) {
  const dir = path.join(UPLOADS_ROOT, project, testId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export { DATA_ROOT, UPLOADS_ROOT };
