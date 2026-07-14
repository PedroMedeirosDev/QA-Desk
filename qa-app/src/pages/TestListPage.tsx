import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, ListChecks, Play, Plus } from "lucide-react";
import { ExecutionModeBadge } from "@/components/ExecutionModeBadge";
import { AutomationReadinessBadge } from "@/components/AutomationReadinessBadge";
import { api } from "@/lib/api";
import { toastErrorMessage, useToast } from "@/lib/toast";
import { useRunProgress } from "@/lib/run-progress";
import { actionBtn, actionBtnBase } from "@/lib/button-styles";
import { countTestRuns } from "@/lib/history";
import {
  projectDetailPath,
  projectHomologationsListPath,
  projectNewPath,
} from "@/lib/project-paths";
import { cn } from "@/lib/utils";
import { CHANNEL_LABELS, getProjectChannels, type ProductChannel } from "@/config/channels";
import type { BugStatus, ProjectSlug, TestRecord } from "@/types/test-record";
import {
  BUG_STATUS_LABELS,
  displayStatus,
  formatTestId,
  inferChannel,
  isTestCase,
} from "@/types/test-record";
import type { HomologationWithProgress } from "@/types/homologation";

const EMPTY_CHANNEL_HINT: Record<ProductChannel, string> = {
  app: "Use o checklist Mural ou crie testes manualmente.",
  web: "Homologação WEB em preparação — testes aparecerão aqui.",
  portal: "Homologação PORTAL em preparação — testes aparecerão aqui.",
};

export function TestListPage({
  project,
  channel: routeChannel,
}: {
  project: ProjectSlug;
  channel?: ProductChannel;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const { runAutomation, running: liveRunning } = useRunProgress();
  const [reports, setReports] = useState<TestRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<BugStatus | "todos">("todos");
  const [campaignOnly, setCampaignOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [homologations, setHomologations] = useState<HomologationWithProgress[]>([]);

  const hasChannels = getProjectChannels(project).length > 0;

  function reload(opts?: { soft?: boolean }) {
    if (!opts?.soft) setLoading(true);
    Promise.all([api.listTests(project), api.listHomologations(project).catch(() => null)])
      .then(([catalog, homRes]) => {
        setReports(catalog.reports);
        setHomologations(homRes?.homologations ?? []);
      })
      .finally(() => setLoading(false));
  }

  const channelHomologations = useMemo(() => {
    let list = homologations;
    if (routeChannel) {
      list = list.filter((h) => !h.channel || h.channel === routeChannel);
    }
    return list;
  }, [homologations, routeChannel]);

  const activeHomologations = channelHomologations.filter((h) => h.status !== "concluida");

  useEffect(() => {
    reload();
  }, [project]);

  const filtered = useMemo(() => {
    let list = reports;
    if (routeChannel) {
      list = list.filter((r) => inferChannel(r) === routeChannel);
    }
    if (campaignOnly) {
      const slugs = new Set(channelHomologations.map((h) => h.slug));
      list = list.filter((r) => r.campaign && slugs.has(r.campaign));
    }
    if (statusFilter !== "todos") {
      list = list.filter((r) => !isTestCase(r) && r.status === statusFilter);
    }
    return list;
  }, [reports, routeChannel, statusFilter, campaignOnly, channelHomologations]);

  const homologationCount = channelHomologations.length;

  function openDetail(id: string) {
    const report = reports.find((r) => r.id === id);
    const ch = inferChannel(report ?? { project, platform: "web" }) ?? routeChannel;
    navigate(projectDetailPath(project, id, ch));
  }

  async function quickRun(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    const report = reports.find((r) => r.id === id);
    setRunningId(id);
    try {
      const res = await runAutomation({
        project,
        testId: id,
        title: report?.title ?? formatTestId(id),
      });
      const ver = res.appVersion ? ` · v${res.appVersion}` : "";
      if (res.ok) {
        toast.success(`Execução #${res.runNumber} passou${ver}`);
      } else {
        const where =
          res.failure?.failedStepLabel ??
          res.failure?.failedAction ??
          "veja histórico";
        toast.error(`Execução #${res.runNumber} falhou${ver} — ${where}`, {
          title: "Maestro",
        });
      }
      reload({ soft: true });
    } catch (err) {
      toast.error(toastErrorMessage(err, "Erro ao executar"));
    } finally {
      setRunningId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="surface-brand rounded-xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">Homologações</p>
            <p className="mt-1 text-sm opacity-90">
              {activeHomologations.length > 0
                ? `${activeHomologations.length} campanha(s) em andamento neste canal.`
                : "Nenhuma campanha ativa — crie ou abra a lista."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(projectHomologationsListPath(project))}
            className={cn(actionBtnBase, actionBtn.onBrand, "px-3")}
          >
            <ListChecks className="size-4" />
            Ver todas as homologações
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-muted-foreground">Status (bugs)</label>
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as BugStatus | "todos")}
          >
            <option value="todos">Todos</option>
            {Object.entries(BUG_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          {homologationCount > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={campaignOnly}
                onChange={(e) => setCampaignOnly(e.target.checked)}
              />
              Só homologações
            </label>
          )}
          <span className="text-xs text-muted-foreground">
            {filtered.length} teste(s)
            {routeChannel && hasChannels ? ` · ${CHANNEL_LABELS[routeChannel]}` : ""}
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate(projectNewPath(project, routeChannel))}
          className={cn(actionBtnBase, actionBtn.create)}
        >
          <Plus className="size-4" />
          Novo teste
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Título</th>
              <th className="px-4 py-3 font-medium">Modo</th>
              <th className="px-4 py-3 font-medium">Resultado</th>
              <th className="px-4 py-3 font-medium">Rodadas</th>
              <th className="px-4 py-3 font-medium">Última</th>
              <th className="px-4 py-3 font-medium w-28">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center">
                  <p className="text-muted-foreground">Nenhum teste neste canal.</p>
                  {routeChannel && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {EMPTY_CHANNEL_HINT[routeChannel]}
                    </p>
                  )}
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const { label, tone } = displayStatus(r);
                return (
                  <tr
                    key={r.id}
                    className="cursor-pointer border-b last:border-0 hover:bg-muted/40 select-none"
                    onClick={() => openDetail(r.id)}
                    title="Clique para abrir"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.title}</p>
                      <p className="font-mono text-xs text-muted-foreground">{formatTestId(r.id)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <ExecutionModeBadge record={r} />
                        <AutomationReadinessBadge record={r} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-xs",
                          tone === "ok" && "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
                          tone === "fail" && "border-red-500/40 bg-red-500/15 text-red-400",
                          tone === "warn" && "border-amber-500/40 bg-amber-500/15 text-amber-300",
                          tone === "neutral" && "border-border bg-muted text-muted-foreground",
                        )}
                      >
                        {label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">
                      {countTestRuns(r.history)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {r.automation?.lastRunAt
                        ? new Date(r.automation.lastRunAt).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title="Abrir"
                          onClick={() => openDetail(r.id)}
                          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <ExternalLink className="size-4" />
                        </button>
                        {r.automation?.flowPath && (
                          <button
                            type="button"
                            title="Executar Maestro"
                            disabled={runningId === r.id || liveRunning}
                            onClick={(e) => void quickRun(e, r.id)}
                            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-emerald-500/15 hover:text-emerald-500 disabled:opacity-50"
                          >
                            <Play className="size-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
