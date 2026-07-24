import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Download,
  ExternalLink,
  LayoutDashboard,
  ListChecks,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { DailySummaryPanel } from "@/components/DailySummaryPanel";
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
  const { isAdmin, isVisitor } = useAuth();
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

  if (isVisitor) {
    return (
      <div className="space-y-6">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <LayoutDashboard className="size-4 text-primary" />
            Portfolio QA
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Atividade diária liberada — manual, automatizado e intenção do dia.
          </p>
        </div>
        <DailySummaryPanel project={project} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <LayoutDashboard className="size-4 text-primary" />
            Dashboard QA
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Dia · campanha · bugs e falhas — o inventário fica na lista de testes.
          </p>
        </div>
        {isAdmin && (
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
        )}
      </div>

      <DailySummaryPanel project={project} />

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

      <div className="grid gap-3 sm:grid-cols-2">
        <MetricCard
          label="Bugs abertos"
          value={metrics.bugsOpen}
          hint={`${metrics.bugsTotal} no total`}
          tone={metrics.bugsOpen > 0 ? "fail" : "ok"}
        />
        <MetricCard
          label="Flows estáveis"
          value={`${metrics.readyFlows}/${metrics.automated || 0}`}
          hint={
            metrics.draftFlows > 0
              ? `${metrics.draftFlows} rascunho${metrics.draftFlows === 1 ? "" : "s"}`
              : metrics.automated > 0
                ? "todos estáveis"
                : "nenhum flow vinculado"
          }
        />
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
    </div>
  );
}
