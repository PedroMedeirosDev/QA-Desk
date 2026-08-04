/**
 * Backfill `reviewer` em registros sem responsável:
 * 1) último ator humano na history
 * 2) senão, review APPROVED/CHANGES_REQUESTED no GitHub
 */
import { config } from "dotenv";
config();
import {
  readKbCurationCatalog,
  writeKbCurationCatalog,
} from "../kb-curation.js";
import { fetchPrDetail } from "../github/kb-pr-github.js";
import {
  latestDecisiveReview,
  reviewerDisplayFromGithubLogin,
} from "../github/kb-pr-sync-core.js";
import type { ProjectSlug } from "../types.js";

const BOT_ACTORS = /^(GitHub webhook|GitHub sync|catch-up|diagnostico)/i;

async function main() {
  const project = (process.argv[2] as ProjectSlug) || "polygonus";
  const catalog = await readKbCurationCatalog(project);
  const repo = catalog.meta.repository || "polygonus-br/polygonus-suporte-kb";
  let fixed = 0;

  for (let i = 0; i < catalog.pullRequests.length; i++) {
    const record = catalog.pullRequests[i];
    if (record.reviewer?.trim()) continue;

    let next: string | undefined;
    const human = [...record.history]
      .reverse()
      .find((entry) => entry.actor && !BOT_ACTORS.test(entry.actor));
    if (human?.actor) next = human.actor === "PedroMedeirosDev" ? "Pedro" : human.actor;

    if (!next) {
      try {
        const detail = await fetchPrDetail(repo, record.prNumber);
        const decisive = latestDecisiveReview(detail.reviews);
        next = reviewerDisplayFromGithubLogin(decisive?.author?.login);
        if (!next) {
          const approved = detail.reviews
            .filter((r) => r.state === "APPROVED")
            .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt))[0];
          next = reviewerDisplayFromGithubLogin(approved?.author?.login);
        }
      } catch (error) {
        console.warn(
          `#${record.prNumber} sem detalhe GitHub:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    if (!next) continue;
    catalog.pullRequests[i] = { ...record, reviewer: next };
    fixed += 1;
    console.log(`#${record.prNumber} → responsável=${next}`);
  }

  if (fixed === 0) {
    console.log("Nada a preencher.");
    return;
  }

  await writeKbCurationCatalog(project, catalog, { sseReason: "sync" });
  console.log(`Atualizados: ${fixed}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
