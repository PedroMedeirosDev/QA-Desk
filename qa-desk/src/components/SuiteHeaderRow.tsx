import { ChevronDown, ChevronRight, Hammer, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODULE_LABELS, SUITE_LABELS, type SuiteStats } from "@/lib/suite";
import { SuiteRunnerToggle } from "@/components/SuiteRunnerToggle";
import type { AutomationRunner } from "@/lib/automation-runners";

function formatLastRun(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PassRateBadge({ stats }: { stats: SuiteStats }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[11px] tabular-nums",
        stats.tone === "ok" && "border-emerald-500/35 bg-emerald-500/10 text-emerald-400",
        stats.tone === "fail" && "border-red-500/35 bg-red-500/10 text-red-400",
        stats.tone === "mixed" && "border-amber-500/35 bg-amber-500/10 text-amber-300",
        stats.tone === "neutral" && "border-border bg-muted text-muted-foreground",
      )}
      title={`${stats.passed} de ${stats.total} passou`}
    >
      {stats.passRatePct}%
    </span>
  );
}

function ResultChips({ stats }: { stats: SuiteStats }) {
  return (
    <span className="flex flex-wrap items-center gap-1 text-xs">
      {stats.passed > 0 && (
        <span className="rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-emerald-400">
          {stats.passed} passou
        </span>
      )}
      {stats.failed > 0 && (
        <span className="rounded-full border border-red-500/35 bg-red-500/10 px-2 py-0.5 text-red-400">
          {stats.failed} falhou
        </span>
      )}
      {stats.pending > 0 && (
        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-muted-foreground">
          {stats.pending} pendente
        </span>
      )}
      {stats.passed === 0 && stats.failed === 0 && stats.pending === 0 && (
        <span className="text-muted-foreground">—</span>
      )}
    </span>
  );
}

function RunGroupButton({
  label,
  actionLabel,
  stats,
  onRun,
  runDisabled,
  running,
  runner,
}: {
  label: string;
  actionLabel: string;
  stats: SuiteStats;
  onRun?: () => void;
  runDisabled?: boolean;
  running?: boolean;
  runner?: AutomationRunner;
}) {
  if (!onRun || stats.runnable <= 0) return null;
  const tool =
    runner === "playwright" ? "Playwright" : runner === "maestro" ? "Maestro" : "automação";
  return (
    <button
      type="button"
      title={`Rodar ${actionLabel.toLowerCase()} ${label} (${stats.runnable} ${tool})`}
      disabled={runDisabled}
      onClick={onRun}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors",
        "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/15",
        "disabled:opacity-50",
        running && "bg-emerald-500/15",
      )}
    >
      <Play className="size-3.5" />
      {actionLabel}
    </button>
  );
}

type HeaderVariant = "tests" | "homologation";
type HeaderLevel = "module" | "suite";

