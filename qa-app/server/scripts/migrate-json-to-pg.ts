/**
 * Migra tests.json + homologations.json → Postgres.
 *
 * Uso:
 *   cd qa-app
 *   docker compose up -d
 *   npx prisma migrate deploy
 *   npm run db:migrate-json
 */
import { loadEnv } from "../load-env.js";
import { isDatabaseEnabled } from "../db/config.js";
import { writeCatalogToDb } from "../db/pg-catalog.js";
import { writeHomologationCatalogToDb } from "../db/pg-homologations.js";
import { getPrisma } from "../db/prisma.js";
import { readHomologationCatalogFileOnly } from "../homologations.js";
import { readCatalogFileOnly } from "../storage.js";
import { PROJECTS, type ProjectSlug } from "../types.js";

loadEnv();

async function migrateProject(project: ProjectSlug) {
  const tests = readCatalogFileOnly(project);
  const homs = readHomologationCatalogFileOnly(project);

  console.log(
    `[${project}] JSON: ${tests.reports.length} teste(s), ${homs.homologations.length} homologação(ões)`,
  );

  await writeHomologationCatalogToDb(project, homs);
  await writeCatalogToDb(project, tests);

  const prisma = getPrisma();
  const [t, h] = await Promise.all([
    prisma.test.count({ where: { projectSlug: project } }),
    prisma.homologation.count({ where: { projectSlug: project } }),
  ]);
  console.log(`[${project}] Postgres: ${t} teste(s), ${h} homologação(ões)`);
}

async function main() {
  if (!isDatabaseEnabled()) {
    console.error("Defina DATABASE_URL no qa-app/.env (veja .env.example).");
    process.exit(1);
  }

  for (const p of PROJECTS) {
    await migrateProject(p.slug);
  }

  console.log("Migração concluída. Reinicie a API com DATABASE_URL definido.");
  await getPrisma().$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
