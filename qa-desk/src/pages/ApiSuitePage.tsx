import { useCallback, useEffect, useState } from "react";
import { FlaskConical, Loader2, Play, Terminal } from "lucide-react";
import { getProject } from "@/config/projects";
import { api, type ApiSuiteRunResult, type ApiSuiteStatus } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ProjectSlug } from "@/types/test-record";

function formatWhen(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

function suiteHint(project: ProjectSlug): string {
  if (project === "polygonus") {
    return "Roda a collection, resume o relatório e guarda o log fiel do Newman. Auth gestão CQ (SUPPETER).";
  }
  if (project === "desk") {
    return "Dogfood do próprio Desk: sobe a API mock (porta 3011), roda Newman e guarda o log fiel.";
  }
  return "Roda a collection, resume o relatório e guarda o log fiel do Newman.";
}

export function ApiSuitePage({ project }: { project: ProjectSlug }) {
  const projectLabel = getProject(project)?.label ?? project;
  const [suites, setSuites] = useState<ApiSuiteStatus[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiSuiteRunResult | null>(null);
  const [showRaw, setShowRaw] = useState(false);

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
            : (res.suites.find((s) => s.id === project) ?? res.suites[0])?.id ??
              null;
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
    void load(null);
  }, [load]);

  const selected = suites.find((s) => s.id === selectedId) ?? null;

  async function runSelected() {
    if (!selectedId) return;
    setRunning(true);
    setError(null);
    setShowRaw(false);
    try {
      const res = await api.runApiSuite(project, selectedId);
      setResult(res);
      await load(selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao rodar suite");
    } finally {
      setRunning(false);
    }
  }

  function selectSuite(s: ApiSuiteStatus) {
    setSelectedId(s.id);
    setResult(s.lastRun ?? null);
    setShowRaw(false);
    setError(null);
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
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

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando suites…</p>
      ) : suites.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhuma collection neste projeto ainda.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
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
                  <p className="mt-2 text-xs text-muted-foreground">{s.description}</p>
                )}
                {s.reason && !s.ready && (
                  <p className="mt-2 text-xs text-amber-300/90">{s.reason}</p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {result && result.suiteId === selectedId && (
        <section className="space-y-4 rounded-xl border border-border bg-card/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">
              Resultado — {result.label}{" "}
              <span
                className={cn(
                  "ml-2 rounded-md border px-2 py-0.5 text-xs",
                  result.ok
                    ? "border-emerald-500/35 text-emerald-400"
                    : "border-red-500/35 text-red-400",
                )}
              >
                {result.ok ? "OK" : "FALHOU"}
              </span>
            </h3>
            <span className="text-xs text-muted-foreground">
              {formatWhen(result.ranAt)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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

          {result.failures.length > 0 && (
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

          <div>
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <Terminal className="size-3.5" />
              {showRaw ? "Ocultar log Newman" : "Ver log Newman (fiel)"}
            </button>
            {showRaw && (
              <pre className="mt-2 max-h-96 overflow-auto rounded-lg border border-border bg-zinc-950 p-3 text-[11px] leading-relaxed text-zinc-300">
                {result.rawCli || "(vazio)"}
              </pre>
            )}
          </div>
        </section>
      )}
    </div>
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