function GroupHeaderRow({
  name,
  level,
  stats,
  expanded,
  onToggle,
  onRun,
  runDisabled,
  running,
  variant = "tests",
  meta,
  runner,
  onRunnerChange,
}: {
  name: string;
  level: HeaderLevel;
  stats: SuiteStats;
  expanded: boolean;
  onToggle: () => void;
  onRun?: () => void;
  runDisabled?: boolean;
  running?: boolean;
  variant?: HeaderVariant;
  /** Ex.: "8 suites" no cabeçalho do módulo */
  meta?: string;
  runner?: AutomationRunner;
  onRunnerChange?: (runner: AutomationRunner) => void;
}) {
  const Chevron = expanded ? ChevronDown : ChevronRight;
  const actionLabel = level === "module" ? "Módulo" : "Suite";
  const rowBg =
    level === "module"
      ? "bg-zinc-100/90 dark:bg-zinc-900/60"
      : "bg-zinc-50 dark:bg-zinc-900/35";
  const titleClass =
    level === "module"
      ? "text-sm font-bold tracking-wide text-zinc-800 dark:text-zinc-100"
      : "text-sm font-semibold tracking-wide text-zinc-700 dark:text-zinc-200";
  const indent = level === "suite" ? "pl-2" : "";
  const flowLabel =
    runner === "playwright" ? "com Playwright" : "com flow";

  const titleCell = (
    <td className={cn("px-4 py-2.5", indent)}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 items-center gap-2 text-left"
          aria-expanded={expanded}
          title={expanded ? `Recolher ${name}` : `Expandir ${name}`}
        >
          <Chevron className="size-4 shrink-0 text-muted-foreground" />
          <span className={titleClass}>{name}</span>
          <PassRateBadge stats={stats} />
          {meta && (
            <span className="text-xs font-normal text-muted-foreground">{meta}</span>
          )}
        </button>
        {level === "suite" && runner && onRunnerChange && (
          <SuiteRunnerToggle value={runner} onChange={onRunnerChange} size="xs" />
        )}
      </div>
    </td>
  );

  const actionsCell = (
    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
      <RunGroupButton
        label={name}
        actionLabel={actionLabel}
        stats={stats}
        onRun={onRun}
        runDisabled={runDisabled}
        running={running}
        runner={runner}
      />
    </td>
  );

  if (variant === "homologation") {
    return (
      <tr className={cn("border-b", rowBg)}>
        {titleCell}
        <td className="px-4 py-2.5">
          <ResultChips stats={stats} />
        </td>
        <td className="px-4 py-2.5 text-center tabular-nums text-muted-foreground">
          {stats.totalRuns || "—"}
        </td>
        {actionsCell}
      </tr>
    );
  }

  return (
    <tr className={cn("border-b", rowBg)}>
      {titleCell}
      <td className="px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {stats.runnable > 0 ? (
            <span
              className={cn(
                "rounded-full border px-2 py-0.5",
                runner === "playwright"
                  ? "border-sky-500/35 bg-sky-500/10 text-sky-300"
                  : "border-sky-500/35 bg-sky-500/10 text-sky-300",
              )}
              title={
                runner === "playwright"
                  ? "CTs com spec Playwright"
                  : "CTs com flow Maestro (executáveis). Inclui rascunho e estáveis."
              }
            >
              {stats.runnable} {flowLabel}
            </span>
          ) : (
            <span className="text-muted-foreground">
              {runner === "playwright" ? "Sem Playwright" : "Manual"}
            </span>
          )}
          {stats.draftCount > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-amber-300"
              title={`${stats.draftCount} ainda em rascunho`}
            >
              <Hammer className="size-3" />
              {stats.draftCount} rascunho{stats.draftCount === 1 ? "" : "s"}
            </span>
          )}
          {stats.readyCount > 0 && stats.draftCount > 0 && (
            <span
              className="rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-emerald-300"
              title={`${stats.readyCount} validados`}
            >
              {stats.readyCount} estáve{stats.readyCount === 1 ? "l" : "is"}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-2.5">
        <ResultChips stats={stats} />
      </td>
      <td className="px-4 py-2.5 text-center tabular-nums text-muted-foreground">
        {stats.totalRuns}
      </td>
      <td className="px-4 py-2.5 text-xs text-muted-foreground">
        {formatLastRun(stats.lastRunAt)}
      </td>
      {actionsCell}
    </tr>
  );
}

export function SuiteHeaderRow({
  suite,
  stats,
  expanded,
  onToggle,
  onRunSuite,
  runDisabled,
  running,
  variant = "tests",
  runner,
  onRunnerChange,
}: {
  suite: string;
  stats: SuiteStats;
  expanded: boolean;
  onToggle: () => void;
  onRunSuite?: () => void;
  runDisabled?: boolean;
  running?: boolean;
  variant?: HeaderVariant;
  runner?: AutomationRunner;
  onRunnerChange?: (runner: AutomationRunner) => void;
}) {
  return (
    <GroupHeaderRow
      name={SUITE_LABELS[suite] ?? suite}
      level="suite"
      stats={stats}
      expanded={expanded}
      onToggle={onToggle}
      onRun={onRunSuite}
      runDisabled={runDisabled}
      running={running}
      variant={variant}
      runner={runner}
      onRunnerChange={onRunnerChange}
    />
  );
}

export function ModuleHeaderRow({
  module,
  suiteCount,
  stats,
  expanded,
  onToggle,
  onRunModule,
  runDisabled,
  running,
  variant = "tests",
}: {
  module: string;
  suiteCount: number;
  stats: SuiteStats;
  expanded: boolean;
  onToggle: () => void;
  onRunModule?: () => void;
  runDisabled?: boolean;
  running?: boolean;
  variant?: HeaderVariant;
}) {
  return (
    <GroupHeaderRow
      name={MODULE_LABELS[module] ?? module}
      level="module"
      stats={stats}
      expanded={expanded}
      onToggle={onToggle}
      onRun={onRunModule}
      runDisabled={runDisabled}
      running={running}
      variant={variant}
      meta={`${suiteCount} suite${suiteCount === 1 ? "" : "s"}`}
    />
  );
}
