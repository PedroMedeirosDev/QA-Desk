import { useState } from "react";
import {
  Check,
  ChevronDown,
  CircleDot,
  Copy,
  Github,
  MessageCircle,
  Paperclip,
  Pencil,
  Play,
} from "lucide-react";
import { PremiumTooltip } from "@/components/PremiumTooltip";
import { formatActor } from "@/lib/actor";
import {
  formatHistoryTime,
  formatMaestroLog,
  groupHistoryByDay,
  historyEntrySubtitle,
  historyEntryTitle,
  historyEventKind,
  historyRunFailure,
  historyRunOutput,
  historyRunResult,
  type HistoryEventKind,
} from "@/lib/history";
import { maskPii } from "@/lib/redact-pii";
import type { HistoryEntry } from "@/types/test-record";
import { cn } from "@/lib/utils";

function ResultBadge({
  result,
}: {
  result: "success" | "failed" | "cancelled";
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide",
        result === "success" && "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
        result === "failed" && "border-red-500/40 bg-red-500/15 text-red-400",
        result === "cancelled" && "border-amber-500/40 bg-amber-500/15 text-amber-300",
      )}
    >
      {result === "success" ? "Passou" : result === "failed" ? "Falhou" : "Cancelado"}
    </span>
  );
}

function CopyLogButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <PremiumTooltip label="Copiar log completo" side="top">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void copy();
        }}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
        {copied ? "Copiado" : "Copiar log"}
      </button>
    </PremiumTooltip>
  );
}

function FailureCallout({ entry }: { entry: HistoryEntry }) {
  const failure = historyRunFailure(entry);
  if (!failure) return null;

  return (
    <div className="mt-2 rounded-md border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-200">
      <p className="font-medium text-red-300">Onde falhou</p>
      {failure.stepLabel && (
        <p className="mt-1">
          <span className="text-red-400/80">Passo:</span> {failure.stepLabel}
        </p>
      )}
      {failure.action && (
        <p className="mt-0.5">
          <span className="text-red-400/80">
            {failure.flow?.endsWith(".spec.ts") || /playwright/i.test(failure.action)
              ? "Ação Playwright:"
              : "Ação Maestro:"}
          </span>{" "}
          {failure.action}
        </p>
      )}
      {failure.flow && (
        <p className="mt-0.5">
          <span className="text-red-400/80">
            {failure.flow.endsWith(".spec.ts") ? "Spec:" : "Flow:"}
          </span>{" "}
          {failure.flow}
        </p>
      )}
      {failure.errorSummary && (
        <p className="mt-1 font-mono text-[0.7rem] text-red-300/90">
          {failure.errorSummary.slice(0, 280)}
        </p>
      )}
    </div>
  );
}

function CancelledCallout({ entry }: { entry: HistoryEntry }) {
  const subtitle = historyEntrySubtitle(entry);
  return (
    <div className="mt-2 rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
      <p className="font-medium text-amber-300">Teste cancelado manualmente</p>
      {subtitle && <p className="mt-1 text-amber-200/90">{subtitle}</p>}
      {typeof entry.meta?.failedAction === "string" && entry.meta.failedAction && (
        <p className="mt-1 font-mono text-[0.7rem] text-amber-200/80">
          {entry.meta.failedAction}
        </p>
      )}
    </div>
  );
}

const KIND_ICON: Record<HistoryEventKind, typeof Pencil> = {
  github: Github,
  status: CircleDot,
  attachment: Paperclip,
  run: Play,
  discord: MessageCircle,
  system: Pencil,
};

function nodeClass(entry: HistoryEntry): string {
  const result = historyRunResult(entry);
  if (result === "success") return "border-emerald-500 bg-emerald-500";
  if (result === "failed") return "border-red-500 bg-red-500";
  if (result === "cancelled") return "border-amber-500 bg-amber-400";
  const kind = historyEventKind(entry.action);
  if (kind === "github") return "border-zinc-400 bg-zinc-600";
  if (kind === "status") {
    return entry.action === "homologated"
      ? "border-emerald-500/70 bg-emerald-500/40"
      : "border-amber-400/60 bg-amber-400/30";
  }
  if (kind === "attachment") return "border-zinc-400 bg-zinc-500";
  if (kind === "discord") return "border-zinc-400 bg-zinc-600";
  return "border-border bg-muted-foreground/50";
}

function HistoryItem({ entry }: { entry: HistoryEntry }) {
  const result = historyRunResult(entry);
  const subtitle = historyEntrySubtitle(entry);
  const rawOutput = historyRunOutput(entry);
  const log = rawOutput ? formatMaestroLog(maskPii(rawOutput)) : null;
  const kind = historyEventKind(entry.action);
  const Icon = KIND_ICON[kind];

  return (
    <li className="relative pb-6 pl-6 last:pb-0">
      <span
        className={cn(
          "absolute top-1.5 -left-1.5 size-3 rounded-full border-2 border-background",
          nodeClass(entry),
        )}
        aria-hidden
      />
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="font-medium leading-snug">{historyEntryTitle(entry)}</span>
          {result && <ResultBadge result={result} />}
        </div>
        <time
          dateTime={entry.at}
          className="shrink-0 tabular-nums text-xs text-muted-foreground"
        >
          {formatHistoryTime(entry.at)}
        </time>
      </div>

      {subtitle && result !== "cancelled" && (
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
      )}

      <p className="mt-1 text-xs text-muted-foreground/80">Por {formatActor(entry.actor)}</p>

      {result === "failed" && <FailureCallout entry={entry} />}
      {result === "cancelled" && <CancelledCallout entry={entry} />}

      {log && (
        <div className="mt-2 space-y-2">
          {log.preview && (
            <div className="flex items-start gap-2">
              <p
                className={cn(
                  "min-w-0 flex-1 rounded-md border px-3 py-2 font-mono text-xs",
                  result === "failed" && "border-red-500/30 bg-red-500/5 text-red-300",
                  result === "cancelled" && "border-amber-500/30 bg-amber-500/5 text-amber-200",
                  result === "success" && "border-border bg-muted/40 text-muted-foreground",
                  !result && "border-border bg-muted/40 text-muted-foreground",
                )}
              >
                {log.preview}
              </p>
              <CopyLogButton text={log.full || (rawOutput ? maskPii(rawOutput) : "")} />
            </div>
          )}

          {!log.preview && (
            <div className="flex justify-end">
              <CopyLogButton text={log.full || (rawOutput ? maskPii(rawOutput) : "")} />
            </div>
          )}

          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
              <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
              {log.hasMore ? "Ver log completo" : "Detalhe do log"}
            </summary>
            <pre
              className={cn(
                "mt-2 max-h-56 overflow-auto rounded-md border p-3 font-mono text-xs whitespace-pre-wrap",
                result === "cancelled"
                  ? "border-amber-500/25 bg-amber-500/5 text-amber-100"
                  : "bg-muted/40 text-muted-foreground",
              )}
            >
              {log.full || rawOutput}
            </pre>
          </details>
        </div>
      )}
    </li>
  );
}

export function HistoryTimeline({ entries }: { entries: HistoryEntry[] }) {
  const groups = groupHistoryByDay(entries);

  if (groups.length === 0) {
    return (
      <p className="animate-fade-in-up-soft text-sm text-muted-foreground opacity-0">
        Sem eventos ainda.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.dayKey}>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground tabular-nums">
            {group.dayLabel}
          </h3>
          <ol className="relative ml-1.5 border-l border-border">
            {group.items.map((entry, i) => (
              <HistoryItem key={`${entry.at}-${entry.action}-${i}`} entry={entry} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
