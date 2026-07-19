import type { HistoryEntry } from "@/types/test-record";
import { normalizeMaestroOutput } from "@/lib/maestro-output";

const RUN_ACTIONS = new Set(["test_run", "automation_passed", "automation_failed"]);

export function countTestRuns(history: HistoryEntry[]): number {
  return history.filter((h) => RUN_ACTIONS.has(h.action)).length;
}

export function historyActionLabel(action: string): string {
  const labels: Record<string, string> = {
    test_created: "Teste criado",
    test_run: "Execução do teste",
    checklist_synced: "Checklist sincronizado",
    records_merged: "Duplicata unificada",
    homologation_checklist_created: "Checklist criado",
    homologation_changed: "Homologação atualizada",
    created: "Registro criado",
    updated: "Atualizado",
    status_changed: "Status alterado",
    homologated: "Homologado",
    evidence_uploaded: "Print anexado",
    automation_started: "Automação iniciada",
    automation_passed: "Automação passou",
    automation_failed: "Automação falhou",
  };
  return labels[action] ?? action;
}

export function historyEntryTitle(entry: HistoryEntry): string {
  if (entry.action === "test_run" && entry.meta?.runNumber) {
    return `Execução #${entry.meta.runNumber as number}`;
  }
  return historyActionLabel(entry.action);
}

export function historyRunResult(
  entry: HistoryEntry,
): "success" | "failed" | "cancelled" | undefined {
  if (entry.action !== "test_run") return undefined;
  const result = entry.meta?.result;
  if (result === "success" || result === "failed" || result === "cancelled") {
    return result;
  }
  return undefined;
}

/** Contexto curto — evita repetir número/status já mostrados no título. */
export function historyEntrySubtitle(entry: HistoryEntry): string | undefined {
  if (entry.action === "test_run") {
    if (entry.meta?.result === "cancelled") {
      return entry.detail?.includes("Cancelado")
        ? entry.detail
        : "Cancelado pelo usuário";
    }
    const parts: string[] = [];
    if (entry.meta?.via === "maestro") parts.push("Maestro");
    if (typeof entry.meta?.appVersion === "string" && entry.meta.appVersion) {
      parts.push(`v${entry.meta.appVersion}`);
    }
    const homSlug = entry.meta?.homologationSlug;
    if (typeof homSlug === "string") parts.push(homSlug);
    return parts.length > 0 ? parts.join(" · ") : undefined;
  }

  return entry.detail || undefined;
}

export function historyRunFailure(entry: HistoryEntry): {
  action?: string;
  flow?: string;
  stepLabel?: string;
  stepIndex?: number;
  errorSummary?: string;
} | undefined {
  if (entry.action !== "test_run") return undefined;
  if (entry.meta?.result !== "failed") return undefined;

  const action =
    typeof entry.meta?.failedAction === "string"
      ? entry.meta.failedAction
      : undefined;
  const flow =
    typeof entry.meta?.failedFlow === "string" ? entry.meta.failedFlow : undefined;
  const stepLabel =
    typeof entry.meta?.failedStepLabel === "string"
      ? entry.meta.failedStepLabel
      : undefined;
  const stepIndex =
    typeof entry.meta?.failedStepIndex === "number"
      ? entry.meta.failedStepIndex
      : undefined;
  const errorSummary =
    typeof entry.meta?.errorSummary === "string"
      ? entry.meta.errorSummary
      : undefined;

  if (!action && !flow && !stepLabel && !errorSummary) return undefined;
  return { action, flow, stepLabel, stepIndex, errorSummary };
}

export function historyRunOutput(entry: HistoryEntry): string | undefined {
  if (entry.action !== "test_run") return undefined;
  const output = entry.meta?.output;
  return typeof output === "string" && output.length > 0 ? output : undefined;
}

/** Última execução Maestro no histórico (sucesso ou falha). */
export function latestTestRun(
  history: HistoryEntry[],
): HistoryEntry | undefined {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].action === "test_run") return history[i];
  }
  return undefined;
}

/**
 * Falha ainda “aberta”: só se a **última** rodada falhou.
 * Se depois passou, o destaque nos passos some (erro considerado corrigido).
 */
export function activeFailedRun(
  history: HistoryEntry[],
): HistoryEntry | undefined {
  const latest = latestTestRun(history);
  if (!latest || latest.meta?.result !== "failed") return undefined;
  return latest;
}

/** @deprecated Prefer activeFailedRun — não ignore sucesso posterior. */
export function latestFailedRun(
  history: HistoryEntry[],
): HistoryEntry | undefined {
  return activeFailedRun(history);
}

const REPO_PATH_PREFIX =
  /C:\\Users\\[^\\]+\\Projetos Portfolio\\Polygonus-QA\\/gi;

/** Encurta paths do Windows e remove ruído de marketing do Maestro. */
export function formatMaestroLog(output: string): {
  preview: string;
  full: string;
  hasMore: boolean;
} {
  const full = normalizeMaestroOutput(output)
    .replace(/\r\n/g, "\n")
    .replace(REPO_PATH_PREFIX, "")
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t) return false;
      if (t.startsWith("===")) return false;
      if (t.includes("Debug tests faster")) return false;
      if (t.includes("maestro cloud app_file")) return false;
      if (/^[?╭╰│─]+$/.test(t)) return false;
      return true;
    })
    .join("\n")
    .trim();

  const lines = full.split("\n").filter(Boolean);
  const priority =
    lines.find((line) => /cancelad/i.test(line)) ??
    lines.find((line) =>
      /instrumentation could not|Assertion is false|Unknown Property|Invalid File|Flow path does not exist|Element not found/i.test(
        line,
      ),
    ) ??
    lines.find((line) => /FAILED|Error:|Exception/i.test(line) && !/CoroutineScheduler/i.test(line)) ??
    lines.find((line) => /failed|error|assertion|unknown property|invalid/i.test(line)) ??
    lines[lines.length - 1] ??
    lines[0] ??
    "";

  return {
    preview: priority.slice(0, 320),
    full,
    hasMore: full.length > priority.length + 20,
  };
}
