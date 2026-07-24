/**
 * Sync one KB PR into the curation catalog (uses local `gh`).
 * Usage: npx tsx server/scripts/sync-one-kb-pr.ts polygonus 108
 */
import { loadEnv } from "../load-env.js";
import { getPrisma } from "../db/prisma.js";
import { syncSingleKbPullRequest } from "../github/kb-pull-requests.js";
import { readKbCurationCatalog, writeKbCurationCatalog } from "../kb-curation.js";
import type { ProjectSlug } from "../types.js";

loadEnv();

const project = (process.argv[2] ?? "polygonus") as ProjectSlug;
const prNumber = Number(process.argv[3]);
if (!Number.isFinite(prNumber) || prNumber <= 0) {
  console.error("Uso: npx tsx server/scripts/sync-one-kb-pr.ts <project> <prNumber>");
  process.exit(1);
}

const catalog = await readKbCurationCatalog(project);
const result = await syncSingleKbPullRequest(
  catalog.meta.repository,
  catalog.pullRequests,
  prNumber,
  { actor: "sync-one-kb-pr", project },
);
catalog.pullRequests = result.records;
catalog.meta.updatedAt = result.at.slice(0, 10);
await writeKbCurationCatalog(project, catalog);

const row = catalog.pullRequests.find((p) => p.prNumber === prNumber);
console.log(
  JSON.stringify(
    {
      changed: result.changed,
      imported: result.imported,
      status: row?.status,
      githubState: row?.githubState,
      verdict: row?.verdict,
    },
    null,
    2,
  ),
);
await getPrisma().$disconnect();
