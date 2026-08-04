import { useCallback, useEffect, useRef, useState } from "react";
import { FlaskConical, Loader2, PanelRightOpen, Play } from "lucide-react";
import { ApiSuiteResultDrawer } from "@/components/ApiSuiteResultDrawer";
import { getProject } from "@/config/projects";
import { api, type ApiSuiteRunResult, type ApiSuiteStatus } from "@/lib/api";
import { toastErrorMessage, useToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { ProjectSlug } from "@/types/test-record";

const LIVE_PROGRESS = [
  "newman",
  "→ boot collection",
  "→ Auth — corporação / hostname",
  "→ Auth — POST /auth/token",
  "→ Auth — entidades / perfis",
  "→ Auth — POST /auth/entidade",
  "→ requests da collection…",
  "→ assertions…",
];

function suiteHint(project: ProjectSlug): string {
  if (project === "polygonus") {
    return "Doze domínios de API (cards). Só Auth está pronta por enquanto; o resto é scaffold de layout.";
  }
  if (project === "desk") {
    return "Testa o próprio Desk: sobe a API mock (porta 3011), roda Newman e guarda o log fiel.";
  }
  return "Roda a collection, resume o relatório e guarda o log fiel do Newman.";
}

export function ApiSuitePage({ project }: { project: ProjectSlug }) {
  const projectLabel = getProject(project)?.label ?? project;
  const toast = useToast();
  const [suites, setSuites] = useState<ApiSuiteStatus[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiSuiteRunResult | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [liveLines, setLiveLines] = useState<string[]>([]);
  const liveTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopLiveLog = useCallback(() => {
    if (liveTimer.current) {
      clearInterval(liveTimer.current);
      liveTimer.current = null;
    }
  }, []);

  const startLiveLog = useCallback(
    (label: string) => {
      stopLiveLog();
      let i = 0;
      setLiveLines([`# ${label}`, `$ newman run …`]);
      liveTimer.current = setInterval(() => {
        if (i >= LIVE_PROGRESS.length) {
          setLiveLines((prev) =>
            prev[prev.length - 1]?.includes("aguardando")
              ? prev
              : [...prev, "… aguardando fim do Newman"],
          );
          return;
        }
        const line = LIVE_PROGRESS[i++];
        setLiveLines((prev) => [...prev, line]);
      }, 700);
    },
    [stopLiveLog],
  );

  useEffect(() => () => stopLiveLog(), [stopLiveLog]);

  const load = useCallback(
    async (preferId?: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.listApiSuites(project);
        setSuites(res.suites);
        const next =
          preferId && res.suites.some((s) => s.id === preferId)
            ? preferId
            : (res.suites.find((s) => s.ready) ?? res.suites[0])?.id ?? null;
        setSelectedId(next);
        setResult(res.suites.find((s) => s.id === next)?.lastRun ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao listar suites");
        setSuites([]);
        setSelectedId(null);
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    [project],
  );

  useEffect(() => {
    setShowRaw(false);
    setError(null);
    setSelectedId(null);
    setResult(null);
    setDrawerOpen(false);
    setLiveLines([]);
    void load(null);
  }, [load]);

  const selected = suites.find((s) => s.id === selectedId) ?? null;

  async function runSelected() {
    if (!selectedId || !selected) return;
    setRunning(true);
    setError(null);
    setShowRaw(false);
    setDrawerOpen(true);
    setResult(null);
    startLiveLog(selected.label);
    try {
      const res = await api.runApiSuite(project, selectedId);
      stopLiveLog();
      setLiveLines((prev) => [
        ...prev,
        "",
        res.ok
          ? `✔ finalizado — ${res.summary.requests} req / ${res.summary.assertions} asserts`
          : `✖ falhou — ${res.summary.failed} falha(s), exit ${res.exitCode}`,
      ]);
      setResult(res);
      await load(selectedId);

      const openDetails = () => {
        setSelectedId(selectedId);
        setDrawerOpen(true);
      };
      if (res.ok) {
        toast.success(`Collection ${selected.label} finalizada com sucesso!`, {
          title: "Suite API",
          action: { label: "Ver detalhes", onClick: openDetails },
        });
      } else {
        toast.error(`Collection ${selected.label} finalizou com falhas.`, {
          title: "Suite API",
          action: { label: "Ver detalhes", onClick: openDetails },
        });
      }
    } catch (e) {
      stopLiveLog();
      const message = toastErrorMessage(e, "Falha ao rodar suite");
      setError(message);
      setLiveLines((prev) => [...prev, "", `✖ erro: ${message}`]);
      toast.error(message, { title: "Suite API" });
    } finally {
      setRunning(false);
    }
  }

  function selectSuite(s: ApiSuiteStatus) {
    setSelectedId(s.id);
    setResult(s.lastRun ?? null);
    setShowRaw(false);
    setError(null);
    setLiveLines([]);
    if (s.lastRun) setDrawerOpen(true);
  }

  return (
    <div className="flex h-[calc(100dvh-11rem)] min-h-[28rem] flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <FlaskConical className="size-4" />
            Suite API (Newman / Postman)
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">
            Collections — {projectLabel}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {suiteHint(project)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!selectedId}
            onClick={() => setDrawerOpen(true)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
              selectedId
                ? "border-border bg-card/60 text-foreground hover:bg-muted"
                : "cursor-not-allowed border-border bg-muted text-muted-foreground",
            )}
            title="Abrir painel de resultado"
          >
            <PanelRightOpen className="size-4" />
            Resultado
          </button>
          <button
            type="button"
            disabled={!selected?.ready || running || loading}
            onClick={() => void runSelected()}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
              selected?.ready && !running
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                : "cursor-not-allowed border-border bg-muted text-muted-foreground",
            )}
          >
            {running ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            {running ? "Rodando…" : "Rodar suite"}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando suites…</p>
        ) : suites.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhuma collection neste projeto ainda.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {suites.map((s) => {
              const active = s.id === selectedId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => selectSuite(s)}
                  className={cn(
                    "rounded-xl border p-4 text-left transition-colors",
                    active
                      ? "border-primary/50 bg-primary/5"
                      : "border-border bg-card/40 hover:border-border/80",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{s.label}</span>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px]",
                        s.ready
                          ? "border-emerald-500/35 text-emerald-400"
                          : "border-amber-500/35 text-amber-300",
                      )}
                    >
                      {s.ready ? "pronta" : "pendente"}
                    </span>
                  </div>
                  {s.description && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {s.description}
                    </p>
                  )}
                  {s.reason && !s.ready && (
                    <p className="mt-2 text-xs text-amber-300/90">{s.reason}</p>
                  )}
                  {s.lastRun && (
                    <p
                      className={cn(
                        "mt-2 text-[11px]",
                        s.lastRun.ok ? "text-emerald-400/90" : "text-red-400/90",
                      )}
                    >
                      Última: {s.lastRun.ok ? "OK" : "falhou"} ·{" "}
                      {new Date(s.lastRun.ranAt).toLocaleString("pt-BR")}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <ApiSuiteResultDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        suiteLabel={selected?.label ?? result?.label ?? null}
        running={running}
        result={
          result && (!selectedId || result.suiteId === selectedId) ? result : null
        }
        liveLines={liveLines}
        showRaw={showRaw}
        onToggleRaw={() => setShowRaw((v) => !v)}
        error={error}
      />
    </div>
  );
}
