import type { HistoryEntry } from "@/types/test-record";
import { normalizeMaestroOutput } from "@/lib/maestro-output";
import type { AutomationRunner } from "@/lib/automation-runners";

const RUN_ACTIONS = new Set(["test_run", "automation_passed", "automation_failed"]);

export function countTestRuns(history: HistoryEntry[]): number {
  return history.filter((h) => RUN_ACTIONS.has(h.action)).length;
}

/** Conta execuções atribuíveis ao runner (via meta.via / meta.runner). */
export function countTestRunsForRunner(
  history: HistoryEntry[],
  runner: AutomationRunner,
): number {
  return history.filter((h) => {
    if (!RUN_ACTIONS.has(h.action)) return false;
    const via = h.meta?.via ?? h.meta?.runner;
    if (typeof via !== "string") {
      // Legado sem via → conta só no Maestro
      return runner === "maestro";
    }
    if (runner === "playwright") {
      return via === "playwright" || via.includes("playwright");
    }
    return via === "maestro" || via === "playwright+maestro";
  }).length;
}

export type HistoryEventKind =
  | "github"
  | "status"
  | "attachment"
  | "run"
  | "discord"
  | "system";

/** Chave = `HistoryEntry.action` (snake_case). Não mapear título já traduzido. */
const ACTION_LABELS: Record<string, string> = {
  test_created: "Registro criado",
  test_run: "Execução do teste",
  checklist_synced: "Checklist sincronizado",
  records_merged: "Duplicata unificada",
  homologation_checklist_created: "Checklist criado",
  homologation_changed: "Homologação atualizada",
  homologation_created: "Homologação criada",
  homologation_synced: "Homologação sincronizada",
  homologation_status_changed: "Status da homologação alterado",
  homologation_scope_updated: "Escopo da homologação atualizado",
  created: "Registro criado",
  updated: "Campos atualizados",
  status_changed: "Status alterado",
  homologated: "Homologado",
  evidence_uploaded: "Evidência anexada",
  evidence_removed: "Evidência removida",
  github_issue_created: "Issue aberta no GitHub",
  github_issue_synced: "Issue sincronizada do GitHub",
  github_issue_closed: "Issue fechada no GitHub",
  github_issue_closed_from_desk: "Issue fechada via Desk",
  github_issue_reopened: "Issue reaberta no GitHub",
  github_issue_comment: "Comentário na issue",
  github_issue_comment_edited: "Comentário da issue editado",
  github_issue_comment_catchup: "Comentário sincronizado do GitHub",
  github_issue_dependency: "Dependência da issue atualizada",
  discord_sent: "Enviado ao Discord",
  discord_gestor_reaction: "Reação do gestor no Discord",
  discord_gestor_revoke: "Reação do gestor removida",
  automation_started: "Automação iniciada",
  automation_passed: "Automação passou",
  automation_failed: "Automação falhou",
  "Na fila": "Na fila de execução",
};

export function historyActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function historyEventKind(action: string): HistoryEventKind {
  if (action.startsWith("github_")) return "github";
  if (action.startsWith("discord_")) return "discord";
  if (action === "evidence_uploaded" || action === "evidence_removed") return "attachment";
  if (RUN_ACTIONS.has(action) || action.startsWith("automation_")) return "run";
  if (
    action === "status_changed" ||
    action === "homologated" ||
    action.startsWith("homologation_")
  ) {
    return "status";
  }
  return "system";
}

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function formatHistoryDay(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const diffDays = Math.round(
    (startOfLocalDay(now) - startOfLocalDay(d)) / 86_400_000,
  );
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatHistoryTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function groupHistoryByDay(
  entries: HistoryEntry[],
): { dayKey: string; dayLabel: string; items: HistoryEntry[] }[] {
  const ordered = [...entries].reverse();
  const groups: { dayKey: string; dayLabel: string; items: HistoryEntry[] }[] =
    [];
  for (const entry of ordered) {
    const d = new Date(entry.at);
    const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const last = groups[groups.length - 1];
    if (last?.dayKey === dayKey) {
      last.items.push(entry);
    } else {
      groups.push({
        dayKey,
        dayLabel: formatHistoryDay(entry.at),
        items: [entry],
      });
    }
  }
  return groups;
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
  /** Lista usada no match: resumo ou manual */
  stepSource?: "steps" | "stepsDetailed";
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
  const rawSource = entry.meta?.failedStepSource;
  const stepSource =
    rawSource === "stepsDetailed" || rawSource === "steps"
      ? rawSource
      : rawSource === "stepsManual"
        ? "stepsDetailed"
        : undefined;
  const errorSummary =
    typeof entry.meta?.errorSummary === "string"
      ? entry.meta.errorSummary
      : undefined;

  if (!action && !flow && !stepLabel && !errorSummary) return undefined;
  return { action, flow, stepLabel, stepIndex, stepSource, errorSummary };
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
  /(?:[A-Za-z]:[\\/]+(?:Users[\\/]+[^\\/]+[\\/]+(?:Documents[\\/]+)?Projetos Portfolio[\\/]+(?:Polygonus-QA|QA-Desk|Qa Desk)|projetos[\\/]+QA-Desk)[\\/]+)/gi;

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
