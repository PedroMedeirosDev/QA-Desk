/**
 * Marca um recorte público no Polygonus (showInPortfolio).
 * Uso: npx tsx scripts/mark-portfolio-showcase.ts
 */
import { loadEnv } from "../server/load-env.ts";
loadEnv();

import { appendHistory, readCatalog, writeCatalog } from "../server/storage.ts";

/** Sem nome de aluno real / sem payload operacional. */
const SHOWCASE_IDS = new Set([
  "TEST-2026-001", // CRUD comunicado
  "TEST-2026-005", // anexo foto
  "TEST-2026-008", // evento
  "TEST-2026-032", // rotina alimentação
  "TEST-2026-036", // chat smoke
  "BUG-2026-003", // FAB rotina
  "BUG-2026-005", // filtro turmas / destaque
  "BUG-2026-006", // evento datas
  "BUG-2026-007", // salvar PDF
  "BUG-2026-008", // horário UTC
]);

const catalog = await readCatalog("polygonus");
let n = 0;
for (const report of catalog.reports) {
  const want = SHOWCASE_IDS.has(report.id);
  if (want === Boolean(report.showInPortfolio)) continue;
  report.showInPortfolio = want;
  appendHistory(report, {
    actor: "qa",
    action: "updated",
    detail: want ? "Marcado no portfólio visitante" : "Removido do portfólio visitante",
  });
  n += 1;
  console.log(`${want ? "+" : "-"} ${report.id}  ${report.title}`);
}

await writeCatalog("polygonus", catalog);
console.log(`\nAtualizados: ${n}. Públicos agora: ${catalog.reports.filter((r) => r.showInPortfolio).length}`);
