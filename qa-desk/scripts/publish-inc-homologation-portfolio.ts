/**
 * Libera HOM-2026-004 e os CTs INC no portfólio (sem evidências — sanitização no GET).
 *
 *   cd qa-desk
 *   npx tsx scripts/publish-inc-homologation-portfolio.ts
 */
import { loadEnv } from "../server/load-env.ts";

loadEnv();

import {
  readHomologationCatalog,
  writeHomologationCatalog,
} from "../server/homologations.ts";
import { readCatalog, writeCatalog } from "../server/storage.ts";

const HOM_ID = "HOM-2026-004";
const KEYS = [
  "academico/inc-diario-01",
  "academico/inc-diario-02",
  "academico/inc-diario-03",
  "academico/inc-diario-04",
  "academico/inc-diario-05",
  "academico/inc-diario-06",
  "academico/inc-diario-07",
  "academico/inc-diario-08",
  "academico/inc-diario-09",
];

async function main() {
  const project = "polygonus" as const;
  const homCatalog = await readHomologationCatalog(project);
  const hom = homCatalog.homologations.find((h) => h.id === HOM_ID);
  if (!hom) {
    throw new Error(`${HOM_ID} não encontrada`);
  }
  hom.showInPortfolio = true;
  await writeHomologationCatalog(project, homCatalog);
  console.log("homologação no portfólio:", hom.slug);

  const catalog = await readCatalog(project);
  let n = 0;
  for (const key of KEYS) {
    const t = catalog.reports.find((r) => r.testKey === key);
    if (!t) {
      console.log("ausente:", key);
      continue;
    }
    if (t.showInPortfolio) {
      console.log("já público:", key);
      continue;
    }
    t.showInPortfolio = true;
    n += 1;
    console.log("liberado:", key, t.id);
  }
  if (n > 0) await writeCatalog(project, catalog);
  console.log("CTs atualizados:", n);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
