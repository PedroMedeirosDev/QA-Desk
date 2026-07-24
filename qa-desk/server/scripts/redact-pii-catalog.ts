/**
 * One-shot: redige PII já gravado nos catálogos Postgres (tests, homologações, KB).
 *
 *   cd qa-desk
 *   npx tsx server/scripts/redact-pii-catalog.ts
 */
import { loadEnv } from "../load-env.js";
import { getPrisma } from "../db/prisma.js";
import { isDatabaseEnabled } from "../db/config.js";
import { readCatalog, writeCatalog } from "../storage.js";
import { readHomologationCatalog, writeHomologationCatalog } from "../homologations.js";
import { readKbCurationCatalog, writeKbCurationCatalog } from "../kb-curation.js";
import { PROJECTS, type ProjectSlug } from "../types.js";

loadEnv();

if (!isDatabaseEnabled()) {
  console.error("DATABASE_URL não definido — nada a fazer.");
  process.exit(1);
}

for (const p of PROJECTS) {
  const project = p.slug as ProjectSlug;
  console.log(`[${project}] redigindo…`);
  const tests = await readCatalog(project);
  await writeCatalog(project, tests);
  const homs = await readHomologationCatalog(project);
  await writeHomologationCatalog(project, homs);
  const kb = await readKbCurationCatalog(project);
  await writeKbCurationCatalog(project, kb);
  console.log(`[${project}] ok`);
}

await getPrisma().$disconnect();
console.log("Redação PII do catálogo concluída.");
