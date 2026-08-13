import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bug, ExternalLink, Plus } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { PremiumTooltip, tableRowHoverClass } from "@/components/PremiumTooltip";
import { api } from "@/lib/api";
import { actionBtn, actionBtnBase } from "@/lib/button-styles";
import {
  projectBugDetailPath,
  projectBugsListPath,
  projectNewBugPath,
} from "@/lib/project-paths";
import { cn } from "@/lib/utils";
import { QA_GESTOR_REPLY_EVENT } from "@/lib/gestor-replies-stream";
import { CHANNEL_LABELS, getProjectChannels, type ProductChannel } from "@/config/channels";
import type { BugStatus, ProjectSlug, TestRecord } from "@/types/test-record";
import {
  BUG_STATUS_LABELS,
  PRIORITY_LABELS,
  displayStatus,
  formatRecordId,
  inferChannel,
  isBugReport,
  isGestorReplyUnread,
} from "@/types/test-record";

export function BugListPage({
  project,
  channel: routeChannel,
}: {
  project: ProjectSlug;
  channel?: ProductChannel;
}) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [reports, setReports] = useState<TestRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<BugStatus | "todos">("todos");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .listTests(project)
      .then((catalog) => setReports(catalog.reports))
      .finally(() => setLoading(false));
  }, [project]);

  useEffect(() => {
    function reload() {
      void api.listTests(project).then((catalog) => setReports(catalog.reports));
    }
    function onReply() {
      reload();
    }
    window.addEventListener(QA_GESTOR_REPLY_EVENT, onReply);
    function onVisible() {
      if (document.visibilityState === "visible") reload();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(QA_GESTOR_REPLY_EVENT, onReply);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [project]);

  const filtered = useMemo(() => {
    let list = reports.filter(isBugReport);
    if (routeChannel) {
      list = list.filter((r) => inferChannel(r) === routeChannel);
    }
    if (statusFilter !== "todos") {
      list = list.filter((r) => r.status === statusFilter);
    }
    return list;
  }, [reports, routeChannel, statusFilter]);

  const hasChannels = getProjectChannels(project).length > 0;

  function openDetail(id: string, record: TestRecord) {
    const ch = inferChannel(record) ?? routeChannel;
    navigate(projectBugDetailPath(project, id, ch));
  }

  return (
    <div className="space-y-4">
      <div className="surface-brand rounded-xl border p-4">
        <div className="flex items-start gap-3">
          <Bug className="mt-0.5 size-5 shrink-0 opacity-90" />
          <div>
            <p className="font-medium">Bugs reportados</p>
            <p className="mt-1 text-sm opacity-90">
              Defeitos encontrados durante testes ou exploração manual. Não entram no escopo de
              homologação — podem ser abertos a partir de um caso de teste que falhou.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-muted-foreground">Status</label>
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
          <span className="text-xs text-muted-foreground">
            {filtered.length} bug(s)
            {routeChannel && hasChannels ? ` · ${CHANNEL_LABELS[routeChannel]}` : ""}
          </span>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => navigate(projectNewBugPath(project, routeChannel))}
            className={cn(actionBtnBase, actionBtn.create)}
          >
            <Plus className="size-4" />
            Novo bug
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Título</th>
              <th className="w-[1%] whitespace-nowrap px-4 py-3 font-medium">Status</th>
              <th className="w-[1%] whitespace-nowrap px-4 py-3 font-medium">Prioridade</th>
              <th className="w-[1%] whitespace-nowrap px-4 py-3 font-medium">Reportado</th>
              <th className="w-[1%] whitespace-nowrap px-4 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  <span className="animate-fade-in-up-soft inline-block opacity-0">
                    Nenhum bug neste canal.
                  </span>
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const { label, tone } = displayStatus(r);
                return (
                  <tr
                    key={r.id}
                    className={cn(
                      "cursor-pointer select-none border-b last:border-0",
                      tableRowHoverClass,
                    )}
                    onClick={() => openDetail(r.id, r)}
                  >
                    <td className="min-w-0 px-4 py-3">
                      <p className="font-medium leading-snug">{r.title}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {formatRecordId(r.id, r)}
                      </p>
                      {r.module && (
                        <p className="text-xs text-muted-foreground">{r.module}</p>
                      )}
                      {isGestorReplyUnread(r) && (
                        <p className="mt-1 text-[0.65rem] font-medium text-amber-300">
                          Não lido
                          {r.githubIssueLastCommentBy
                            ? ` · @${r.githubIssueLastCommentBy}`
                            : ""}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-middle">
                      <span
                        className={cn(
                          "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5",
                          tone === "ok" && "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
                          tone === "warn" && "border-amber-500/40 bg-amber-500/15 text-amber-300",
                          tone === "neutral" && "border-border bg-muted text-muted-foreground",
                        )}
                      >
                        {label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-middle text-muted-foreground">
                      {r.priority ? PRIORITY_LABELS[r.priority] : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-middle text-xs tabular-nums text-muted-foreground">
                      {r.reportedAt
                        ? new Date(r.reportedAt).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
                      <PremiumTooltip label="Abrir" align="end">
                        <button
                          type="button"
                          aria-label="Abrir"
                          onClick={() => openDetail(r.id, r)}
                          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <ExternalLink className="size-4" />
                        </button>
                      </PremiumTooltip>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {routeChannel && (
        <p className="text-xs text-muted-foreground">
          Lista: {projectBugsListPath(project, routeChannel)}
        </p>
      )}
    </div>
  );
}
