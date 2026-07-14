import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MURAL_HOMOLOGATION_SLUG, muralTestKeys } from "./homologation-config.js";
import { CURRENT_USER } from "./config/user.js";
import type {
  Homologation,
  HomologationCatalog,
  HomologationChangeScope,
  HomologationCycleStatus,
  HomologationProgress,
  ProjectSlug,
  TestCatalog,
  TestHomologationStatus,
  TestRecord,
} from "./types.js";
import { readCatalog, writeCatalog } from "./storage.js";
import { findByTestKey } from "./test-key.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.join(__dirname, "../data/projects");

function homologationsPath(project: ProjectSlug) {
  return path.join(DATA_ROOT, project, "homologations.json");
}

export function readHomologationCatalog(project: ProjectSlug): HomologationCatalog {
  const file = homologationsPath(project);
  fs.mkdirSync(path.dirname(file), { recursive: true });

  if (!fs.existsSync(file)) {
    const catalog = seedDefaultHomologations(project);
    writeHomologationCatalog(project, catalog);
    return catalog;
  }

  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as HomologationCatalog;
  const { catalog, changed } = ensureMuralHomologation(project, raw);
  if (changed) writeHomologationCatalog(project, catalog);
  return catalog;
}

export function writeHomologationCatalog(project: ProjectSlug, catalog: HomologationCatalog) {
  catalog.meta.updatedAt = new Date().toISOString().slice(0, 10);
  catalog.meta.project = project;
  fs.writeFileSync(homologationsPath(project), `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
}

function seedDefaultHomologations(project: ProjectSlug): HomologationCatalog {
  const now = new Date().toISOString();
  if (project !== "polygonus") {
    return {
      meta: { version: "1.0.0", updatedAt: now.slice(0, 10), project },
      homologations: [],
    };
  }

  return {
    meta: { version: "1.0.0", updatedAt: now.slice(0, 10), project },
    homologations: [createMuralHomologation(now)],
  };
}

function createMuralHomologation(now: string): Homologation {
  return {
    id: "HOM-2026-001",
    slug: MURAL_HOMOLOGATION_SLUG,
    title: "Homologação Mural (backend)",
    description: "Conjunto padrão de testes do módulo Mural após alterações no backend.",
    project: "polygonus",
    channel: "app",
    changeScope: "backend",
    status: "em_andamento",
    campaign: MURAL_HOMOLOGATION_SLUG,
    testKeys: muralTestKeys(),
    startedAt: now,
    history: [
      {
        at: now,
        actor: "system",
        action: "homologation_created",
        detail: "Homologação Mural criada com checklist padrão",
      },
    ],
  };
}

function ensureMuralHomologation(project: ProjectSlug, catalog: HomologationCatalog) {
  if (project !== "polygonus") return { catalog, changed: false };

  let changed = false;
  let mural = catalog.homologations.find((h) => h.slug === MURAL_HOMOLOGATION_SLUG);

  if (!mural) {
    mural = createMuralHomologation(new Date().toISOString());
    catalog.homologations.unshift(mural);
    changed = true;
  }

  if (mural.changeScope !== "backend") {
    mural.changeScope = "backend";
    changed = true;
  }

  const keys = muralTestKeys();
  const mergedKeys = [...new Set([...mural.testKeys, ...keys])];
  if (mergedKeys.length !== mural.testKeys.length) {
    mural.testKeys = mergedKeys;
    changed = true;
  }

  return { catalog, changed };
}

export function slugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function uniqueSlug(catalog: HomologationCatalog, base: string): string {
  let slug = base || "homologacao";
  let n = 2;
  while (catalog.homologations.some((h) => h.slug === slug)) {
    slug = `${base}-${n}`;
    n++;
  }
  return slug;
}

export function createHomologation(
  catalog: HomologationCatalog,
  input: {
    project: ProjectSlug;
    title: string;
    description?: string;
    channel?: Homologation["channel"];
    changeScope?: HomologationChangeScope;
    testKeys?: string[];
    build?: string;
  },
): Homologation {
  const now = new Date().toISOString();
  const baseSlug = slugFromTitle(input.title);
  const slug = uniqueSlug(catalog, baseSlug);
  const homologation: Homologation = {
    id: nextHomologationId(catalog),
    slug,
    title: input.title.trim(),
    description: input.description?.trim(),
    project: input.project,
    channel: input.channel,
    changeScope: input.changeScope ?? "backend",
    status: "em_andamento",
    campaign: slug,
    testKeys: input.testKeys ?? [],
    build: input.build,
    startedAt: now,
    history: [
      {
        at: now,
        actor: CURRENT_USER.actor,
        action: "homologation_created",
        detail: `Homologação criada: ${input.title.trim()}`,
      },
    ],
  };
  catalog.homologations.unshift(homologation);
  return homologation;
}

export function nextHomologationId(catalog: HomologationCatalog): string {
  const year = new Date().getFullYear();
  const nums = catalog.homologations
    .map((h) => h.id.match(/HOM-\d{4}-(\d+)/))
    .filter(Boolean)
    .map((m) => parseInt(m![1], 10));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `HOM-${year}-${String(next).padStart(3, "0")}`;
}

export function findHomologationBySlug(catalog: HomologationCatalog, slug: string) {
  return catalog.homologations.find((h) => h.slug === slug || h.id === slug);
}

export function findHomologationById(catalog: HomologationCatalog, id: string) {
  return catalog.homologations.find((h) => h.id === id);
}

export function computeHomologationProgress(
  homologation: Homologation,
  testCatalog: TestCatalog,
): HomologationProgress {
  const items = homologation.testKeys.map((testKey) => {
    const test = findByTestKey(testCatalog, testKey);
    const status = test?.homologationStatus ?? "pendente";
    const runsInHomologation = (test?.history ?? []).filter(
      (h) =>
        h.action === "test_run" &&
        (h.meta?.homologationId === homologation.id ||
          h.meta?.homologationSlug === homologation.slug),
    ).length;

    return {
      testKey,
      testId: test?.id,
      title: test?.title ?? testKey,
      status,
      runsInHomologation,
      lastRunAt: test?.automation?.lastRunAt,
      found: Boolean(test),
      hasAutomation: Boolean(test?.automation?.flowPath),
      readiness: test?.automation?.flowPath
        ? ((test.automation.readiness === "ready" ? "ready" : "draft") as "draft" | "ready")
        : undefined,
    };
  });

  const found = items.filter((i) => i.found).length;
  const passed = items.filter((i) => i.status === "passou" || i.status === "homologado").length;
  const failed = items.filter((i) => i.status === "falhou").length;
  const pending = items.filter((i) => i.status === "pendente").length;
  const homologated = items.filter((i) => i.status === "homologado").length;

  return {
    homologationId: homologation.id,
    total: homologation.testKeys.length,
    registered: found,
    passed,
    failed,
    pending,
    homologated,
    items,
  };
}

/** Vincula testes do catálogo à homologação (homologationId + campaign) */
export function linkTestsToHomologation(
  testCatalog: TestCatalog,
  homologation: Homologation,
): number {
  let linked = 0;
  for (const testKey of homologation.testKeys) {
    const test = findByTestKey(testCatalog, testKey);
    if (!test) continue;
    let changed = false;
    if (test.homologationId !== homologation.id) {
      test.homologationId = homologation.id;
      changed = true;
    }
    if (test.campaign !== homologation.slug) {
      test.campaign = homologation.slug;
      changed = true;
    }
    if (changed) linked++;
  }
  return linked;
}

export function appendHomologationHistory(
  homologation: Homologation,
  entry: { actor: string; action: string; detail?: string; meta?: Record<string, unknown> },
) {
  homologation.history.push({
    at: new Date().toISOString(),
    ...entry,
  });
}

export function resolveHomologationForTest(
  project: ProjectSlug,
  test: TestRecord,
  explicitId?: string,
): Homologation | undefined {
  const catalog = readHomologationCatalog(project);
  if (explicitId) {
    return findHomologationById(catalog, explicitId) ?? findHomologationBySlug(catalog, explicitId);
  }
  if (test.homologationId) {
    return findHomologationById(catalog, test.homologationId);
  }
  if (test.campaign) {
    return findHomologationBySlug(catalog, test.campaign);
  }
  return undefined;
}

/** Sincroniza testKeys da homologação Mural com testes existentes no catálogo */
export function syncMuralHomologation(project: ProjectSlug) {
  const homCatalog = readHomologationCatalog(project);
  const testCatalog = readCatalog(project);
  const mural = findHomologationBySlug(homCatalog, MURAL_HOMOLOGATION_SLUG);
  if (!mural) throw new Error("Homologação Mural não encontrada");

  const keysFromTests = testCatalog.reports
    .filter((t) => t.campaign === MURAL_HOMOLOGATION_SLUG && t.testKey)
    .map((t) => t.testKey!);

  mural.testKeys = [...new Set([...mural.testKeys, ...keysFromTests, ...muralTestKeys()])];
  const linked = linkTestsToHomologation(testCatalog, mural);

  appendHomologationHistory(mural, {
    actor: "system",
    action: "homologation_synced",
    detail: `Escopo: ${mural.testKeys.length} teste(s), ${linked} vínculo(s) atualizado(s)`,
  });

  return { homCatalog, testCatalog, mural, linked };
}
