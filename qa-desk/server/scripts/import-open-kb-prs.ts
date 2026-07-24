/**
 * Importa todas as PRs abertas do suporte-kb para a Curadoria.
 * Uso: npx tsx server/scripts/import-open-kb-prs.ts
 */
import {
  computeKbCurationMetrics,
  readKbCurationCatalog,
  writeKbCurationCatalog,
} from "../kb-curation.js";
import { syncTrackedKbPullRequests } from "../github/kb-pull-requests.js";

const project = "polygonus" as const;

const catalog = await readKbCurationCatalog(project);
const before = catalog.pullRequests.length;
const result = await syncTrackedKbPullRequests(
  catalog.meta.repository,
  catalog.pullRequests,
  { importOpen: true },
);

catalog.pullRequests = result.records;
catalog.meta.updatedAt = result.at.slice(0, 10);
await writeKbCurationCatalog(project, catalog);

const metrics = computeKbCurationMetrics(catalog.pullRequests);
const open = catalog.pullRequests.filter((r) => r.githubState === "open").length;

console.log(
  JSON.stringify(
    {
      before,
      after: catalog.pullRequests.length,
      synced: result.synced,
      imported: result.imported,
      open,
      metrics,
    },
    null,
    2,
  ),
);
