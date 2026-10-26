import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bug, Plus } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { BugCard } from "@/components/BugCard";
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
  BUG_STATUS_ORDER,
  PRIORITY_LABELS,
  SEVERITY_LABELS,
  formatRecordId,
  inferChannel,
  isBugReport,
  isTestCase,
} from "@/types/test-record";

type Nivel = NonNullable<TestRecord["severity"]>;
const NIVEIS = Object.keys(SEVERITY_LABELS) as Nivel[];

const FILTRO = "h-9 rounded-md border bg-background px-3 text-sm";

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
  const [severidadeFilter, setSeveridadeFilter] = useState<Nivel | "todas">("todas");
  const [prioridadeFilter, setPrioridadeFilter] = useState<Nivel | "todas">("todas");
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
    window.addEventListener(QA_GESTOR_REPLY_EVENT, reload);
    return () => {
      window.removeEventListener(QA_GESTOR_REPLY_EVENT, reload);
    };
  }, [project]);

  const testTitles = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of reports) {
      if (isTestCase(r)) map.set(r.id, formatRecordId(r.id, r));
    }
    return map;
  }, [reports]);

  const filtered = useMemo(() => {
    let list = reports.filter(isBugReport);
    if (routeChannel) list = list.filter((r) => inferChannel(r) === routeChannel);
    if (statusFilter !== "todos") list = list.filter((r) => r.status === statusFilter);
    if (severidadeFilter !== "todas") list = list.filter((r) => r.severity === severidadeFilter);
    if (prioridadeFilter !== "todas") {
      list = list.filter((r) => (r.priority ?? r.severity) === prioridadeFilter);
    }
    return list;
  }, [reports, routeChannel, statusFilter, severidadeFilter, prioridadeFilter]);

  const hasChannels = getProjectChannels(project).length > 0;

  function openDetail(record: TestRecord) {
    const ch = inferChannel(record) ?? routeChannel;
    navigate(projectBugDetailPath(project, record.id, ch));
  }

  return (
    <div className="space-y-4">
      <div className="surface-brand rounded-xl border p-4">
        <div className="flex items-start gap-3">
          <Bug className="mt-0.5 size-5 shrink-0 opacity-90" />
          <div>
            <p className="font-medium">Bugs reportados</p>
            <p className="mt-1 text-sm opacity-90">
              Defeitos encontrados em testes ou exploração manual. Clique num bug para ver o
              relatório completo; cada um mostra o teste e a execução em que apareceu.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Status
            <select
              className={FILTRO}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as BugStatus | "todos")}
            >
              <option value="todos">Todos</option>
              {BUG_STATUS_ORDER.map((k) => (
                <option key={k} value={k}>
                  {BUG_STATUS_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Severidade
            <select
              className={FILTRO}
              value={severidadeFilter}
              onChange={(e) => setSeveridadeFilter(e.target.value as Nivel | "todas")}
            >
              <option value="todas">Todas</option>
              {NIVEIS.map((k) => (
                <option key={k} value={k}>
                  {SEVERITY_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Prioridade
            <select
              className={FILTRO}
              value={prioridadeFilter}
              onChange={(e) => setPrioridadeFilter(e.target.value as Nivel | "todas")}
            >
              <option value="todas">Todas</option>
              {NIVEIS.map((k) => (
                <option key={k} value={k}>
                  {PRIORITY_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
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

      <ul className="space-y-2">
        {loading ? (
          <li className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Carregando…
          </li>
        ) : filtered.length === 0 ? (
          <li className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            {isAdmin
              ? "Nenhum bug com esses filtros."
              : "Nenhum bug publicado neste canal. O visitante só vê o que estiver marcado no portfólio."}
          </li>
        ) : (
          filtered.map((r) => (
            <BugCard
              key={r.id}
              project={project}
              bug={r}
              testTitles={testTitles}
              onOpen={() => openDetail(r)}
            />
          ))
        )}
      </ul>

      {routeChannel && (
        <p className="text-xs text-muted-foreground">
          Lista: {projectBugsListPath(project, routeChannel)}
        </p>
      )}
    </div>
  );
}
