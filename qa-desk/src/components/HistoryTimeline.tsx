import { useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";
import { PremiumTooltip } from "@/components/PremiumTooltip";
import { formatActor } from "@/lib/actor";
import {
  formatMaestroLog,
  historyEntrySubtitle,
  historyEntryTitle,
  historyRunFailure,
  historyRunOutput,
  historyRunResult,
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
          <span className="text-red-400/80">Ação Maestro:</span> {failure.action}
        </p>
      )}
      {failure.flow && (
        <p className="mt-0.5">
          <span className="text-red-400/80">Flow:</span> {failure.flow}
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

function HistoryItem({ entry }: { entry: HistoryEntry }) {
  const result = historyRunResult(entry);
  const subtitle = historyEntrySubtitle(entry);
  const rawOutput = historyRunOutput(entry);
  const log = rawOutput ? formatMaestroLog(maskPii(rawOutput)) : null;

  return (
    <li className="border-b border-border/60 py-4 last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="font-medium">{historyEntryTitle(entry)}</span>
          {result && <ResultBadge result={result} />}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {new Date(entry.at).toLocaleString("pt-BR")} · {formatActor(entry.actor)}
        </span>
      </div>

      {subtitle && result !== "cancelled" && (
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      )}

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
  const ordered = [...entries].reverse();

  if (ordered.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem eventos ainda.</p>;
  }

  return (
    <ol className="divide-y divide-border/60">
      {ordered.map((entry, i) => (
        <HistoryItem key={`${entry.at}-${entry.action}-${i}`} entry={entry} />
      ))}
    </ol>
  );
}
