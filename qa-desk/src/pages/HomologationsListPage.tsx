import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Plus,
  RotateCcw,
} from "lucide-react";
import { api } from "@/lib/api";
import { useConfirm } from "@/lib/confirm";
import { toastErrorMessage, useToast } from "@/lib/toast";
import { actionBtn, actionBtnBase } from "@/lib/button-styles";
import {
  projectHomologationPath,
  projectListPath,
} from "@/lib/project-paths";
import { cn } from "@/lib/utils";
import {
  CHANNEL_LABELS,
  defaultChannel,
  getProjectChannels,
  type ProductChannel,
} from "@/config/channels";
import { MURAL_HOMOLOGATION_SLUG } from "@/config/homologations";
import type { ProjectSlug } from "@/types/test-record";
import {
  CHANGE_SCOPE_LABELS,
  HOMOLOGATION_CYCLE_LABELS,
  changeScopeBadgeClass,
  type HomologationChangeScope,
  type HomologationCycleStatus,
  type HomologationWithProgress,
} from "@/types/homologation";

type StatusFilter = "todas" | HomologationCycleStatus;
type SectionFilter = "todas" | ProductChannel;

function statusBadgeClass(status: HomologationCycleStatus): string {
  if (status === "concluida") {
    return "border-emerald-500/40 bg-emerald-500/15 text-emerald-400";
  }
  if (status === "pausada") {
    return "border-amber-500/40 bg-amber-500/15 text-amber-300";
  }
  return "border-primary/40 bg-primary/15 text-primary";
}

