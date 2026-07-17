import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bug, ExternalLink, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { actionBtn, actionBtnBase } from "@/lib/button-styles";
import {
  projectBugDetailPath,
  projectBugsListPath,
  projectNewBugPath,
} from "@/lib/project-paths";
import { cn } from "@/lib/utils";
import { CHANNEL_LABELS, getProjectChannels, type ProductChannel } from "@/config/channels";
import type { BugStatus, ProjectSlug, TestRecord } from "@/types/test-record";
import {
  BUG_STATUS_LABELS,
  displayStatus,
  formatRecordId,
  inferChannel,
  isBugReport,
} from "@/types/test-record";

export function BugListPage({
  project,
  channel: routeChannel,
}: {
  project: ProjectSlug;
  channel?: ProductChannel;
}) {
  const navigate = useNavigate();
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
        <button
          type="button"
          onClick={() => navigate(projectNewBugPath(project, routeChannel))}
          className={cn(actionBtnBase, actionBtn.create)}
        >
          <Plus className="size-4" />
          Novo bug
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Título</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Prioridade</th>
              <th className="px-4 py-3 font-medium">Reportado</th>
              <th className="px-4 py-3 font-medium w-16">Ações</th>
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
                  Nenhum bug neste canal.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const { label, tone } = displayStatus(r);
                return (
                  <tr
                    key={r.id}
                    className="cursor-pointer border-b last:border-0 hover:bg-muted/40 select-none"
                    onClick={() => openDetail(r.id, r)}
                    title="Clique para abrir"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.title}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {formatRecordId(r.id, r)}
                      </p>
                      {r.module && (
                        <p className="text-xs text-muted-foreground">{r.module}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-xs",
                          tone === "ok" && "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
                          tone === "warn" && "border-amber-500/40 bg-amber-500/15 text-amber-300",
                          tone === "neutral" && "border-border bg-muted text-muted-foreground",
                        )}
                      >
                        {label}
                      </span>
                    </td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">
                      {r.priority ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {r.reportedAt
                        ? new Date(r.reportedAt).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        title="Abrir"
                        onClick={() => openDetail(r.id, r)}
                        className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <ExternalLink className="size-4" />
                      </button>
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
