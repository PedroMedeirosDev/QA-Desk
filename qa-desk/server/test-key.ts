import path from "node:path";
import type {
  ExecutionMode,
  HistoryEntry,
  TestHomologationStatus,
  ProductChannel,
  TestCatalog,
  TestRecord,
} from "./types.js";

const READINESS_PASS_THRESHOLD = 2;

function migrateTestId(id: string, recordType?: TestRecord["recordType"]): string {
  if (recordType === "bug") return id;
  return id.replace(/^BUG-/, "TEST-");
}

function inferExecutionMode(report: TestRecord): ExecutionMode {
  const auto = report.automation;
  if (auto?.flowPath?.trim() || auto?.playwright?.specPath?.trim()) return "automated";
  return "manual";
}

function inferChannel(report: TestRecord): ProductChannel | undefined {
  if (report.channel) return report.channel;
  if (report.project !== "polygonus") return undefined;
  if (report.platform === "android" || report.platform === "ios") return "app";
  if (report.platform === "web") return "web";
  return "app";
}

function inferHomologationStatus(report: TestRecord): TestHomologationStatus | undefined {
  if (report.recordType === "bug" || (!report.recordType && !report.campaign)) return undefined;
  if (report.homologationStatus) return report.homologationStatus;
  if (report.homologatedAt) return "homologado";
  if (report.automation?.lastRunStatus === "success") return "passou";
  if (report.automation?.lastRunStatus === "failed") return "falhou";
  return "pendente";
}

/** Chave estável — um registro por teste (ex.: mural/01_1_comunicado_enquete) */
export function testKeyFromFlow(flowPath: string): string {
  const base = path.basename(flowPath, path.extname(flowPath));
  const dir = path.basename(path.dirname(flowPath));
  return `${dir}/${base}`;
}

export function slugTestKey(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function deriveTestKey(report: Partial<TestRecord>): string | undefined {
  if (report.testKey) return report.testKey;
  if (report.automation?.flowPath) return testKeyFromFlow(report.automation.flowPath);
  if (report.campaign && report.title) {
    return `${slugTestKey(report.campaign)}/${slugTestKey(report.title)}`;
  }
  return undefined;
}

export function countTestRuns(history: HistoryEntry[]): number {
  return history.filter(
    (h) =>
      h.action === "test_run" ||
      h.action === "automation_passed" ||
      h.action === "automation_failed",
  ).length;
}

/** Passes Maestro com `meta.result === "success"` (ou legado `automation_passed`). */
export function countSuccessfulAutomationRuns(history: HistoryEntry[]): number {
  return history.filter(
    (h) =>
      (h.action === "test_run" && h.meta?.result === "success") ||
      h.action === "automation_passed",
  ).length;
}

/** Promove `readiness` para `ready` após 2 passes. Retorna true se acabou de promover. */
export function applyAutomationReadinessAfterRun(
  automation: NonNullable<TestRecord["automation"]>,
  history: HistoryEntry[],
): boolean {
  const wasReady = automation.readiness === "ready";
  if (countSuccessfulAutomationRuns(history) >= READINESS_PASS_THRESHOLD) {
    automation.readiness = "ready";
    return !wasReady;
  }
  return false;
}

export function nextRunNumber(history: HistoryEntry[]): number {
  return countTestRuns(history) + 1;
}

function mergeReports(target: TestRecord, source: TestRecord) {
  const combined = [...target.history, ...source.history].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
  target.history = combined;
  target.evidence = [...(target.evidence ?? []), ...(source.evidence ?? [])];
  if (source.automation?.lastRunAt) {
    const tLast = target.automation?.lastRunAt
      ? new Date(target.automation.lastRunAt).getTime()
      : 0;
    const sLast = new Date(source.automation.lastRunAt).getTime();
    if (sLast >= tLast) {
      target.automation = { ...target.automation, ...source.automation };
    }
  }
  appendHistory(target, {
    actor: "system",
    action: "records_merged",
    detail: `Registro duplicado ${source.id} unificado neste teste`,
    meta: { mergedId: source.id },
  });
}

function appendHistory(
  report: TestRecord,
  entry: Omit<HistoryEntry, "at"> & { at?: string },
) {
  report.history.push({
    at: entry.at ?? new Date().toISOString(),
    actor: entry.actor,
    action: entry.action,
    detail: entry.detail,
    meta: entry.meta,
  });
}

/** Garante testKey, channel, homologationStatus e funde duplicatas */
export function normalizeCatalog(catalog: TestCatalog): { catalog: TestCatalog; changed: boolean } {
  let changed = false;

  for (const report of catalog.reports) {
    const migratedId = migrateTestId(report.id, report.recordType);
    if (migratedId !== report.id) {
      report.id = migratedId;
      for (const ev of report.evidence ?? []) {
        ev.storageKey = ev.storageKey.replace(/\/BUG-/, "/TEST-");
      }
      changed = true;
    }
    const key = deriveTestKey(report);
    if (key && report.testKey !== key) {
      report.testKey = key;
      changed = true;
    }
    const channel = inferChannel(report);
    if (channel && report.channel !== channel) {
      report.channel = channel;
      changed = true;
    }
    const homologation = inferHomologationStatus(report);
    if (homologation && report.homologationStatus !== homologation) {
      report.homologationStatus = homologation;
      changed = true;
    }
    if (!report.recordType && report.campaign) {
      report.recordType = "teste";
      changed = true;
    }
    const mode = inferExecutionMode(report);
    if (report.executionMode !== mode) {
      report.executionMode = mode;
      changed = true;
    }
    if (report.automation?.flowPath) {
      if (applyAutomationReadinessAfterRun(report.automation, report.history)) {
        changed = true;
      }
    }
  }

  const byKey = new Map<string, TestRecord[]>();
  for (const report of catalog.reports) {
    if (!report.testKey) continue;
    const list = byKey.get(report.testKey) ?? [];
    list.push(report);
    byKey.set(report.testKey, list);
  }

  const toRemove = new Set<string>();
  for (const [, group] of byKey) {
    if (group.length <= 1) continue;
    group.sort((a, b) => a.id.localeCompare(b.id));
    const keeper = group[0];
    for (let i = 1; i < group.length; i++) {
      mergeReports(keeper, group[i]);
      toRemove.add(group[i].id);
      changed = true;
    }
  }

  if (toRemove.size > 0) {
    catalog.reports = catalog.reports.filter((r) => !toRemove.has(r.id));
  }

  return { catalog, changed };
}

export function findByTestKey(
  catalog: TestCatalog,
  testKey: string,
): TestRecord | undefined {
  return catalog.reports.find((r) => r.testKey === testKey);
}
