import {
  Component,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  GripVertical,
  Loader2,
  Minimize2,
  Square,
  X,
} from "lucide-react";
import { authHeaders } from "@/lib/auth-token";
import {
  curateMaestroLogLines,
  MAX_LIVE_MAESTRO_LINES,
  normalizeMaestroOutput,
} from "@/lib/maestro-output";
import { interpretMaestroLine } from "@/lib/maestro-progress";
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
  runId?: string;
  cancelled?: boolean;
  output?: string;
  appVersion?: string;
  failure?: RunFailure;
  stage?: "all" | "prep" | "maestro";
  stages?: string[];
  prepOk?: boolean;
  failedStage?: "playwright" | "maestro";
  homologationId?: string;
  report: TestRecord;
};

export const RUN_CANCELLED_MESSAGE = "Cancelado pelo usuário";

/**
 * Parar no lote: o cancel da API só mata o CT atual.
 * Este flag impede o loop (módulo/suite/campanha) de iniciar o próximo.
 */
let batchStopRequested = false;

export function requestBatchStop(): void {
  batchStopRequested = true;
}

export function clearBatchStop(): void {
  batchStopRequested = false;
}

export function isBatchStopRequested(): boolean {
  return batchStopRequested;
}

type ProgressEvent =
  | {
      type: "start";
      testId: string;
      title: string;
      runNumber: number;
      runId?: string;
      project?: string;
      flowPath?: string;
      phase?: string;
    }
  | {
      type: "progress";
      phase?: string;
      action?: string;
      flowFile?: string;
      status?: "running" | "ok" | "fail" | "skipped";
    }
  | { type: "log"; line: string }
  | { type: "heartbeat"; idleMs: number; phase?: string }
  | ({ type: "done" } & RunAutomationResult)
  | { type: "error"; message: string };

export type LiveRunState = {
  active: boolean;
  project?: string;
  runId?: string;
  testId?: string;
  title?: string;
  runNumber?: number;
  phase?: string;
  action?: string;
  flowFile?: string;
  idleMs?: number;
  lastLineAt?: number;
  batchLabel?: string;
  lines: string[];
  startedAt?: number;
  stopping?: boolean;
  result?: "success" | "failed" | "cancelled";
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
    recordVideo?: boolean;
    stage?: "all" | "prep" | "maestro";
  }) => Promise<RunAutomationResult>;
  stopRun: () => Promise<void>;
  dismiss: () => void;
};

const RunProgressContext = createContext<RunProgressContextValue | null>(null);

const idle: LiveRunState = { active: false, lines: [] };

const PANEL_STORAGE_KEY = "qa-run-panel-v1";
const RUN_STATE_STORAGE_KEY = "qa-run-state-v1";

export const QA_RUN_FINISHED_EVENT = "qa-run-finished";

type PanelPrefs = {
  x: number;
  y: number;
  logOpen: boolean;
  minimized: boolean;
  /** limpo = narrativa; completo = stdout bruto */
  logMode: "limpo" | "completo";
};

type RunListener = (state: LiveRunState) => void;

let runState: LiveRunState = loadRunState();
const runListeners = new Set<RunListener>();
let activeAbort: AbortController | null = null;

function loadRunState(): LiveRunState {
  try {
    const raw = sessionStorage.getItem(RUN_STATE_STORAGE_KEY);
    if (!raw) return idle;
    const parsed = JSON.parse(raw) as LiveRunState;
    if (!parsed?.active) return idle;
    return {
      ...idle,
      ...parsed,
      lines: Array.isArray(parsed.lines) ? parsed.lines : [],
    };
  } catch {
    return idle;
  }
}

