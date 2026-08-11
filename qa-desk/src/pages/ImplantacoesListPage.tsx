import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Plus, Rocket } from "lucide-react";
import { api } from "@/lib/api";
import { toastErrorMessage, useToast } from "@/lib/toast";
import { actionBtn, actionBtnBase } from "@/lib/button-styles";
import { projectImplantacaoPath } from "@/lib/project-paths";
import { cn } from "@/lib/utils";
import type { ProjectSlug } from "@/types/test-record";
import type { ImplantacaoTipo } from "@/types/implantacao";

export function ImplantacoesListPage({ project }: { project: ProjectSlug }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [tipos, setTipos] = useState<ImplantacaoTipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  function reload() {
    setLoading(true);
    api
      .listImplantacoes(project)
      .then((res) => setTipos(res.tipos))
      .catch((e) => toast.error(toastErrorMessage(e, "Erro ao carregar")))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, [project]);

  const ativos = useMemo(
    () => tipos.filter((t) => t.status === "ativo"),
    [tipos],
  );

  async function createTipo() {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const res = await api.createImplantacao(project, {
        title,
        description,
      });
      toast.success("Tipo de implantação criado");
      setShowCreate(false);
      setTitle("");
      setDescription("");
      navigate(projectImplantacaoPath(project, res.tipo.slug));
    } catch (e) {
      toast.error(toastErrorMessage(e, "Erro ao criar"));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Rocket className="size-4 shrink-0 opacity-80" />
            Regras e requisitos por tipo de implantação — anotação operacional (não é suite de teste).
          </p>
        </div>
        <button
          type="button"
          className={cn(actionBtnBase, actionBtn.save)}
          onClick={() => setShowCreate((v) => !v)}
        >
          <Plus className="size-4" />
          Novo tipo
        </button>
      </div>

      {showCreate && (
        <div
          className={cn(
            "relative space-y-4 overflow-hidden rounded-lg border border-border bg-background p-5",
          )}
        >
          <div
            className="absolute bottom-0 left-0 top-0 w-1 bg-[var(--project-accent)]"
            aria-hidden
          />
          <p className="pl-2 text-sm font-medium text-foreground">Novo tipo de implantação</p>
          <label className="block space-y-1 pl-2 text-sm">
            <span className="font-medium text-muted-foreground">Título</span>
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Chat em nova unidade"
            />
          </label>
          <label className="block space-y-1 pl-2 text-sm">
            <span className="font-medium text-muted-foreground">Descrição</span>
            <textarea
              className="min-h-16 w-full rounded-md border border-border bg-background px-3 py-2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Quando usar este checklist…"
            />
          </label>
          <div className="flex gap-2 pl-2">
            <button
              type="button"
              disabled={creating || !title.trim()}
              className={cn(actionBtnBase, actionBtn.save)}
              onClick={() => void createTipo()}
            >
              Criar
            </button>
            <button
              type="button"
              className={cn(actionBtnBase, actionBtn.ghost)}
              onClick={() => setShowCreate(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : ativos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          <ClipboardList className="mx-auto mb-2 size-8 opacity-40" />
          Nenhum tipo de implantação ainda.
        </div>
      ) : (
        <ul className="space-y-3">
          {ativos.map((t) => {
            const obrigatorios = t.requisitos.filter((r) => r.obrigatorio).length;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => navigate(projectImplantacaoPath(project, t.slug))}
                  className={cn(
                    "group relative flex w-full cursor-pointer items-start gap-4 overflow-hidden rounded-lg border border-border bg-background p-5 text-left",
                    "transition-colors duration-200 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]",
                  )}
                >
                  <div
                    className="absolute bottom-0 left-0 top-0 w-1 bg-border transition-colors duration-200 group-hover:bg-[var(--project-accent)]"
                    aria-hidden
                  />
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-[var(--project-accent)]">
                    <Rocket className="size-4" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-foreground">{t.title}</p>
                    {t.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {t.description}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
                        {t.requisitos.length} requisito
                        {t.requisitos.length === 1 ? "" : "s"}
                      </span>
                      {obrigatorios > 0 && (
                        <span className="rounded-md border border-red-500/25 bg-red-500/10 px-2 py-0.5 text-[0.6875rem] font-medium text-red-800 dark:text-red-300">
                          {obrigatorios} obrigatório{obrigatorios === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
