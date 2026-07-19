import {
  appendHistory,
  readCatalog,
  writeCatalog,
} from "./storage.js";
import { CURRENT_USER } from "./config/user.js";
import { recordTestRun } from "./db/test-runs.js";
import type { ProjectSlug } from "./types.js";

export type MaestroRunSession = {
  runId: string;
  project: ProjectSlug;
  testId: string;
  runNumber: number;
  startedAt: string;
  flowPath: string;
  homologationId?: string;
  homologationSlug?: string;
  homologationTitle?: string;
  output: string;
  persisted: boolean;
};

const sessions = new Map<string, MaestroRunSession>();

export function registerRunSession(session: Omit<MaestroRunSession, "output" | "persisted">): void {
  sessions.set(session.runId, { ...session, output: "", persisted: false });
}

export function appendRunSessionOutput(runId: string, chunk: string): void {
  const s = sessions.get(runId);
  if (!s) return;
  s.output = (s.output + chunk).slice(-8000);
}

export function getRunSession(runId: string): MaestroRunSession | undefined {
  return sessions.get(runId);
}

export function markRunSessionPersisted(runId: string): void {
  const s = sessions.get(runId);
  if (s) s.persisted = true;
}

export function clearRunSession(runId: string): void {
  sessions.delete(runId);
}

/** Grava execução cancelada no histórico se ainda não foi persistida (ex.: cancel antes do fim do handler). */
export async function persistCancelledRunSession(
  runId: string,
  extraOutput?: string,
): Promise<{ persisted: boolean; runNumber?: number }> {
  const session = sessions.get(runId);
  if (!session || session.persisted) {
    return { persisted: false, runNumber: session?.runNumber };
  }

  const catalog = await readCatalog(session.project);
  const idx = catalog.reports.findIndex((r) => r.id === session.testId);
  if (idx < 0) return { persisted: false };

  const report = catalog.reports[idx];
  const output = (session.output + (extraOutput ?? "")).slice(-8000).trim();
  const outputBlock =
    output.length > 0
      ? output
      : "[qa-desk] Execução cancelada antes de gerar log do Maestro.";

  report.automation = {
    ...report.automation!,
    lastRunAt: new Date().toISOString(),
    lastRunStatus: "cancelled",
    lastRunOutput: outputBlock,
  };

  appendHistory(report, {
    at: session.startedAt,
    actor: CURRENT_USER.actor,
    action: "test_run",
    detail: [
      "Cancelado pelo usuário",
      session.homologationTitle ? `Homologação: ${session.homologationTitle}` : undefined,
    ]
      .filter(Boolean)
      .join(" · "),
    meta: {
      runNumber: session.runNumber,
      runId: session.runId,
      result: "cancelled",
      exitCode: null,
      via: "maestro",
      flowPath: session.flowPath,
      output: outputBlock,
      homologationId: session.homologationId,
      homologationSlug: session.homologationSlug,
      failedAction: "Execução interrompida",
      errorSummary: "Cancelado pelo usuário",
    },
  });

  catalog.reports[idx] = report;
  await writeCatalog(session.project, catalog);
  await recordTestRun({
    project: session.project,
    testId: session.testId,
    runId: session.runId,
    runNumber: session.runNumber,
    status: "cancelled",
    exitCode: null,
    flowPath: session.flowPath,
    output: outputBlock,
    homologationId: session.homologationId,
    startedAt: session.startedAt,
    meta: {
      via: "maestro",
      homologationSlug: session.homologationSlug,
      errorSummary: "Cancelado pelo usuário",
    },
  });
  session.persisted = true;

  return { persisted: true, runNumber: session.runNumber };
}
