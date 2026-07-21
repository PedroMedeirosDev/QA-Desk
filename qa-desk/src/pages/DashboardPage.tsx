import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Download,
  ExternalLink,
  LayoutDashboard,
  ListChecks,
} from "lucide-react";
import { api } from "@/lib/api";
import { computeDashboardMetrics } from "@/lib/dashboard-metrics";
import {
  buildHomologationHtmlReport,
  downloadHtmlReport,
} from "@/lib/html-report";
import { toastErrorMessage, useToast } from "@/lib/toast";
import { actionBtn, actionBtnBase } from "@/lib/button-styles";
import {
  projectDetailPath,
  projectHomologationPath,
  projectHomologationsListPath,
  projectListPath,
} from "@/lib/project-paths";
import { cn } from "@/lib/utils";
import { getProject } from "@/config/projects";
import type { ProjectSlug, TestRecord } from "@/types/test-record";
import type { HomologationWithProgress } from "@/types/homologation";

function MetricCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "ok" | "fail" | "neutral";
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "ok" && "text-emerald-400",
          tone === "fail" && "text-red-400",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function DashboardPage({ project }: { project: ProjectSlug }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [reports, setReports] = useState<TestRecord[]>([]);
  const [homologations, setHomologations] = useState<HomologationWithProgress[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const projectMeta = getProject(project);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.listTests(project),
      api.listHomologations(project).catch(() => null),
    ])
      .then(([catalog, homRes]) => {
        if (cancelled) return;
        setReports(catalog.reports);
        setHomologations(homRes?.homologations ?? []);
      })
      .catch((e) => {
        if (!cancelled) {
          toast.error(toastErrorMessage(e, "Erro ao carregar dashboard"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [project, toast]);

  const metrics = useMemo(
    () => computeDashboardMetrics(reports, homologations),
    [reports, homologations],
  );

  function exportHtml() {
    const html = buildHomologationHtmlReport(metrics, {
      projectLabel: projectMeta?.label ?? project,
      author: "Pedro Medeiros (QA)",
    });
    const day = new Date().toISOString().slice(0, 10);
    downloadHtmlReport(html, `relatorio-qa-${project}-${day}.html`);
    toast.success("Relatório HTML baixado");
  }

  if (loading) {
    return <p className="text-muted-foreground">Carregando dashboard…</p>;
  }

  const hom = metrics.primaryHomologation;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <LayoutDashboard className="size-4 text-primary" />
            Dashboard QA
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Visão agregada do catálogo e da campanha ativa — base para o relatório.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportHtml}
            className={cn(actionBtnBase, actionBtn.create)}
          >
            <Download className="size-4" />
            Exportar HTML
          </button>
          <button
            type="button"
            onClick={() => navigate(projectHomologationsListPath(project))}
            className={cn(actionBtnBase, actionBtn.back)}
          >
            <ListChecks className="size-4" />
            Homologações
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Taxa de sucesso"
          value={`${metrics.passRatePct}%`}
          hint={`${metrics.passed} passou · ${metrics.failed} falhou · ${metrics.pending} pendente`}
          tone={
            metrics.failed > 0 ? "fail" : metrics.passRatePct === 100 ? "ok" : "neutral"
          }
        />
        <MetricCard
          label="CTs no catálogo"
          value={metrics.testsTotal}
          hint={`${metrics.automated} com Maestro`}
        />
        <MetricCard
          label="Flows estáveis"
          value={`${metrics.readyFlows}/${metrics.automated || 0}`}
          hint={
            metrics.draftFlows > 0
              ? `${metrics.draftFlows} rascunho${metrics.draftFlows === 1 ? "" : "s"}`
              : "todos estáveis ou sem flow"
          }
        />
        <MetricCard
          label="Bugs abertos"
          value={metrics.bugsOpen}
          hint={`${metrics.bugsTotal} no total`}
          tone={metrics.bugsOpen > 0 ? "fail" : "ok"}
        />
      </div>

      {hom && (
        <div className="surface-brand rounded-xl border p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider opacity-80">
                Campanha em foco
              </p>
              <p className="mt-1 text-lg font-semibold">{hom.title}</p>
              <p className="mt-1 text-sm opacity-90">
                {hom.passed}/{hom.total} passou · {hom.passRatePct}%
                {hom.build ? ` · build ${hom.build}` : ""}
                {" · "}
                {hom.status.replace("_", " ")}
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/20">
                <div
                  className="h-full rounded-full bg-emerald-400"
                  style={{ width: `${hom.passRatePct}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate(projectHomologationPath(project, hom.slug))}
              className={cn(actionBtnBase, actionBtn.onBrand, "px-3")}
            >
              Abrir campanha
              <ExternalLink className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b bg-muted/40 px-4 py-3">
          <p className="text-sm font-medium">Módulos</p>
          <p className="text-xs text-muted-foreground">
            Nível produto (Mural hoje · Atendimento depois)
          </p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Módulo</th>
              <th className="px-4 py-2.5 font-medium">Suites</th>
              <th className="px-4 py-2.5 font-medium">%</th>
              <th className="px-4 py-2.5 font-medium">Passou</th>
              <th className="px-4 py-2.5 font-medium">Falhou</th>
              <th className="px-4 py-2.5 font-medium">Pendente</th>
            </tr>
          </thead>
          <tbody>
            {metrics.modules.map((m) => (
              <tr key={m.module} className="border-b last:border-0">
                <td className="px-4 py-2.5 font-medium">{m.label}</td>
                <td className="px-4 py-2.5 tabular-nums">{m.suiteCount}</td>
                <td className="px-4 py-2.5 tabular-nums">{m.stats.passRatePct}%</td>
                <td className="px-4 py-2.5 tabular-nums text-emerald-400">
                  {m.stats.passed}
                </td>
                <td className="px-4 py-2.5 tabular-nums text-red-400">
                  {m.stats.failed}
                </td>
                <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                  {m.stats.pending}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b bg-muted/40 px-4 py-3">
          <p className="text-sm font-medium">Suites</p>
          <p className="text-xs text-muted-foreground">
            Dentro de cada módulo — mesmos números da lista de testes
          </p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Módulo</th>
              <th className="px-4 py-2.5 font-medium">Suite</th>
              <th className="px-4 py-2.5 font-medium">%</th>
              <th className="px-4 py-2.5 font-medium">Passou</th>
              <th className="px-4 py-2.5 font-medium">Falhou</th>
              <th className="px-4 py-2.5 font-medium">Pendente</th>
              <th className="px-4 py-2.5 font-medium">Rodadas</th>
              <th className="px-4 py-2.5 font-medium">Flows</th>
            </tr>
          </thead>
          <tbody>
            {metrics.suites.map((s) => (
              <tr key={`${s.module}-${s.suite}`} className="border-b last:border-0">
                <td className="px-4 py-2.5 text-muted-foreground">{s.moduleLabel}</td>
                <td className="px-4 py-2.5 font-medium">{s.label}</td>
                <td className="px-4 py-2.5 tabular-nums">{s.stats.passRatePct}%</td>
                <td className="px-4 py-2.5 tabular-nums text-emerald-400">
                  {s.stats.passed}
                </td>
                <td className="px-4 py-2.5 tabular-nums text-red-400">
                  {s.stats.failed}
                </td>
                <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                  {s.stats.pending}
                </td>
                <td className="px-4 py-2.5 tabular-nums">{s.stats.totalRuns}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {s.stats.readyCount} estáveis
                  {s.stats.draftCount > 0
                    ? ` · ${s.stats.draftCount} rascunhos`
                    : ""}
                </td>
              </tr>
            ))}
            {metrics.suites.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum teste com suite —{" "}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => navigate(projectListPath(project, "app"))}
                  >
                    ir para Testes
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {metrics.failures.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm font-medium text-red-400">Falhas abertas</p>
          <ul className="mt-3 space-y-2">
            {metrics.failures.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{f.title}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {f.module} · {f.suite} · {f.testKey ?? f.id}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(projectDetailPath(project, f.id, "app"))}
                  className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Abrir"
                >
                  <ExternalLink className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {metrics.totalRuns} rodadas registradas no histórico
        {metrics.lastRunAt
          ? ` · última em ${new Date(metrics.lastRunAt).toLocaleString("pt-BR")}`
          : ""}
        {" · "}
        {metrics.activeHomologations} campanha(s) em andamento
      </p>
    </div>
  );
}
