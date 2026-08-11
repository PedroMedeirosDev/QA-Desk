import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Database,
  Pencil,
  Plus,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { api } from "@/lib/api";
import { toastErrorMessage, useToast } from "@/lib/toast";
import { actionBtn, actionBtnBase } from "@/lib/button-styles";
import { projectImplantacoesListPath } from "@/lib/project-paths";
import { cn } from "@/lib/utils";
import type { ProjectSlug } from "@/types/test-record";
import {
  EXECUTOR_LABELS,
  REQUISITO_TIPO_LABELS,
  type ImplantacaoExecutor,
  type ImplantacaoRequisitoTipo,
  type ImplantacaoTipo,
} from "@/types/implantacao";

function tipoBadgeClass(tipo: ImplantacaoRequisitoTipo): string {
  if (tipo === "sql") {
    return "border-amber-500/35 bg-amber-500/10 text-amber-900 dark:text-amber-200";
  }
  if (tipo === "aviso") {
    return "border-orange-500/35 bg-orange-500/10 text-orange-900 dark:text-orange-200";
  }
  if (tipo === "config") {
    return "border-sky-500/35 bg-sky-500/10 text-sky-900 dark:text-sky-200";
  }
  return "border-border bg-muted/50 text-muted-foreground";
}

/** Destaca nomes de arquivo .sql (e similares) em code. */
function formatDetalheComCodigo(text: string): ReactNode[] {
  const parts = text.split(/(\b[\w.-]+\.(?:sql|sh|ps1|yml|yaml|json)\b)/gi);
  return parts.map((part, i) => {
    if (/\.(sql|sh|ps1|yml|yaml|json)$/i.test(part)) {
      return (
        <code
          key={i}
          className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.8125rem] text-foreground"
        >
          {part}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function ImplantacaoPage({
  project,
  impSlug,
}: {
  project: ProjectSlug;
  impSlug: string;
}) {
  const toast = useToast();
  const [tipo, setTipo] = useState<ImplantacaoTipo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [form, setForm] = useState({
    titulo: "",
    detalhe: "",
    tipo: "manual" as ImplantacaoRequisitoTipo,
    executor: "outro" as ImplantacaoExecutor,
    obrigatorio: true,
    fonte: "",
    fonteEm: "",
    notas: "",
  });

  function reload() {
    setLoading(true);
    api
      .getImplantacao(project, impSlug)
      .then((res) => {
        setTipo(res.tipo);
        setMetaTitle(res.tipo.title);
        setMetaDescription(res.tipo.description ?? "");
      })
      .catch((e) => toast.error(toastErrorMessage(e, "Erro ao carregar")))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, [project, impSlug]);

  function startEditMeta() {
    if (!tipo) return;
    setMetaTitle(tipo.title);
    setMetaDescription(tipo.description ?? "");
    setEditingMeta(true);
  }

  async function saveMeta() {
    if (!metaTitle.trim()) {
      toast.error("Título é obrigatório");
      return;
    }
    setSavingMeta(true);
    try {
      const res = await api.updateImplantacao(project, impSlug, {
        title: metaTitle.trim(),
        description: metaDescription,
      });
      setTipo(res.tipo);
      setEditingMeta(false);
      toast.success("Título atualizado");
    } catch (e) {
      toast.error(toastErrorMessage(e, "Erro ao salvar"));
    } finally {
      setSavingMeta(false);
    }
  }

  async function addRequisito() {
    if (!form.titulo.trim() || !form.detalhe.trim()) return;
    setSaving(true);
    try {
      const res = await api.addImplantacaoRequisito(project, impSlug, {
        titulo: form.titulo,
        detalhe: form.detalhe,
        tipo: form.tipo,
        executor: form.executor,
        obrigatorio: form.obrigatorio,
        fonte: form.fonte || undefined,
        fonteEm: form.fonteEm || undefined,
        notas: form.notas || undefined,
      });
      setTipo(res.tipo);
      setShowAdd(false);
      setForm({
        titulo: "",
        detalhe: "",
        tipo: "manual",
        executor: "outro",
        obrigatorio: true,
        fonte: "",
        fonteEm: "",
        notas: "",
      });
      toast.success("Requisito adicionado");
    } catch (e) {
      toast.error(toastErrorMessage(e, "Erro ao adicionar"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }
  if (!tipo) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Implantação não encontrada.</p>
        <Link
          to={projectImplantacoesListPath(project)}
          className="inline-flex items-center gap-1 text-sm text-primary"
        >
          <ArrowLeft className="size-3.5" /> Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <Link
            to={projectImplantacoesListPath(project)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Implantações
          </Link>
          {editingMeta ? (
            <div className="relative mt-1 max-w-2xl space-y-3 overflow-hidden rounded-lg border border-border bg-background p-4">
              <div
                className="absolute bottom-0 left-0 top-0 w-1 bg-[var(--project-accent)]"
                aria-hidden
              />
              <label className="block space-y-1 pl-2 text-sm">
                <span className="font-medium text-muted-foreground">Título</span>
                <input
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-lg font-semibold"
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  autoFocus
                />
              </label>
              <label className="block space-y-1 pl-2 text-sm">
                <span className="font-medium text-muted-foreground">Descrição</span>
                <textarea
                  className="min-h-16 w-full rounded-md border border-border bg-background px-3 py-2"
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  placeholder="Quando usar este checklist…"
                />
              </label>
              <div className="flex gap-2 pl-2">
                <button
                  type="button"
                  disabled={savingMeta || !metaTitle.trim()}
                  className={cn(actionBtnBase, actionBtn.save)}
                  onClick={() => void saveMeta()}
                >
                  Salvar
                </button>
                <button
                  type="button"
                  className={cn(actionBtnBase, actionBtn.ghost)}
                  onClick={() => {
                    setEditingMeta(false);
                    setMetaTitle(tipo.title);
                    setMetaDescription(tipo.description ?? "");
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-foreground">{tipo.title}</h2>
                {tipo.description ? (
                  <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
                    {tipo.description}
                  </p>
                ) : (
                  <p className="mt-0.5 text-sm italic text-muted-foreground/70">
                    Sem descrição
                  </p>
                )}
              </div>
              <button
                type="button"
                className="mt-1 inline-flex shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={startEditMeta}
                title="Editar título e descrição"
                aria-label="Editar título e descrição"
              >
                <Pencil className="size-4" />
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          className={cn(actionBtnBase, actionBtn.save)}
          onClick={() => setShowAdd((v) => !v)}
        >
          <Plus className="size-4" />
          Requisito
        </button>
      </div>

      <div
        className={cn(
          "mb-2 flex items-start gap-3 rounded-lg border border-border border-l-4 border-l-amber-500",
          "bg-amber-500/10 p-4 text-sm text-amber-950 dark:text-amber-100/90",
        )}
      >
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" />
        <p>
          Isto é checklist de implantação. Scripts SQL e mudanças de banco são
          executados por quem tem permissão (ex.: DBA) — o Desk só documenta.
        </p>
      </div>

      {showAdd && (
        <div className="relative grid gap-3 overflow-hidden rounded-lg border border-border bg-background p-5 sm:grid-cols-2">
          <div
            className="absolute bottom-0 left-0 top-0 w-1 bg-[var(--project-accent)]"
            aria-hidden
          />
          <p className="pl-2 text-sm font-medium text-foreground sm:col-span-2">
            Novo requisito
          </p>
          <label className="block space-y-1 pl-2 text-sm sm:col-span-2">
            <span className="font-medium text-muted-foreground">Título</span>
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              value={form.titulo}
              onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
            />
          </label>
          <label className="block space-y-1 pl-2 text-sm sm:col-span-2">
            <span className="font-medium text-muted-foreground">Detalhe</span>
            <textarea
              className="min-h-20 w-full rounded-md border border-border bg-background px-3 py-2"
              value={form.detalhe}
              onChange={(e) => setForm((f) => ({ ...f, detalhe: e.target.value }))}
              placeholder="Inclua o nome do script, ex.: chat_backfill_migracao_chat_novo.sql"
            />
          </label>
          <label className="block space-y-1 pl-2 text-sm">
            <span className="font-medium text-muted-foreground">Tipo</span>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              value={form.tipo}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  tipo: e.target.value as ImplantacaoRequisitoTipo,
                }))
              }
            >
              {(Object.keys(REQUISITO_TIPO_LABELS) as ImplantacaoRequisitoTipo[]).map(
                (k) => (
                  <option key={k} value={k}>
                    {REQUISITO_TIPO_LABELS[k]}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="block space-y-1 pl-2 text-sm">
            <span className="font-medium text-muted-foreground">Executor</span>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              value={form.executor}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  executor: e.target.value as ImplantacaoExecutor,
                }))
              }
            >
              {(Object.keys(EXECUTOR_LABELS) as ImplantacaoExecutor[]).map((k) => (
                <option key={k} value={k}>
                  {EXECUTOR_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 pl-2 text-sm">
            <span className="font-medium text-muted-foreground">Fonte</span>
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              value={form.fonte}
              onChange={(e) => setForm((f) => ({ ...f, fonte: e.target.value }))}
              placeholder="Ex.: Moacir Schmidt"
            />
          </label>
          <label className="block space-y-1 pl-2 text-sm">
            <span className="font-medium text-muted-foreground">Data da fonte</span>
            <input
              type="date"
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              value={form.fonteEm}
              onChange={(e) => setForm((f) => ({ ...f, fonteEm: e.target.value }))}
            />
          </label>
          <label className="block space-y-1 pl-2 text-sm sm:col-span-2">
            <span className="font-medium text-muted-foreground">Notas</span>
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              value={form.notas}
              onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
            />
          </label>
          <label className="flex items-center gap-2 pl-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={form.obrigatorio}
              onChange={(e) =>
                setForm((f) => ({ ...f, obrigatorio: e.target.checked }))
              }
            />
            Obrigatório
          </label>
          <div className="flex gap-2 pl-2 sm:col-span-2">
            <button
              type="button"
              disabled={saving}
              className={cn(actionBtnBase, actionBtn.save)}
              onClick={() => void addRequisito()}
            >
              Salvar requisito
            </button>
            <button
              type="button"
              className={cn(actionBtnBase, actionBtn.ghost)}
              onClick={() => setShowAdd(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <ol className="space-y-3">
        {tipo.requisitos.map((r) => (
          <li
            key={r.id}
            className="relative flex gap-5 rounded-lg border border-border bg-background p-6"
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold tabular-nums",
                "border-[var(--project-highlight-border)] bg-[var(--project-highlight-bg)] text-[var(--project-highlight-text)]",
              )}
            >
              {r.ordem}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <p className="font-semibold text-foreground">{r.titulo}</p>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wider",
                    tipoBadgeClass(r.tipo),
                  )}
                >
                  {r.tipo === "sql" && <Database className="size-3" />}
                  {REQUISITO_TIPO_LABELS[r.tipo]}
                </span>
                {r.obrigatorio && (
                  <span className="rounded-md border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wider text-red-800 dark:text-red-300">
                    Obrigatório
                  </span>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {formatDetalheComCodigo(r.detalhe)}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <UserRound className="size-3.5 opacity-70" />
                  Executor: {EXECUTOR_LABELS[r.executor]}
                </span>
                {r.fonte && (
                  <span>
                    Fonte: {r.fonte}
                    {r.fonteEm ? ` (${r.fonteEm})` : ""}
                  </span>
                )}
              </div>
              {r.notas && (
                <p className="mt-2 text-xs italic text-amber-700/80 dark:text-amber-400/70">
                  {r.notas}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>

      {tipo.requisitos.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum requisito ainda. Adicione o primeiro checklist.
        </p>
      )}
    </div>
  );
}
