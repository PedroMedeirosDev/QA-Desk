import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDatabaseEnabled } from "./db/config.js";
import {
  getDailyMetricMeta,
  listPortfolioDailyMetrics,
  normalizeIntents,
  upsertDailyMetricMeta,
} from "./db/daily-metrics.js";
import { getPrisma } from "./db/prisma.js";
import { dayBoundsSaoPaulo, isInstantInSaoPauloDay, isValidDateYmd } from "./day-bounds.js";
import type {
  DailyIntent,
  DailyMetricMeta,
  DailyPortfolioCard,
  DailySummary,
  DailySummaryHighlight,
  DailyTool,
} from "./daily-summary-types.js";
import { DAILY_INTENTS } from "./daily-summary-types.js";
import { readHomologationCatalog } from "./homologations.js";
import { readKbCurationCatalog } from "./kb-curation.js";
import { readCatalog } from "./storage.js";
import type { HistoryEntry, ProjectSlug, TestRecord } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.join(__dirname, "../data/projects");

type JsonStore = {
  days: Array<{
    date: string;
    showInPortfolio: boolean;
    intents: DailyIntent[];
    note?: string;
    summary?: DailySummary | null;
  }>;
};

function jsonPath(project: ProjectSlug) {
  return path.join(DATA_ROOT, project, "daily-metrics.json");
}

function readJsonStore(project: ProjectSlug): JsonStore {
  const file = jsonPath(project);
  if (!fs.existsSync(file)) return { days: [] };
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as JsonStore;
    return { days: Array.isArray(raw.days) ? raw.days : [] };
  } catch {
    return { days: [] };
  }
}