function ProgressCell({ hom }: { hom: HomologationWithProgress }) {
  const { progress } = hom;
  const pct =
    progress.total > 0 ? Math.round((progress.passed / progress.total) * 100) : 0;

  return (
    <div className="min-w-[8rem] space-y-1">
      <p className="text-sm tabular-nums">
        {progress.passed}/{progress.total} passou
        {progress.failed > 0 && (
          <span className="ml-1 text-red-400">· {progress.failed} falhou</span>
        )}
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function HomologationsListPage({ project }: { project: ProjectSlug }) {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const channels = getProjectChannels(project);
  const [homologations, setHomologations] = useState<HomologationWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todas");
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>("todas");
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newChannel, setNewChannel] = useState<ProductChannel>(
    defaultChannel(project) ?? "app",
  );
  const [newChangeScope, setNewChangeScope] = useState<HomologationChangeScope>("backend");
  const [creating, setCreating] = useState(false);

  function reload() {
    setLoading(true);
    api
      .listHomologations(project)
      .then((res) => setHomologations(res.homologations))
      .catch((e) => toast.error(toastErrorMessage(e, "Erro ao carregar")))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, [project]);

  const filtered = useMemo(() => {
    let list = homologations;
    if (sectionFilter !== "todas") {
      list = list.filter((h) => h.channel === sectionFilter);
    }
    if (statusFilter !== "todas") {
      list = list.filter((h) => h.status === statusFilter);
    }
    return list;
  }, [homologations, sectionFilter, statusFilter]);

  async function createHomologation() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await api.createHomologation(project, {
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        channel: channels.length > 0 ? newChannel : undefined,
        changeScope: newChangeScope,
      });
      setShowCreateForm(false);
      setNewTitle("");
      setNewDescription("");
      reload();
      navigate(projectHomologationPath(project, res.homologation.slug));
    } catch (e) {
      toast.error(toastErrorMessage(e, "Erro ao criar"));
    } finally {
      setCreating(false);
    }
  }

  async function setStatus(slug: string, status: HomologationCycleStatus, hom: HomologationWithProgress) {
    if (status === "concluida") {
      const allPassed = hom.progress.total > 0 && hom.progress.passed === hom.progress.total;
      const ok = await confirm({
        title: "Concluir homologação",
        description: allPassed
          ? `Marcar “${hom.title}” como concluída?`
          : `Marcar “${hom.title}” como concluída mesmo com ${hom.progress.passed}/${hom.progress.total} passando?`,
        confirmLabel: "Concluir",
        cancelLabel: "Cancelar",
        tone: allPassed ? "run" : "danger",
      });
      if (!ok) return;
    }

    setBusySlug(slug);
    try {
      await api.updateHomologation(project, slug, { status });
      toast.success(
        status === "concluida" ? `"${hom.title}" concluída.` : `"${hom.title}" reaberta.`,
      );
      reload();
    } catch (e) {
      toast.error(toastErrorMessage(e, "Erro ao atualizar status"));
    } finally {
      setBusySlug(null);
    }
  }

  async function syncMuralChecklist() {
    setBusySlug(MURAL_HOMOLOGATION_SLUG);
    try {
      const res = await api.createMuralChecklist(project);
      toast.success(res.message ?? `Checklist: ${res.created} novo(s)`);
      reload();
    } catch (e) {
      toast.error(toastErrorMessage(e, "Erro no checklist Mural"));
    } finally {
      setBusySlug(null);
    }
  }

  const activeCount = homologations.filter((h) => h.status === "em_andamento").length;
  const muralHom = homologations.find((h) => h.slug === MURAL_HOMOLOGATION_SLUG);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Todas as seções do projeto ·{" "}
            <code className="text-xs">data/projects/{project}/homologations.json</code>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {activeCount} em andamento · {homologations.length} no total
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {project === "polygonus" && muralHom && (
            <button
              type="button"
              disabled={busySlug === MURAL_HOMOLOGATION_SLUG}
              onClick={() => void syncMuralChecklist()}
              className={cn(actionBtnBase, actionBtn.checklist, "px-3")}
            >
              <ClipboardList className="size-4" />
              Checklist Mural
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowCreateForm((v) => !v)}
            className={cn(actionBtnBase, actionBtn.create)}
          >
            <Plus className="size-4" />
            Nova homologação
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <p className="text-sm font-medium">Nova campanha</p>
          <input
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            placeholder="Título"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <textarea
            className="min-h-16 w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Descrição (opcional)"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
          />
          <div className="flex flex-wrap gap-3">
            {channels.length > 0 && (
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Seção
                <select
                  className="h-9 rounded-md border bg-background px-3 text-sm text-foreground"
                  value={newChannel}
                  onChange={(e) => setNewChannel(e.target.value as ProductChannel)}
                >
                  {channels.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {CHANNEL_LABELS[ch.id]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Escopo da mudança
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm text-foreground"
                value={newChangeScope}
                onChange={(e) => setNewChangeScope(e.target.value as HomologationChangeScope)}
              >
                {Object.entries(CHANGE_SCOPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={creating || !newTitle.trim()}
              onClick={() => void createHomologation()}
              className={cn(actionBtnBase, actionBtn.create)}
            >
              Criar
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className={cn(actionBtnBase, actionBtn.back)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-muted-foreground">Seção</label>
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          value={sectionFilter}
          onChange={(e) => setSectionFilter(e.target.value as SectionFilter)}
        >
          <option value="todas">Todas</option>
          {channels.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {CHANNEL_LABELS[ch.id]}
            </option>
          ))}
        </select>
        <label className="text-sm text-muted-foreground">Status</label>
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
        >
          <option value="todas">Todas</option>
          <option value="em_andamento">Em andamento</option>
          <option value="concluida">Concluídas</option>
          <option value="pausada">Pausadas</option>
        </select>
        <button
          type="button"
          onClick={() => navigate(projectListPath(project, defaultChannel(project)))}
          className={cn(actionBtnBase, actionBtn.back, "h-8 px-3 text-xs")}
        >
          Voltar aos testes
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Homologação</th>
              <th className="px-4 py-3 font-medium">Seção</th>
              <th className="px-4 py-3 font-medium">Escopo</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Progresso</th>
              <th className="px-4 py-3 font-medium">Início</th>
              <th className="px-4 py-3 font-medium w-28">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  <span className="animate-fade-in-up-soft inline-block opacity-0">
                    Nenhuma homologação neste filtro.
                  </span>
                </td>
              </tr>
            ) : (
              filtered.map((h) => {
                const busy = busySlug === h.slug;
                const allPassed =
                  h.progress.total > 0 && h.progress.passed === h.progress.total;
                const scope = h.changeScope ?? "backend";

                return (
                  <tr key={h.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-medium">{h.title}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {h.id} · {h.slug}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {h.channel ? (
                        <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium">
                          {CHANNEL_LABELS[h.channel]}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Geral</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-xs",
                          changeScopeBadgeClass(scope),
                        )}
                      >
                        {CHANGE_SCOPE_LABELS[scope]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-xs",
                          statusBadgeClass(h.status),
                        )}
                      >
                        {HOMOLOGATION_CYCLE_LABELS[h.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ProgressCell hom={h} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(h.startedAt).toLocaleDateString("pt-BR")}
                      {h.finishedAt && (
                        <p className="text-emerald-400">
                          Fim {new Date(h.finishedAt).toLocaleDateString("pt-BR")}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          title="Abrir"
                          onClick={() => navigate(projectHomologationPath(project, h.slug))}
                          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <ExternalLink className="size-4" />
                        </button>
                        {h.status !== "concluida" ? (
                          <button
                            type="button"
                            title={
                              allPassed
                                ? "Marcar como concluída"
                                : "Concluir (nem todos passaram)"
                            }
                            disabled={busy}
                            onClick={() => void setStatus(h.slug, "concluida", h)}
                            className="rounded p-1.5 text-muted-foreground hover:bg-emerald-500/15 hover:text-emerald-500 disabled:opacity-50"
                          >
                            <CheckCircle2 className="size-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            title="Reabrir"
                            disabled={busy}
                            onClick={() => void setStatus(h.slug, "em_andamento", h)}
                            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                          >
                            <RotateCcw className="size-4" />
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
