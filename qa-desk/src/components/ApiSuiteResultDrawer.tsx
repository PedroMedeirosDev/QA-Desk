import { useEffect, useRef } from "react";
import { Loader2, Terminal, X } from "lucide-react";
import type { ApiSuiteRunResult } from "@/lib/api";
import { cn } from "@/lib/utils";

function formatWhen(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

type Props = {
  open: boolean;
  onClose: () => void;
  suiteLabel: string | null;
  running: boolean;
  result: ApiSuiteRunResult | null;
  liveLines: string[];
  showRaw: boolean;
  onToggleRaw: () => void;
  error: string | null;
};

export function ApiSuiteResultDrawer({
  open,
  onClose,
  suiteLabel,
  running,
  result,
  liveLines,
  showRaw,
  onToggleRaw,
  error,
}: Props) {
  const logRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [liveLines, showRaw, result?.rawCli, open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const title = suiteLabel ?? "Collection";
  const logText = showRaw && result?.rawCli
    ? result.rawCli
    : liveLines.length > 0
      ? liveLines.join("\n")
      : result?.rawCli
        ? result.rawCli.split("\n").slice(0, 40).join("\n") +
          (result.rawCli.split("\n").length > 40
            ? "\n… (abra o log fiel para ver tudo)"
            : "")
        : running
          ? "Aguardando Newman…"
          : "Selecione uma collection e rode a suite.";

  return (
    <>
      <button
        type="button"
        aria-label="Fechar painel"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Resultado da suite API"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-card shadow-2xl transition-transform duration-300 ease-out sm:max-w-lg",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h3 className="truncate font-semibold">
              Resultado — {title}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {running ? (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-300">
                  <Loader2 className="size-3 animate-spin" />
                  Rodando
                </span>
              ) : result ? (
                <span
                  className={cn(
                    "rounded-md border px-2.5 py-0.5 text-sm font-semibold",
                    result.ok
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                      : "border-red-500/40 bg-red-500/15 text-red-300",
                  )}
                >
                  {result.ok ? "OK" : "Falha"}
                </span>
              ) : (
                <span className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  Sem execução
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {formatWhen(result?.ranAt)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {error && (
            <div className="rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          {result && (
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Requests" value={result.summary.requests} />
              <Stat label="Asserts" value={result.summary.assertions} />
              <Stat
                label="Falhas"
                value={result.summary.failed}
                tone={result.summary.failed > 0 ? "bad" : "ok"}
              />
              <Stat
                label="Duração"
                value={`${Math.round(result.summary.durationMs)} ms`}
              />
            </div>
          )}

          {result && result.failures.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-red-300">Falhas</p>
              <ul className="space-y-2 text-sm">
                {result.failures.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2"
                  >
                    <p className="font-medium">{f.name}</p>
                    {f.assertion && (
                      <p className="text-xs text-muted-foreground">{f.assertion}</p>
                    )}
                    {f.error && (
                      <p className="mt-1 text-xs text-red-200/90">{f.error}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Log
              </p>
              <button
                type="button"
                onClick={onToggleRaw}
                disabled={!result?.rawCli}
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs transition-colors",
                  result?.rawCli
                    ? "text-muted-foreground hover:text-foreground"
                    : "cursor-not-allowed text-muted-foreground/50",
                )}
              >
                <Terminal className="size-3.5" />
                {showRaw ? "Ocultar log Newman (fiel)" : "Ver log Newman (fiel)"}
              </button>
            </div>
            <pre
              ref={logRef}
              className="h-64 overflow-auto rounded-lg border border-border bg-black p-3 font-mono text-[11px] leading-relaxed text-zinc-300 sm:h-80"
            >
              {logText}
            </pre>
          </div>
        </div>
      </aside>
    </>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "ok" | "bad";
}) {
  return (
    <div className="rounded-lg border border-border bg-background/50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 font-mono text-lg tabular-nums",
          tone === "bad" && "text-red-400",
          tone === "ok" && "text-emerald-400",
        )}
      >
        {value}
      </p>
    </div>
  );
}