function writeJsonStore(project: ProjectSlug, store: JsonStore) {
  fs.mkdirSync(path.join(DATA_ROOT, project), { recursive: true });
  fs.writeFileSync(jsonPath(project), `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

async function loadMeta(project: ProjectSlug, date: string): Promise<DailyMetricMeta | null> {
  if (isDatabaseEnabled()) return getDailyMetricMeta(project, date);
  const hit = readJsonStore(project).days.find((d) => d.date === date);
  if (!hit) return null;
  return {
    projectSlug: project,
    date: hit.date,
    showInPortfolio: hit.showInPortfolio,
    intents: normalizeIntents(hit.intents),
    note: hit.note,
    summary: hit.summary ?? null,
  };
}

async function loadPortfolioMetas(project: ProjectSlug): Promise<DailyMetricMeta[]> {
  if (isDatabaseEnabled()) return listPortfolioDailyMetrics(project);
  return readJsonStore(project)
    .days.filter((d) => d.showInPortfolio)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((hit) => ({
      projectSlug: project,
      date: hit.date,
      showInPortfolio: true,
      intents: normalizeIntents(hit.intents),
      note: hit.note,
      summary: hit.summary ?? null,
    }));
}

async function saveMeta(
  project: ProjectSlug,
  input: {
    date: string;
    showInPortfolio: boolean;
    intents: DailyIntent[];
    note?: string | null;
    summary?: DailySummary | null;
  },
): Promise<DailyMetricMeta> {
  if (isDatabaseEnabled()) return upsertDailyMetricMeta(project, input);

  const store = readJsonStore(project);
  const idx = store.days.findIndex((d) => d.date === input.date);
  const row = {
    date: input.date,
    showInPortfolio: input.showInPortfolio,
    intents: input.intents,
    note: input.note?.trim() || undefined,
    summary: input.summary ?? null,
  };
  if (idx >= 0) store.days[idx] = row;
  else store.days.push(row);
  writeJsonStore(project, store);
  return {
    projectSlug: project,
    date: row.date,
    showInPortfolio: row.showInPortfolio,
    intents: row.intents,
    note: row.note,
    summary: row.summary,
  };
}

function detailTargetStatus(detail?: string): string | undefined {
  if (!detail) return undefined;
  const m = detail.match(/→\s*(\S+)\s*$/);
  return m?.[1];
}

function toolFromMeta(meta?: Record<string, unknown>, flowPath?: string | null): DailyTool {
  const via = meta?.via;
  if (via === "playwright" || via === "maestro") return via;
  if (via === "manual") return "manual";
  if (flowPath && /\.spec\.(ts|js|tsx|jsx)$/i.test(flowPath)) return "playwright";
  if (flowPath) return "maestro";
  return "other";
}

function emptyAutomated(): DailySummary["automated"] {
  return {
    total: 0,
    passed: 0,
    failed: 0,
    cancelled: 0,
    byTool: { maestro: 0, playwright: 0, other: 0 },
  };
}

function emptyManual(): DailySummary["manual"] {
  return { total: 0, passed: 0, failed: 0, homologated: 0 };
}

function pushHighlight(
  list: DailySummaryHighlight[],
  item: DailySummaryHighlight,
  limit = 10,
) {
  if (list.length >= limit) return;
  list.push(item);
}

function inferIntents(partial: {
  manual: DailySummary["manual"];
  automated: DailySummary["automated"];
  homologations: DailySummary["homologations"];
  kbCuration: DailySummary["kbCuration"];
  bugFixHits: number;
  hasHomologationContext: boolean;
}): DailyIntent[] {
  const intents: DailyIntent[] = [];
  if (
    partial.manual.total > 0 ||
    partial.homologations.created > 0 ||
    partial.homologations.statusChanges > 0 ||
    partial.hasHomologationContext
  ) {
    intents.push("homologacao");
  }
  if (partial.bugFixHits > 0) intents.push("bugfix");
  if (
    partial.kbCuration.reviewed > 0 ||
    partial.kbCuration.merged > 0 ||
    partial.kbCuration.blocked > 0 ||
    partial.kbCuration.imported > 0
  ) {
    intents.push("curadoria_kb");
  }
  return intents;
}

type RunLike = {
  testId: string;
  status: string;
  startedAt: Date | string;
  flowPath?: string | null;
  meta?: Record<string, unknown> | null;
  title?: string;
  testKey?: string;
};

async function loadAutomatedRuns(
  project: ProjectSlug,
  date: string,
  reportsById: Map<string, TestRecord>,
): Promise<RunLike[]> {
  if (isDatabaseEnabled()) {
    const { start, end } = dayBoundsSaoPaulo(date);
    const prisma = getPrisma();
    const rows = await prisma.testRun.findMany({
      where: {
        projectSlug: project,
        startedAt: { gte: start, lte: end },
      },
      orderBy: { startedAt: "asc" },
    });
    return rows.map((r) => ({
      testId: r.testId,
      status: r.status,
      startedAt: r.startedAt,
      flowPath: r.flowPath,
      meta: (r.meta as Record<string, unknown> | null) ?? null,
      title: reportsById.get(r.testId)?.title,
      testKey: reportsById.get(r.testId)?.testKey,
    }));
  }

  const runs: RunLike[] = [];
  for (const report of reportsById.values()) {
    for (const h of report.history ?? []) {
      if (h.action !== "test_run" && h.action !== "automation_passed" && h.action !== "automation_failed") {
        continue;
      }
      if (!isInstantInSaoPauloDay(h.at, date)) continue;
      const result =
        h.action === "automation_passed"
          ? "success"
          : h.action === "automation_failed"
            ? "failed"
            : typeof h.meta?.result === "string"
              ? h.meta.result
              : "success";
      runs.push({
        testId: report.id,
        status: result,
        startedAt: h.at,
        flowPath: typeof h.meta?.flowPath === "string" ? h.meta.flowPath : report.automation?.flowPath,
        meta: h.meta ?? null,
        title: report.title,
        testKey: report.testKey,
      });
    }
  }
  return runs;
}

function tallyAutomated(runs: RunLike[], highlights: DailySummaryHighlight[]) {
  const automated = emptyAutomated();
  for (const run of runs) {
    automated.total += 1;
    if (run.status === "success") automated.passed += 1;
    else if (run.status === "cancelled") automated.cancelled += 1;
    else automated.failed += 1;

    const tool = toolFromMeta(run.meta ?? undefined, run.flowPath);
    if (tool === "playwright") automated.byTool.playwright += 1;
    else if (tool === "maestro") automated.byTool.maestro += 1;
    else automated.byTool.other += 1;

    pushHighlight(highlights, {
      kind: "automated",
      label: run.title ?? run.testKey ?? run.testId,
      status: run.status,
      tool: tool === "manual" ? "other" : tool,
      testKey: run.testKey,
    });
  }
  return automated;
}

function tallyManualFromHistory(
  reports: TestRecord[],
  date: string,
  highlights: DailySummaryHighlight[],
): { manual: DailySummary["manual"]; bugFixHits: number; hasHomologationContext: boolean } {
  const manual = emptyManual();
  let bugFixHits = 0;
  let hasHomologationContext = false;

  for (const report of reports) {
    const isBug = report.recordType === "bug";
    for (const h of report.history ?? []) {
      if (!isInstantInSaoPauloDay(h.at, date)) continue;

      if (h.action === "homologation_changed") {
        const target = detailTargetStatus(h.detail);
        if (target === "passou" || target === "falhou" || target === "homologado") {
          manual.total += 1;
          if (target === "passou") manual.passed += 1;
          else if (target === "falhou") manual.failed += 1;
          else manual.homologated += 1;
          if (report.campaign || report.homologationId) hasHomologationContext = true;
          pushHighlight(highlights, {
            kind: "manual",
            label: report.title,
            status: target,
            tool: "manual",
            testKey: report.testKey,
          });
        }
      }

      if (h.action === "homologated") {
        if (isBug) bugFixHits += 1;
        else {
          // já contado via homologation_changed em muitos fluxos; se só veio homologated:
          const already =
            (report.history ?? []).some(
              (x) =>
                x.action === "homologation_changed" &&
                isInstantInSaoPauloDay(x.at, date) &&
                detailTargetStatus(x.detail) === "homologado",
            );
          if (!already) {
            manual.total += 1;
            manual.homologated += 1;
            pushHighlight(highlights, {
              kind: "manual",
              label: report.title,
              status: "homologado",
              tool: "manual",
              testKey: report.testKey,
            });
          }
        }
      }

      if (isBug && h.action === "status_changed") {
        const target = detailTargetStatus(h.detail);
        if (target === "homologado" || target === "corrigido_gestor") bugFixHits += 1;
      }
    }
  }

  return { manual, bugFixHits, hasHomologationContext };
}

function tallyHomologations(
  historyLists: HistoryEntry[][],
  titlesByCreated: string[],
  date: string,
  highlights: DailySummaryHighlight[],
): DailySummary["homologations"] {
  let created = 0;
  let statusChanges = 0;
  const titles: string[] = [];

  for (const history of historyLists) {
    for (const h of history) {
      if (!isInstantInSaoPauloDay(h.at, date)) continue;
      if (h.action === "homologation_created") {
        created += 1;
      } else if (
        h.action === "homologation_status_changed" ||
        h.action === "homologation_scope_updated"
      ) {
        statusChanges += 1;
      }
    }
  }

  for (const title of titlesByCreated) {
    if (titles.length >= 5) break;
    titles.push(title);
    pushHighlight(highlights, {
      kind: "homologation",
      label: title,
      status: "criada",
    });
  }

  return { created, statusChanges, titles };
}

function tallyKb(
  pullRequests: Array<{ title: string; prNumber: number; history: HistoryEntry[] }>,
  date: string,
  highlights: DailySummaryHighlight[],
): DailySummary["kbCuration"] {
  const kb = { reviewed: 0, merged: 0, blocked: 0, imported: 0 };
  for (const pr of pullRequests) {
    for (const h of pr.history ?? []) {
      if (!isInstantInSaoPauloDay(h.at, date)) continue;
      if (
        h.action === "kb_pr_review_sent" ||
        h.action === "kb_pr_triaged" ||
        h.action === "kb_pr_author_responded"
      ) {
        kb.reviewed += 1;
        pushHighlight(highlights, {
          kind: "kb",
          label: `#${pr.prNumber} ${pr.title}`,
          status: h.action.replace(/^kb_pr_/, ""),
        });
      } else if (h.action === "kb_pr_merged") {
        kb.merged += 1;
        pushHighlight(highlights, {
          kind: "kb",
          label: `#${pr.prNumber} ${pr.title}`,
          status: "merged",
        });
      } else if (h.action === "kb_pr_blocked" || (h.detail && /bloquead/i.test(h.detail))) {
        kb.blocked += 1;
      } else if (h.action === "kb_pr_imported") {
        kb.imported += 1;
      }
    }
  }
  return kb;
}

