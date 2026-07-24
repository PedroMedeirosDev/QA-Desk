import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Prisma } from "@prisma/client";
import type {
  KbCurationCatalog,
  KbCurationMetrics,
  KbCurationRecord,
} from "../src/types/kb-curation.js";
import { isDatabaseEnabled } from "./db/config.js";
import { getPrisma } from "./db/prisma.js";
import { initialKbCurationCatalog } from "./kb-curation-seed.js";
import { PROJECTS, type ProjectSlug } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.join(__dirname, "../data/projects");

function catalogPath(project: ProjectSlug) {
  return path.join(DATA_ROOT, project, "kb-curation.json");
}

export function normalizeKbCurationStatus(
  status: KbCurationRecord["status"],
): KbCurationRecord["status"] {
  if (status === "pendente" || status === "em_revisao") return "aguardando_revisao";
  return status;
}

function normalizeCatalog(project: ProjectSlug, catalog: KbCurationCatalog): KbCurationCatalog {
  return {
    ...catalog,
    meta: {
      ...catalog.meta,
      version: catalog.meta.version || "1.0.0",
      project,
      updatedAt: catalog.meta.updatedAt || new Date().toISOString().slice(0, 10),
    },
    pullRequests: [...catalog.pullRequests]
      .map((record) => ({
        ...record,
        status: normalizeKbCurationStatus(record.status),
      }))
      .sort((a, b) => a.prNumber - b.prNumber),
  };
}

async function ensureProject(project: ProjectSlug) {
  const prisma = getPrisma();
  const label = PROJECTS.find((item) => item.slug === project)?.label ?? project;
  await prisma.project.upsert({
    where: { slug: project },
    create: { slug: project, label, metaVersion: "1.0.0" },
    update: { label },
  });
}

function readFileCatalog(project: ProjectSlug): KbCurationCatalog {
  const file = catalogPath(project);
  if (!fs.existsSync(file)) {
    const seeded = initialKbCurationCatalog(project);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(seeded, null, 2)}\n`, "utf8");
    return seeded;
  }
  return normalizeCatalog(
    project,
    JSON.parse(fs.readFileSync(file, "utf8")) as KbCurationCatalog,
  );
}

function writeFileCatalog(project: ProjectSlug, catalog: KbCurationCatalog) {
  const normalized = normalizeCatalog(project, {
    ...catalog,
    meta: { ...catalog.meta, updatedAt: new Date().toISOString().slice(0, 10) },
  });
  const file = catalogPath(project);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
}

async function readDbCatalog(project: ProjectSlug): Promise<KbCurationCatalog> {
  await ensureProject(project);
  const prisma = getPrisma();
  const rows = await prisma.kbCuration.findMany({
    where: { projectSlug: project },
    orderBy: { prNumber: "asc" },
  });
  const catalog = initialKbCurationCatalog(project);
  catalog.pullRequests = rows.map((row) => row.payload as unknown as KbCurationRecord);
  return normalizeCatalog(project, catalog);
}

async function writeDbCatalog(project: ProjectSlug, catalog: KbCurationCatalog) {
  await ensureProject(project);
  const prisma = getPrisma();
  for (const record of catalog.pullRequests) {
    const data = {
      id: record.id,
      projectSlug: project,
      repository: record.repository,
      prNumber: record.prNumber,
      title: record.title,
      githubState: record.githubState,
      status: record.status,
      verdict: record.verdict,
      payload: record as unknown as Prisma.InputJsonValue,
    };
    await prisma.kbCuration.upsert({
      where: { id: record.id },
      create: data,
      update: data,
    });
  }
}

export async function readKbCurationCatalog(project: ProjectSlug): Promise<KbCurationCatalog> {
  if (!isDatabaseEnabled()) return readFileCatalog(project);

  const catalog = await readDbCatalog(project);
  if (catalog.pullRequests.length > 0) return catalog;

  const seeded = readFileCatalog(project);
  await writeDbCatalog(project, seeded);
  return seeded;
}

export async function writeKbCurationCatalog(
  project: ProjectSlug,
  catalog: KbCurationCatalog,
): Promise<void> {
  catalog.meta.updatedAt = new Date().toISOString().slice(0, 10);
  if (isDatabaseEnabled()) {
    await writeDbCatalog(project, catalog);
    // Mantém o JSON como espelho local (útil se o Postgres cair / migração).
    writeFileCatalog(project, catalog);
    return;
  }
  writeFileCatalog(project, catalog);
}

export function computeKbCurationMetrics(records: KbCurationRecord[]): KbCurationMetrics {
  const merged = records.filter((record) => record.status === "mesclada").length;
  const approved = records.filter((record) => record.status === "aprovada").length;
  const awaitingReview = records.filter((record) => {
    const status = normalizeKbCurationStatus(record.status);
    return status === "aguardando_revisao";
  }).length;
  return {
    total: records.length,
    awaitingReview,
    awaitingCorrection: records.filter(
      (record) => record.status === "aguardando_correcao",
    ).length,
    awaitingRereview: records.filter(
      (record) => record.status === "aguardando_rerevisao",
    ).length,
    approved,
    merged,
    blocked: records.filter((record) => record.status === "bloqueada").length,
    closedUnmerged: records.filter((record) => record.status === "fechada").length,
    completionPercent:
      records.length > 0 ? Math.round(((approved + merged) / records.length) * 100) : 0,
    pending: awaitingReview,
    inReview: awaitingReview,
  };
}
