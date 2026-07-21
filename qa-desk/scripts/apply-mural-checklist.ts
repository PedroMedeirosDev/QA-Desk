/**
 * Aplica o checklist Mural canônico (cria rascunhos faltantes + atualiza
 * títulos/testKeys) e alinha testKeys da homologação no JSON e no Postgres.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "../server/load-env.ts";

loadEnv();

import {
  createMuralHomologationRecords,
  muralDomainTestKey,
} from "../server/automation.ts";
import {
  MURAL_HOMOLOGATION_SLUG,
  muralLegacyFlowTestKey,
  muralTestKeys,
} from "../server/homologation-config.ts";
import {
  appendHomologationHistory,
  findHomologationBySlug,
  linkTestsToHomologation,
  readHomologationCatalog,
  writeHomologationCatalog,
} from "../server/homologations.ts";
import {
  appendHistory,
  nextTestId,
  readCatalogFileOnly,
  writeCatalog,
} from "../server/storage.ts";
import { findByTestKey } from "../server/test-key.ts";
import type { TestRecord } from "../server/types.ts";

const project = "polygonus" as const;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const homCatalog = await readHomologationCatalog(project);
const mural = findHomologationBySlug(homCatalog, MURAL_HOMOLOGATION_SLUG);
if (!mural) throw new Error("Homologação Mural não encontrada");

const catalog = readCatalogFileOnly(project);
let created = 0;
let updated = 0;

for (const draft of createMuralHomologationRecords(project)) {
  const { _sort: _s, ...body } = draft as typeof draft & { _sort: number };
  const flowPath = body.automation!.flowPath;
  const testKey =
    body.testKey ??
    (body.automation?.label
      ? muralDomainTestKey(String(body.automation.label))
      : muralLegacyFlowTestKey(flowPath));
  const legacyKey = muralLegacyFlowTestKey(flowPath);
  const existing =
    findByTestKey(catalog, testKey) ??
    findByTestKey(catalog, legacyKey) ??
    catalog.reports.find(
      (r) =>
        r.automation?.flowPath?.replace(/\\/g, "/") ===
        flowPath.replace(/\\/g, "/"),
    );

  if (existing) {
    existing.testKey = testKey;
    existing.homologationId = mural.id;
    existing.campaign = MURAL_HOMOLOGATION_SLUG;
    existing.title = body.title ?? existing.title;
    existing.description = body.description ?? existing.description;
    existing.preconditions = body.preconditions ?? existing.preconditions;
    existing.expectedResult = body.expectedResult ?? existing.expectedResult;
    if (body.steps?.length) existing.steps = body.steps;
    if (body.tags?.length) existing.tags = body.tags;
    if (body.automation?.label || flowPath) {
      existing.automation = {
        ...existing.automation!,
        label: body.automation?.label ?? existing.automation?.label,
        flowPath,
        type: existing.automation?.type ?? body.automation?.type ?? "maestro",
      };
    }
    updated += 1;
    continue;
  }

  const id = nextTestId(project, catalog);
  const report: TestRecord = {
    id,
    testKey,
    recordType: "teste",
    title: body.title!,
    description: body.description ?? "",
    preconditions: body.preconditions,
    expectedResult: body.expectedResult,
    steps: body.steps ?? [],
    reportedAt: body.reportedAt!,
    project,
    channel: body.channel ?? "app",
    platform: body.platform ?? "android",
    module: body.module,
    status: body.status ?? "rascunho",
    homologationStatus: "pendente",
    homologationId: mural.id,
    executionMode: "automated",
    priority: body.priority,
    campaign: MURAL_HOMOLOGATION_SLUG,
    automation: body.automation,
    tags: body.tags,
    history: [],
    evidence: [],
    showInPortfolio: false,
  };
  appendHistory(report, {
    actor: "system",
    action: "test_created",
    detail: `Caso de teste criado (${mural.title})`,
    meta: { testKey, homologationId: mural.id, homologationSlug: mural.slug },
  });
  catalog.reports.unshift(report);
  created += 1;
  console.log(`+ ${testKey} · ${report.title}`);
}

mural.testKeys = muralTestKeys();
linkTestsToHomologation(catalog, mural);
appendHomologationHistory(mural, {
  actor: "system",
  action: "homologation_synced",
  detail: `Checklist aplicado: ${mural.testKeys.length} no escopo · ${created} novo(s) · ${updated} atualizado(s)`,
});

catalog.meta.updatedAt = new Date().toISOString().slice(0, 10);
homCatalog.meta.updatedAt = catalog.meta.updatedAt;

await writeCatalog(project, catalog);
await writeHomologationCatalog(project, homCatalog);

fs.writeFileSync(
  path.join(root, "data/projects/polygonus/tests.json"),
  `${JSON.stringify({ meta: catalog.meta, reports: catalog.reports }, null, 2)}\n`,
);
fs.writeFileSync(
  path.join(root, "data/projects/polygonus/homologations.json"),
  `${JSON.stringify({ meta: homCatalog.meta, homologations: homCatalog.homologations }, null, 2)}\n`,
);

console.log(
  `\nDone: ${mural.testKeys.length} keys · created=${created} updated=${updated}`,
);