/** Agrega atividade do dia (ao vivo). Meta/intents/note vêm do store se existirem. */
export async function computeDailySummary(
  project: ProjectSlug,
  date: string,
  opts?: { preferSnapshotForVisitor?: boolean },
): Promise<DailySummary> {
  if (!isValidDateYmd(date)) {
    throw new Error(`Data inválida: ${date}`);
  }

  const meta = await loadMeta(project, date);

  if (opts?.preferSnapshotForVisitor && meta?.showInPortfolio && meta.summary) {
    return {
      ...meta.summary,
      showInPortfolio: true,
      fromSnapshot: true,
      intents: meta.intents.length > 0 ? meta.intents : meta.summary.intents,
      note: meta.note ?? meta.summary.note,
    };
  }

  const [catalog, homCatalog, kbCatalog] = await Promise.all([
    readCatalog(project),
    readHomologationCatalog(project),
    readKbCurationCatalog(project),
  ]);

  const reportsById = new Map(catalog.reports.map((r) => [r.id, r]));
  const highlights: DailySummaryHighlight[] = [];

  const runs = await loadAutomatedRuns(project, date, reportsById);
  const automated = tallyAutomated(runs, highlights);
  const { manual, bugFixHits, hasHomologationContext } = tallyManualFromHistory(
    catalog.reports,
    date,
    highlights,
  );

  const createdTitles: string[] = [];
  for (const h of homCatalog.homologations) {
    const created = (h.history ?? []).find(
      (e) => e.action === "homologation_created" && isInstantInSaoPauloDay(e.at, date),
    );
    if (created) createdTitles.push(h.title);
  }

  const homologations = tallyHomologations(
    homCatalog.homologations.map((h) => h.history ?? []),
    createdTitles,
    date,
    highlights,
  );

  const kbCuration = tallyKb(kbCatalog.pullRequests, date, highlights);

  const hasHomologationCtx =
    hasHomologationContext ||
    runs.some((r) => Boolean(r.meta?.homologationId || r.meta?.homologationSlug));

  const inferred = inferIntents({
    manual,
    automated,
    homologations,
    kbCuration,
    bugFixHits,
    hasHomologationContext: hasHomologationCtx,
  });

  const intents =
    meta?.intents && meta.intents.length > 0 ? meta.intents : inferred;

  return {
    date,
    project,
    timezone: "America/Sao_Paulo",
    generatedAt: new Date().toISOString(),
    showInPortfolio: meta?.showInPortfolio ?? false,
    fromSnapshot: false,
    intents,
    note: meta?.note,
    automated,
    manual,
    homologations,
    kbCuration,
    highlights,
  };
}

