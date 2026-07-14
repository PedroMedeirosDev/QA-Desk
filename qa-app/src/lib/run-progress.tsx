import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TestRecord } from "@/types/test-record";

export type RunFailure = {
  failedAction?: string;
  failedFlow?: string;
  errorSummary?: string;
  failedStepIndex?: number;
  failedStepLabel?: string;
};

export type RunAutomationResult = {
  ok: boolean;
  exitCode: number | null;
  runNumber: number;
  output?: string;
  appVersion?: string;
  failure?: RunFailure;
  homologationId?: string;
  report: TestRecord;
};

type ProgressEvent =
  | {
      type: "start";
      testId: string;
      title: string;
      runNumber: number;
      flowPath?: string;
      phase?: string;
    }
  | {
      type: "progress";
      phase?: string;
      action?: string;
      status?: "running" | "ok" | "fail";
    }
  | { type: "log"; line: string }
  | ({ type: "done" } & RunAutomationResult)
  | { type: "error"; message: string };

export type LiveRunState = {
  active: boolean;
  testId?: string;
  title?: string;
  runNumber?: number;
  phase?: string;
  action?: string;
  batchLabel?: string;
  lines: string[];
  startedAt?: number;
  result?: "success" | "failed";
  error?: string;
};

type RunProgressContextValue = {
  state: LiveRunState;
  running: boolean;
  runAutomation: (opts: {
    project: string;
    testId: string;
    title?: string;
    homologationId?: string;
    batchLabel?: string;
  }) => Promise<RunAutomationResult>;
  dismiss: () => void;
};

const RunProgressContext = createContext<RunProgressContextValue | null>(null);

const idle: LiveRunState = { active: false, lines: [] };

function formatElapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r.toString().padStart(2, "0")}s` : `${r}s`;
}

export function RunProgressProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LiveRunState>(idle);

  const runAutomation = useCallback(
    async (opts: {
      project: string;
      testId: string;
      title?: string;
      homologationId?: string;
      batchLabel?: string;
    }) => {
      setState({
        active: true,
        testId: opts.testId,
        title: opts.title ?? opts.testId,
        batchLabel: opts.batchLabel,
        phase: "Iniciando Maestro…",
        action: undefined,
        lines: [],
        startedAt: Date.now(),
        result: undefined,
        error: undefined,
      });

      const res = await fetch(
        `/api/projects/${opts.project}/automation/tests/${opts.testId}/run?stream=1`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/x-ndjson",
          },
          body: JSON.stringify(
            opts.homologationId ? { homologationId: opts.homologationId } : {},
          ),
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        const message = (err as { error?: string }).error ?? "Erro na API";
        setState((s) => ({
          ...s,
          active: true,
          result: "failed",
          error: message,
          phase: "Falha ao iniciar",
        }));
        throw new Error(message);
      }

      if (!res.body) {
        throw new Error("Resposta sem corpo (streaming indisponível)");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let final: RunAutomationResult | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n");
        buffer = parts.pop() ?? "";

        for (const raw of parts) {
          const line = raw.trim();
          if (!line) continue;
          let ev: ProgressEvent;
          try {
            ev = JSON.parse(line) as ProgressEvent;
          } catch {
            continue;
          }

          if (ev.type === "start") {
            setState((s) => ({
              ...s,
              title: ev.title || s.title,
              runNumber: ev.runNumber,
              phase: ev.phase ?? s.phase,
            }));
          } else if (ev.type === "log") {
            setState((s) => ({
              ...s,
              lines: [...s.lines.slice(-80), ev.line].filter(Boolean),
            }));
          } else if (ev.type === "progress") {
            setState((s) => ({
              ...s,
              phase: ev.phase ?? s.phase,
              action: ev.action ?? s.action,
            }));
          } else if (ev.type === "done") {
            const { type: _t, ...rest } = ev;
            final = rest as RunAutomationResult;
            setState((s) => ({
              ...s,
              result: final!.ok ? "success" : "failed",
              phase: final!.ok ? "Concluído" : "Falhou",
              action:
                final!.failure?.failedStepLabel ??
                final!.failure?.failedAction ??
                s.action,
            }));
          } else if (ev.type === "error") {
            setState((s) => ({
              ...s,
              result: "failed",
              error: ev.message,
              phase: "Erro",
            }));
            throw new Error(ev.message);
          }
        }
      }

      if (!final) {
        setState((s) => ({
          ...s,
          result: "failed",
          error: "Execução encerrada sem resultado",
          phase: "Erro",
        }));
        throw new Error("Execução encerrada sem resultado");
      }

      return final;
    },
    [],
  );

  const value = useMemo(
    () => ({
      state,
      running: state.active && !state.result && !state.error,
      runAutomation,
      dismiss: () => setState(idle),
    }),
    [state, runAutomation],
  );

  return (
    <RunProgressContext.Provider value={value}>
      {children}
      <RunProgressPanel />
    </RunProgressContext.Provider>
  );
}

export function useRunProgress() {
  const ctx = useContext(RunProgressContext);
  if (!ctx) throw new Error("useRunProgress fora do provider");
  return ctx;
}

function RunProgressPanel() {
  const { state, dismiss } = useRunProgress();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!state.active || state.result) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [state.active, state.result]);

  if (!state.active) return null;

  const elapsed =
    state.startedAt != null ? formatElapsed(now - state.startedAt) : "—";
  const running = !state.result && !state.error;

  // Tail fixo: sem scrollbar — o card só mostra as últimas linhas
  const tailLines = state.lines
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-6);

  return (
    <div className="pointer-events-none fixed right-3 bottom-3 z-50 w-[min(100%-1.5rem,20rem)] sm:right-4 sm:bottom-4">
      <div
        className={cn(
          "pointer-events-auto overflow-hidden rounded-xl border bg-card/95 shadow-xl backdrop-blur-sm transition-colors",
          state.result === "success" && "border-emerald-500/45",
          state.result === "failed" && "border-red-500/45",
          running && "border-sky-500/45",
        )}
      >
        <div className="flex items-start gap-2.5 px-3 py-2.5">
          <div className="mt-0.5 shrink-0">
            {running ? (
              <Loader2 className="size-4 animate-spin text-sky-400" />
            ) : state.result === "success" ? (
              <Check className="size-4 text-emerald-400" />
            ) : (
              <X className="size-4 text-red-400" />
            )}
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex items-baseline justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-semibold leading-tight">
                {state.batchLabel ? `${state.batchLabel} · ` : ""}
                {state.title}
              </p>
              <span className="shrink-0 text-[0.65rem] text-muted-foreground">
                {state.runNumber != null ? `#${state.runNumber} · ` : ""}
                {elapsed}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-foreground/90">
              {state.phase ?? "Maestro"}
            </p>
            {state.action && (
              <p className="mt-0.5 truncate font-mono text-[0.65rem] text-muted-foreground">
                {state.action}
              </p>
            )}
            {state.error && (
              <p className="mt-1 break-words text-[0.7rem] text-red-300">
                {state.error}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Fechar"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <div className="border-t border-border/60 bg-muted/20 px-3 py-2">
          <p className="mb-1 text-[0.65rem] text-muted-foreground">
            {running ? "Ao vivo" : "Últimas linhas"}
            {state.lines.length > tailLines.length
              ? ` · ${state.lines.length} no total`
              : ""}
          </p>
          <div className="space-y-0.5 overflow-hidden font-mono text-[0.6rem] leading-snug text-muted-foreground">
            {tailLines.length > 0 ? (
              tailLines.map((line, i) => (
                <p key={`${i}-${line.slice(0, 24)}`} className="break-words">
                  {line}
                </p>
              ))
            ) : (
              <p>{running ? "Aguardando saída do Maestro…" : "—"}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
