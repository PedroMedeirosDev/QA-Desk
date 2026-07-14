import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findHomologationBySlug, readHomologationCatalog } from "./homologations.js";
import { normalizeCatalog } from "./test-key.js";
import type { HistoryEntry, ProjectSlug, TestCatalog, TestRecord } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.join(__dirname, "../data/projects");
const UPLOADS_ROOT = path.join(__dirname, "../data/uploads");

const VALID_PROJECTS = new Set<ProjectSlug>(["polygonus", "anihype"]);

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

export function readCatalog(project: ProjectSlug): TestCatalog {
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
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as TestCatalog;
  const { catalog, changed } = normalizeCatalog(raw);
  const homCatalog = readHomologationCatalog(project);
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
  if (changed || homChanged) writeCatalog(project, catalog);
  return catalog;
}

export function writeCatalog(project: ProjectSlug, catalog: TestCatalog) {
  catalog.meta.updatedAt = new Date().toISOString().slice(0, 10);
  catalog.meta.project = project;
  fs.writeFileSync(catalogPath(project), `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
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
  const year = new Date().getFullYear();
  const nums = catalog.reports
    .map((r) => r.id.match(/(?:BUG|TEST)-\d{4}-(\d+)/))
    .filter(Boolean)
    .map((m) => parseInt(m![1], 10));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `TEST-${year}-${String(next).padStart(3, "0")}`;
}

export function uploadsDir(project: ProjectSlug, testId: string) {
  const dir = path.join(UPLOADS_ROOT, project, testId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export { DATA_ROOT, UPLOADS_ROOT };