function persistRunState(next: LiveRunState) {
  try {
    if (!next.active) {
      sessionStorage.removeItem(RUN_STATE_STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(RUN_STATE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function publishRunState(next: LiveRunState) {
  runState = next;
  persistRunState(next);
  runListeners.forEach((listener) => listener(runState));
}

function subscribeRunState(listener: RunListener) {
  runListeners.add(listener);
  listener(runState);
  return () => {
    runListeners.delete(listener);
  };
}

function loadPanelPrefs(): PanelPrefs | null {
  try {
    const raw = localStorage.getItem(PANEL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PanelPrefs>;
    if (typeof parsed.x !== "number" || typeof parsed.y !== "number") return null;
    return {
      x: parsed.x,
      y: parsed.y,
      logOpen: parsed.logOpen ?? false,
      minimized: parsed.minimized ?? false,
      logMode: parsed.logMode === "completo" ? "completo" : "limpo",
    };
  } catch {
    return null;
  }
}

function savePanelPrefs(prefs: PanelPrefs) {
  try {
    localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

function defaultPanelPrefs(): PanelPrefs {
  return {
    x: Math.max(12, window.innerWidth - 340),
    y: Math.max(12, window.innerHeight - 120),
    logOpen: false,
    minimized: false,
    logMode: "limpo",
  };
}

async function ensureNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    return (await Notification.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

function playCompletionChime(ok: boolean) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = ok ? 880 : 440;
    gain.gain.value = 0.08;
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.12 : 0.25));
    void ctx.close();
  } catch {
    /* ignore */
  }
}

function flashDocumentTitle(state: LiveRunState) {
  const prefix = state.result === "success" ? "[OK] " : "[FALHOU] ";
  const original = document.title;
  document.title = `${prefix}${state.title ?? "Teste"} — QA`;
  window.setTimeout(() => {
    document.title = original;
  }, 8000);
}

function notifyRunComplete(state: LiveRunState) {
  if (state.result === "cancelled") return;
  notifyRunCompleteInner(state);
}

function notifyRunCompleteInner(state: LiveRunState) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const ok = state.result === "success";
  const title = ok ? "Teste passou" : "Teste falhou";
  const parts = [
    state.batchLabel,
    state.title,
    state.runNumber != null ? `#${state.runNumber}` : null,
    state.action ?? state.phase,
  ].filter(Boolean);

  try {
    const notification = new Notification(title, {
      body: parts.join(" · "),
      tag: `qa-run-${state.testId ?? "batch"}-${state.runNumber ?? Date.now()}`,
      requireInteraction: !ok,
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    /* ignore */
  }
}

function signalRunComplete(state: LiveRunState) {
  notifyRunComplete(state);
  playCompletionChime(state.result === "success");
  flashDocumentTitle(state);
  window.dispatchEvent(
    new CustomEvent<LiveRunState>(QA_RUN_FINISHED_EVENT, { detail: state }),
  );
}

function appendLiveLines(prev: string[], ...extra: string[]): string[] {
  const next = [...prev, ...extra.map((l) => l.trim()).filter(Boolean)];
  return next.length > MAX_LIVE_MAESTRO_LINES
    ? next.slice(-MAX_LIVE_MAESTRO_LINES)
    : next;
}

function applyMaestroLine(state: LiveRunState, rawLine: string): LiveRunState {
  const line = normalizeMaestroOutput(rawLine);
  const info = interpretMaestroLine(rawLine);
  return {
    ...state,
    lines: appendLiveLines(state.lines, line),
    lastLineAt: Date.now(),
    idleMs: 0,
    ...(info
      ? {
          phase: info.phase ?? state.phase,
          action: info.action ?? state.action,
          flowFile: info.flowFile ?? state.flowFile,
        }
      : {}),
  };
}

function formatElapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r.toString().padStart(2, "0")}s` : `${r}s`;
}

export function RunProgressProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LiveRunState>(runState);

  useEffect(() => subscribeRunState(setState), []);

  const runAutomation = useCallback(
    async (opts: {
      project: string;
      testId: string;
      title?: string;
      homologationId?: string;
      batchLabel?: string;
      recordVideo?: boolean;
      stage?: "all" | "prep" | "maestro";
    }) => {
      if (isBatchStopRequested()) {
        throw new Error(RUN_CANCELLED_MESSAGE);
      }

      await ensureNotificationPermission();

      activeAbort?.abort();
      activeAbort = new AbortController();

      const stage = opts.stage ?? "all";
      const startPhase =
        stage === "prep"
          ? "Iniciando Playwright (seed)…"
          : stage === "maestro"
            ? opts.recordVideo
              ? "Iniciando Maestro + gravação…"
              : "Iniciando Maestro…"
            : opts.recordVideo
              ? "Iniciando Playwright → Maestro + gravação…"
              : "Iniciando Playwright → Maestro…";

      const baseState: LiveRunState = {
        active: true,
        project: opts.project,
        testId: opts.testId,
        title: opts.title ?? opts.testId,
        batchLabel: opts.batchLabel,
        phase: startPhase,
        action: undefined,
        lines: [],
        startedAt: Date.now(),
        stopping: false,
        result: undefined,
        error: undefined,
      };
      publishRunState(baseState);

      const res = await fetch(
        `/api/projects/${opts.project}/automation/tests/${opts.testId}/run?stream=1`,
        {
          method: "POST",
          headers: authHeaders({
            "Content-Type": "application/json",
            Accept: "application/x-ndjson",
          }),
          body: JSON.stringify({
            ...(opts.homologationId
              ? { homologationId: opts.homologationId }
              : {}),
            ...(opts.recordVideo ? { recordVideo: true } : {}),
            ...(stage !== "all" ? { stage } : {}),
          }),
          signal: activeAbort.signal,
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        const message = (err as { error?: string }).error ?? "Erro na API";
        const failed: LiveRunState = {
          ...baseState,
          result: "failed",
          error: message,
          phase: "Falha ao iniciar",
        };
        publishRunState(failed);
        signalRunComplete(failed);
        throw new Error(message);
      }

      if (!res.body) {
        throw new Error("Resposta sem corpo (streaming indisponível)");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let final: RunAutomationResult | null = null;
      let latest = baseState;

      const commit = (next: LiveRunState) => {
        latest = next;
        publishRunState(next);
      };

      try {
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
              commit({
                ...latest,
                project: ev.project ?? latest.project ?? opts.project,
                runId: ev.runId,
                title: ev.title || latest.title,
                runNumber: ev.runNumber,
                phase: ev.phase ?? latest.phase,
                flowFile: ev.flowPath?.split("/").pop(),
                lastLineAt: Date.now(),
                idleMs: 0,
              });
            } else if (ev.type === "log") {
              commit(applyMaestroLine(latest, ev.line));
            } else if (ev.type === "progress") {
              commit({
                ...latest,
                phase: ev.phase ?? latest.phase,
                action: ev.action ?? latest.action,
                flowFile: ev.flowFile ?? latest.flowFile,
                lastLineAt: Date.now(),
                idleMs: 0,
              });
            } else if (ev.type === "heartbeat") {
              commit({
                ...latest,
                idleMs: ev.idleMs,
                phase: ev.phase ?? latest.phase,
              });
            } else if (ev.type === "done") {
              const { type: _t, ...rest } = ev;
              final = rest as RunAutomationResult;
              const cancelled = Boolean(final.cancelled);
              const doneState: LiveRunState = {
                ...latest,
                stopping: false,
                result: cancelled ? "cancelled" : final.ok ? "success" : "failed",
                phase: cancelled ? "Cancelado" : final.ok ? "Concluído" : "Falhou",
                action:
                  final.failure?.failedStepLabel ??
                  final.failure?.failedAction ??
                  latest.action,
                error: cancelled ? RUN_CANCELLED_MESSAGE : latest.error,
              };
              commit(doneState);
              signalRunComplete(doneState);
            } else if (ev.type === "error") {
              const errState: LiveRunState = {
                ...latest,
                result: "failed",
                error: ev.message,
                phase: "Erro",
              };
              commit(errState);
              signalRunComplete(errState);
              throw new Error(ev.message);
            }
          }
        }

        if (!final) {
          if (latest.stopping || activeAbort?.signal.aborted || isBatchStopRequested()) {
            const cancelled: LiveRunState = {
              ...latest,
              stopping: false,
              result: "cancelled",
              phase: "Cancelado",
              error: RUN_CANCELLED_MESSAGE,
            };
            commit(cancelled);
            throw new Error(RUN_CANCELLED_MESSAGE);
          }
          const orphan: LiveRunState = {
            ...latest,
            result: "failed",
            error: "Execução encerrada sem resultado",
            phase: "Erro",
          };
          commit(orphan);
          signalRunComplete(orphan);
          throw new Error("Execução encerrada sem resultado");
        }

        if (isBatchStopRequested() || final.cancelled) {
          return { ...final, cancelled: true, ok: false };
        }

        return final;
      } catch (e) {
        if (
          e instanceof DOMException &&
          e.name === "AbortError" &&
          !final
        ) {
          const cancelled: LiveRunState = {
            ...latest,
            stopping: false,
            result: "cancelled",
            phase: "Cancelado",
            error: RUN_CANCELLED_MESSAGE,
          };
          commit(cancelled);
          throw new Error(RUN_CANCELLED_MESSAGE);
        }
        throw e;
      }
    },
    [],
  );

  const stopRun = useCallback(async () => {
    const s = runState;
    if (!s.active || s.result || s.stopping) return;

    // Só marca parada de lote quando há suite/módulo/campanha em andamento.
    // Em CT avulso, requestBatchStop() ficava true para sempre e o próximo Play
    // falhava na hora com "Cancelado pelo usuário" até dar F5.
    const inBatch = Boolean(s.batchLabel);
    if (inBatch) {
      requestBatchStop();
    }

    const finishCancel = (extraLine?: string) => {
      if (!inBatch) clearBatchStop();
      const doneState: LiveRunState = {
        ...runState,
        stopping: false,
        result: "cancelled",
        phase: "Cancelado",
        error: RUN_CANCELLED_MESSAGE,
        lines: extraLine
          ? appendLiveLines(runState.lines, extraLine)
          : runState.lines,
      };
      publishRunState(doneState);
      signalRunComplete(doneState);
      activeAbort?.abort();
    };

    publishRunState({
      ...s,
      stopping: true,
      phase: "Parando Maestro…",
      lines: appendLiveLines(
        s.lines,
        inBatch
          ? "[qa-desk] Solicitando parada (lote será interrompido)…"
          : "[qa-desk] Solicitando parada…",
      ),
    });

    try {
      if (s.project) {
        const res = await fetch(`/api/projects/${s.project}/automation/runs/cancel`, {
          method: "POST",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ runId: s.runId }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          cancelled?: boolean;
          persisted?: boolean;
        };
        if (data.persisted || data.cancelled) {
          finishCancel();
          return;
        }

        finishCancel(
          inBatch
            ? "[qa-desk] Nenhum processo Maestro ativo (prep/adb) — cancelamento registrado; lote parado."
            : "[qa-desk] Nenhum processo Maestro ativo (prep/adb) — cancelamento registrado.",
        );
        return;
      }
    } catch {
      /* ignore */
    }

    finishCancel("[qa-desk] Parada local (servidor indisponível).");
  }, []);

  useEffect(() => {
    if (!state.stopping || state.result) return;
    const timeout = window.setTimeout(() => {
      if (!runState.stopping || runState.result) return;
      if (!runState.batchLabel) clearBatchStop();
      const forced: LiveRunState = {
        ...runState,
        stopping: false,
        result: "cancelled",
        phase: "Cancelado",
        error: RUN_CANCELLED_MESSAGE,
        lines: appendLiveLines(
          runState.lines,
          "[qa-desk] Parada forçada no painel (servidor não respondeu a tempo).",
        ),
      };
      publishRunState(forced);
      signalRunComplete(forced);
      activeAbort?.abort();
    }, 15_000);
    return () => window.clearTimeout(timeout);
  }, [state.stopping, state.result]);

  useEffect(() => {
    const running = state.active && !state.result && !state.stopping;
    if (!running) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable='true']")) return;
      e.preventDefault();
      void stopRun();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state.active, state.result, state.stopping, stopRun]);

  const value = useMemo(
    () => ({
      state,
      running: state.active && !state.result && !state.error,
      runAutomation,
      stopRun,
      dismiss: () => publishRunState(idle),
    }),
    [state, runAutomation, stopRun],
  );

  return (
    <RunProgressContext.Provider value={value}>
      {children}
      <PanelErrorBoundary>
        <RunProgressPanel />
      </PanelErrorBoundary>
    </RunProgressContext.Provider>
  );
}

export function useRunProgress() {
  const ctx = useContext(RunProgressContext);
  if (!ctx) throw new Error("useRunProgress fora do provider");
  return ctx;
}

class PanelErrorBoundary extends Component<
  { children: ReactNode },
  { crashed: boolean }
> {
  state = { crashed: false };

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[RunProgressPanel]", error);
  }

  render() {
    if (this.state.crashed) {
      return (
        <div className="fixed bottom-4 right-4 z-50 max-w-xs rounded-lg border border-amber-500/40 bg-card/95 px-3 py-2 text-xs shadow-lg">
          Painel ao vivo indisponível. O teste continua — veja o resultado no toast, na aba
          Histórico ou na notificação do sistema.
        </div>
      );
    }
    return this.props.children;
  }
}

function RunProgressPanel() {
  const { state, dismiss, stopRun } = useRunProgress();
  const [now, setNow] = useState(Date.now());
  const [logCopied, setLogCopied] = useState(false);
  const [prefs, setPrefs] = useState<PanelPrefs>(() => loadPanelPrefs() ?? defaultPanelPrefs());
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    if (!state.active || state.result) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [state.active, state.result]);

  useEffect(() => {
    if (!state.active) return;
    setPrefs((p) => {
      const next = { ...p, logOpen: true, minimized: false };
      savePanelPrefs(next);
      return next;
    });
  }, [state.active, state.startedAt, state.result]);

  const updatePrefs = useCallback((patch: Partial<PanelPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      savePanelPrefs(next);
      return next;
    });
  }, []);

  const onDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const panel = panelRef.current;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    dragRef.current = {
      pointerId: e.pointerId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
    setDragPos({ x: rect.left, y: rect.top });

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const w = panelRef.current?.offsetWidth ?? 320;
    const h = panelRef.current?.offsetHeight ?? 80;
    const x = Math.min(Math.max(8, e.clientX - drag.offsetX), window.innerWidth - w - 8);
    const y = Math.min(Math.max(8, e.clientY - drag.offsetY), window.innerHeight - h - 8);
    setDragPos({ x, y });
  };

  const onDragEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    dragRef.current = null;
    if (dragPos) updatePrefs({ x: dragPos.x, y: dragPos.y });
    setDragPos(null);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  if (!state.active) return null;

  const elapsed =
    state.startedAt != null ? formatElapsed(now - state.startedAt) : "—";
  const running = state.active && !state.result && !state.error;
  const canStop = running || state.stopping;
  const position = dragPos ?? prefs;

  const displayLines =
    prefs.logMode === "limpo"
      ? curateMaestroLogLines(state.lines)
      : state.lines.map((l) => l.trim()).filter(Boolean);
  /** Painel: últimas linhas da vista atual (scroll sobe para o restante). */
  const tailLines = displayLines.slice(-40);

  const outputIdleMs =
    state.lastLineAt != null ? now - state.lastLineAt : state.idleMs ?? 0;
  /** Aviso cedo; abort automático no servidor (idle; vídeo ~5 min). */
  const outputStale = running && outputIdleMs >= 15_000;
  const outputVeryStale = running && outputIdleMs >= 40_000;

  const statusIcon = state.stopping ? (
    <Loader2 className="size-4 animate-spin text-amber-400" />
  ) : running ? (
    <Loader2 className="size-4 animate-spin text-sky-400" />
  ) : state.result === "success" ? (
    <Check className="size-4 text-emerald-400" />
  ) : state.result === "cancelled" ? (
    <Square className="size-4 text-amber-400" />
  ) : (
    <X className="size-4 text-red-400" />
  );

  if (prefs.minimized) {
    return (
      <button
        type="button"
        onClick={() => updatePrefs({ minimized: false })}
        className={cn(
          "fixed z-50 flex items-center gap-2 rounded-full border bg-card/95 px-3 py-2 text-xs font-medium shadow-lg backdrop-blur-sm",
          state.result === "success" && "border-emerald-500/45",
          state.result === "failed" && "border-red-500/45",
          state.result === "cancelled" && "border-amber-500/45",
          running && "border-sky-500/45",
        )}
        style={{ left: position.x, top: position.y }}
        title="Expandir painel Maestro"
      >
        {statusIcon}
        <span className="max-w-40 truncate">
          {state.batchLabel ? `${state.batchLabel} · ` : ""}
          {state.title}
        </span>
        {state.action && (
          <span className="max-w-28 truncate text-muted-foreground">{state.action}</span>
        )}
        <span className="text-muted-foreground">{elapsed}</span>
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      className="fixed z-50 w-[min(100vw-1.5rem,22rem)]"
      style={{ left: position.x, top: position.y }}
    >
      <div
        className={cn(
          "overflow-hidden rounded-xl border bg-card/95 shadow-xl backdrop-blur-sm",
          state.result === "success" && "border-emerald-500/45",
          state.result === "failed" && "border-red-500/45",
          state.result === "cancelled" && "border-amber-500/45",
          running && "border-sky-500/45",
        )}
      >
        <div
          className="flex cursor-move items-start gap-2 px-2 py-2.5 select-none"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        >
          <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground/70" />
          <div className="mt-0.5 shrink-0">{statusIcon}</div>
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
            <p className="mt-0.5 truncate text-xs font-medium text-foreground/90">
              {state.phase ?? "Maestro"}
            </p>
            {state.flowFile && (
              <p className="mt-0.5 truncate font-mono text-[0.6rem] text-sky-300/90">
                {state.flowFile}
              </p>
            )}
            {state.action && (
              <p className="mt-0.5 truncate font-mono text-[0.65rem] text-muted-foreground">
                {state.action}
              </p>
            )}
            {outputStale && (
              <p
                className={cn(
                  "mt-1 text-[0.65rem]",
                  outputVeryStale ? "text-amber-300" : "text-amber-400/90",
                )}
              >
                Sem saída há {formatElapsed(outputIdleMs)}
                {outputVeryStale
                  ? " — abort automático em breve (falha do CT; lote só para se você clicar Parar)"
                  : ""}
              </p>
            )}
            {state.error && (
              <p
                className={cn(
                  "mt-1 wrap-break-word text-[0.7rem]",
                  state.result === "cancelled" ? "text-amber-300" : "text-red-300",
                )}
              >
                {state.error}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col gap-0.5">
            <button
              type="button"
              onClick={() => updatePrefs({ logOpen: !prefs.logOpen })}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title={prefs.logOpen ? "Ocultar log" : "Mostrar log"}
            >
              {prefs.logOpen ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronUp className="size-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => updatePrefs({ minimized: true })}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Minimizar"
            >
              <Minimize2 className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Fechar"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {prefs.logOpen && (
          <div className="border-t border-border/60 bg-muted/20 px-3 py-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[0.65rem] text-muted-foreground">
                {running ? "Ao vivo · Esc para parar" : state.result === "cancelled" ? "Interrompido" : state.result ? "Resultado" : "Log"}
                {` · ${displayLines.length} linhas`}
                {prefs.logMode === "limpo" && state.lines.length > displayLines.length
                  ? ` (de ${state.lines.length} brutas)`
                  : ""}
              </p>
              <div className="flex shrink-0 items-center gap-1">
                <div className="mr-1 inline-flex rounded-md border border-border/80 p-0.5 text-[0.6rem]">
                  <button
                    type="button"
                    onClick={() => updatePrefs({ logMode: "limpo" })}
                    className={cn(
                      "rounded px-1.5 py-0.5",
                      prefs.logMode === "limpo"
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    title="Fases, flows e falhas — sem Tap/Assert COMPLETED nem SKIPPED em série"
                  >
                    Limpo
                  </button>
                  <button
                    type="button"
                    onClick={() => updatePrefs({ logMode: "completo" })}
                    className={cn(
                      "rounded px-1.5 py-0.5",
                      prefs.logMode === "completo"
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    title="Stdout bruto do Maestro (tudo o que chegou ao painel)"
                  >
                    Completo
                  </button>
                </div>
                {state.lines.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const text =
                        prefs.logMode === "limpo"
                          ? displayLines.join("\n")
                          : state.lines.join("\n");
                      void navigator.clipboard.writeText(text).then(() => {
                        setLogCopied(true);
                        window.setTimeout(() => setLogCopied(false), 2000);
                      });
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-border/80 px-2 py-1 text-[0.65rem] text-muted-foreground hover:bg-muted hover:text-foreground"
                    title={
                      prefs.logMode === "limpo"
                        ? "Copiar log limpo"
                        : "Copiar log completo"
                    }
                  >
                    {logCopied ? (
                      <Check className="size-3 text-emerald-400" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                    {logCopied ? "Copiado" : "Copiar"}
                  </button>
                )}
                {canStop && (
                  <button
                    type="button"
                    onClick={() => void stopRun()}
                    disabled={state.stopping}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-[0.65rem] font-medium text-red-200 hover:bg-red-500/20 disabled:opacity-50"
                    title="Interrompe o Maestro — atalho: Esc (o CLI não suporta pausar)"
                  >
                    <Square className="size-3 fill-current" />
                    {state.stopping ? "Parando…" : "Parar teste"}
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-64 space-y-0.5 overflow-y-auto font-mono text-[0.6rem] leading-snug text-muted-foreground">
              {tailLines.length > 0 ? (
                tailLines.map((line, i) => (
                  <p
                    key={`${i}-${line.slice(0, 24)}`}
                    className={cn(
                      "wrap-break-word",
                      /cancelad|solicitando parada|parada forçada/i.test(line) &&
                        "text-amber-300",
                      /^✗|FAILED|Element not found|Assertion/i.test(line) &&
                        "text-red-300",
                      /^✓|^\[qa-desk\]/i.test(line) && "text-foreground/90",
                      /^▶/i.test(line) && "text-sky-300/90",
                    )}
                  >
                    {line}
                  </p>
                ))
              ) : (
                <p>{running ? "Aguardando saída do Maestro…" : "—"}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
