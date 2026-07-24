import { Prisma } from "@prisma/client";
import { isDatabaseEnabled } from "./config.js";
import { getPrisma } from "./prisma.js";
import type {
  DailyIntent,
  DailyMetricMeta,
  DailySummary,
} from "../daily-summary-types.js";
import type { ProjectSlug } from "../types.js";

const DAILY_INTENT_SET = new Set<string>([
  "homologacao",
  "bugfix",
  "smoke",
  "exploratorio",
  "curadoria_kb",
]);

export function normalizeIntents(raw: unknown): DailyIntent[] {
  if (!Array.isArray(raw)) return [];
  const out: DailyIntent[] = [];
  for (const item of raw) {
    if (typeof item === "string" && DAILY_INTENT_SET.has(item) && !out.includes(item as DailyIntent)) {
      out.push(item as DailyIntent);
    }
  }
  return out;
}

function rowToMeta(row: {
  projectSlug: string;
  date: string;
  showInPortfolio: boolean;
  intents: unknown;
  note: string | null;
  summary: unknown;
}): DailyMetricMeta {
  return {
    projectSlug: row.projectSlug as ProjectSlug,
    date: row.date,
    showInPortfolio: row.showInPortfolio,
    intents: normalizeIntents(row.intents),
    note: row.note ?? undefined,
    summary: (row.summary as DailySummary | null | undefined) ?? null,
  };
}

export async function getDailyMetricMeta(
  project: ProjectSlug,
  date: string,
): Promise<DailyMetricMeta | null> {
  if (!isDatabaseEnabled()) return null;
  const prisma = getPrisma();
  const row = await prisma.dailyMetric.findUnique({
    where: { projectSlug_date: { projectSlug: project, date } },
  });
  return row ? rowToMeta(row) : null;
}

export async function listPortfolioDailyMetrics(
  project: ProjectSlug,
): Promise<DailyMetricMeta[]> {
  if (!isDatabaseEnabled()) return [];
  const prisma = getPrisma();
  const rows = await prisma.dailyMetric.findMany({
    where: { projectSlug: project, showInPortfolio: true },
    orderBy: { date: "desc" },
  });
  return rows.map(rowToMeta);
}

export async function upsertDailyMetricMeta(
  project: ProjectSlug,
  input: {
    date: string;
    showInPortfolio: boolean;
    intents: DailyIntent[];
    note?: string | null;
    summary?: DailySummary | null;
  },
): Promise<DailyMetricMeta> {
  if (!isDatabaseEnabled()) {
    throw new Error("Postgres necessário para salvar resumo diário");
  }
  const prisma = getPrisma();
  await prisma.project.upsert({
    where: { slug: project },
    create: { slug: project, label: project, metaVersion: "1.0.0" },
    update: {},
  });

  const summaryValue =
    input.summary === null || input.summary === undefined
      ? Prisma.DbNull
      : (input.summary as Prisma.InputJsonValue);

  const data = {
    showInPortfolio: input.showInPortfolio,
    intents: input.intents as unknown as Prisma.InputJsonValue,
    note: input.note?.trim() ? input.note.trim() : null,
    summary: summaryValue,
  };

  const row = await prisma.dailyMetric.upsert({
    where: { projectSlug_date: { projectSlug: project, date: input.date } },
    create: {
      projectSlug: project,
      date: input.date,
      ...data,
    },
    update: data,
  });
  return rowToMeta(row);
}