export async function publishDailySummary(
  project: ProjectSlug,
  date: string,
  body: {
    showInPortfolio: boolean;
    intents?: DailyIntent[];
    note?: string | null;
  },
): Promise<DailySummary> {
  const live = await computeDailySummary(project, date);
  const intents = body.intents ? normalizeIntents(body.intents) : live.intents;
  const note = body.note === undefined ? live.note : body.note;

  const snapshot: DailySummary = {
    ...live,
    intents,
    note: note?.trim() ? note.trim() : undefined,
    showInPortfolio: body.showInPortfolio,
    fromSnapshot: true,
    generatedAt: new Date().toISOString(),
  };

  await saveMeta(project, {
    date,
    showInPortfolio: body.showInPortfolio,
    intents,
    note: note ?? null,
    summary: body.showInPortfolio ? snapshot : snapshot,
  });

  return {
    ...snapshot,
    fromSnapshot: false,
  };
}

export async function listPortfolioDailyCards(
  project: ProjectSlug,
): Promise<DailyPortfolioCard[]> {
  const metas = await loadPortfolioMetas(project);
  const cards: DailyPortfolioCard[] = [];

  for (const meta of metas) {
    let summary = meta.summary;
    if (!summary) {
      summary = await computeDailySummary(project, meta.date);
    }
    cards.push({
      date: meta.date,
      intents: meta.intents.length > 0 ? meta.intents : summary.intents,
      note: meta.note ?? summary.note,
      automatedTotal: summary.automated.total,
      manualTotal: summary.manual.total,
      kbReviewed: summary.kbCuration.reviewed,
      kbMerged: summary.kbCuration.merged,
      showInPortfolio: true,
    });
  }

  return cards;
}

export function parseIntentsBody(raw: unknown): DailyIntent[] | undefined {
  if (raw === undefined) return undefined;
  const normalized = normalizeIntents(raw);
  // permitir limpar? se array vazio, mantém inferência no publish — ok
  return normalized.filter((i) => DAILY_INTENTS.includes(i));
}

export { isValidDateYmd, todaySaoPaulo } from "./day-bounds.js";
export type { DailyIntent, DailyPortfolioCard, DailySummary } from "./daily-summary-types.js";
