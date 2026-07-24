import type { KbCurationRecord } from "../../src/types/kb-curation.js";
import {
  applyGithubSnapshotToRecord,
  buildImportedRecord,
  needsReviewDetail,
  type GithubPrDetail,
  type GithubPullRequestSnapshot,
} from "./kb-pr-sync-core.js";
import {
  fetchPrDetail,
  fetchPrDetailsBatch,
  fetchPullRequestSnapshot,
  listPullRequests,
} from "./kb-pr-github.js";

export async function syncTrackedKbPullRequests(
  repository: string,
  records: KbCurationRecord[],
  opts?: { importOpen?: boolean },
): Promise<{
  records: KbCurationRecord[];
  synced: number;
  imported: number;
  authorResponses: number;
  at: string;
}> {
  const importOpen = opts?.importOpen !== false;
  const remote = await listPullRequests(repository);
  const byNumber = new Map(remote.map((pullRequest) => [pullRequest.number, pullRequest]));
  const at = new Date().toISOString();
  let synced = 0;
  let imported = 0;
  let authorResponses = 0;

  const candidates = records.filter((record) => {
    if (!byNumber.has(record.prNumber)) return false;
    return needsReviewDetail(record.status);
  });

  let detailByPr = new Map<number, GithubPrDetail>();
  try {
    detailByPr = await fetchPrDetailsBatch(
      repository,
      candidates.map((record) => record.prNumber),
    );
  } catch (error) {
    console.warn(
      "[kb-curation] GraphQL batch falhou; sync segue sem reviews/commits:",
      error instanceof Error ? error.message : error,
    );
  }

  const updated = records.map((record) => {
    const pullRequest = byNumber.get(record.prNumber);
    if (!pullRequest) return record;
    synced += 1;

    const applied = applyGithubSnapshotToRecord(
      record,
      pullRequest,
      detailByPr.get(record.prNumber),
      at,
    );
    if (applied.authorResponded) authorResponses += 1;
    return applied.record;
  });

  const known = new Set(updated.map((record) => record.prNumber));
  const importedRecords: KbCurationRecord[] = [];

  if (importOpen) {
    const openRemote = remote
      .filter((pullRequest) => pullRequest.state === "OPEN" && !known.has(pullRequest.number))
      .sort((a, b) => a.number - b.number);

    for (const pullRequest of openRemote) {
      imported += 1;
      importedRecords.push(buildImportedRecord(repository, pullRequest, at));
    }
  }

  return {
    records: [...updated, ...importedRecords].sort((a, b) => a.prNumber - b.prNumber),
    synced,
    imported,
    authorResponses,
    at,
  };
}

/**
 * Atualiza um único PR (webhook / sync pontual). Importa se aberto e ainda não rastreado.
 */
export async function syncSingleKbPullRequest(
  repository: string,
  records: KbCurationRecord[],
  prNumber: number,
  opts?: {
    importIfOpen?: boolean;
    actor?: string;
    project?: KbCurationRecord["project"];
  },
): Promise<{
  records: KbCurationRecord[];
  changed: boolean;
  imported: boolean;
  authorResponded: boolean;
  at: string;
}> {
  const actor = opts?.actor ?? "GitHub webhook";
  const importIfOpen = opts?.importIfOpen !== false;
  const project = opts?.project ?? "polygonus";
  const at = new Date().toISOString();

  const snapshot = await fetchPullRequestSnapshot(repository, prNumber);
  const index = records.findIndex((record) => record.prNumber === prNumber);

  if (index < 0) {
    if (importIfOpen && snapshot.state === "OPEN") {
      const imported = buildImportedRecord(repository, snapshot, at, actor, project);
      return {
        records: [...records, imported].sort((a, b) => a.prNumber - b.prNumber),
        changed: true,
        imported: true,
        authorResponded: false,
        at,
      };
    }
    return {
      records,
      changed: false,
      imported: false,
      authorResponded: false,
      at,
    };
  }

  const previous = records[index];
  let detail: GithubPrDetail | undefined;
  if (needsReviewDetail(previous.status) && snapshot.state === "OPEN") {
    try {
      detail = await fetchPrDetail(repository, prNumber);
    } catch (error) {
      console.warn(
        `[kb-curation] detalhe do PR #${prNumber} falhou:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  const applied = applyGithubSnapshotToRecord(previous, snapshot, detail, at, actor);
  const next = [...records];
  next[index] = applied.record;

  const changed =
    JSON.stringify(pickSyncFields(previous)) !== JSON.stringify(pickSyncFields(applied.record));

  return {
    records: next,
    changed,
    imported: false,
    authorResponded: applied.authorResponded,
    at,
  };
}

function pickSyncFields(record: KbCurationRecord) {
  return {
    status: record.status,
    verdict: record.verdict,
    githubState: record.githubState,
    title: record.title,
    mergedAt: record.mergedAt,
    mergeCommitSha: record.mergeCommitSha,
    reviewedAt: record.reviewedAt,
  };
}

export type { GithubPullRequestSnapshot, GithubPrDetail };
