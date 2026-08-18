/**
 * Grava o briefing da campanha CQ no registro da homologação.
 *
 *   cd qa-desk
 *   npx tsx scripts/apply-cq-diario-scope.ts
 */
import { loadEnv } from "../server/load-env.ts";

loadEnv();

import { DIARIO_CQ_HOMOLOGATION_SLUG, DIARIO_CQ_SCOPE } from "../src/config/homologation-scopes.ts";
import {
  appendHomologationHistory,
  readHomologationCatalog,
  writeHomologationCatalog,
} from "../server/homologations.ts";

const catalog = await readHomologationCatalog("polygonus");
const hom = catalog.homologations.find(
  (h) => h.slug === DIARIO_CQ_HOMOLOGATION_SLUG || h.id === "HOM-2026-003",
);
if (!hom) {
  console.error("Homologação diario-cq-homologacao não encontrada.");
  process.exit(1);
}

hom.scope = DIARIO_CQ_SCOPE;
hom.description =
  "WEB React no Amostra: notas parciais, conteúdo e frequência (dois forms). Conferência no App (responsável).";
appendHomologationHistory(hom, {
  actor: "qa",
  action: "updated",
  detail: "Briefing de escopo para o gestor (HTML)",
});
catalog.meta.updatedAt = new Date().toISOString().slice(0, 10);
await writeHomologationCatalog("polygonus", catalog);
console.log(`OK — ${hom.id} ${hom.slug} com scope (${DIARIO_CQ_SCOPE.length} chars)`);
