import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardCopy, ExternalLink, Inbox, Paperclip, Plus, ScanText } from "lucide-react";
import { api } from "@/lib/api";
import { toastErrorMessage, useToast } from "@/lib/toast";
import { actionBtn, actionBtnBase } from "@/lib/button-styles";
import { projectBugDetailPath, projectDemandaPath, projectDemandasPath } from "@/lib/project-paths";
import { cn } from "@/lib/utils";
import type { ProjectSlug } from "@/types/test-record";
import {
  DEMANDA_STATUS_LABELS,
  DEMANDA_STATUS_ORDER,
  type Demanda,
  type DemandaStatus,
  type PendenciaItem,
} from "@/types/demanda";

type Filtro = "abertas" | DemandaStatus;

const STATUS_TEXTO: Record<DemandaStatus, string> = {
  a_fazer: "text-gray-300 border-gray-400/20",
  fazendo: "text-sky-300 border-sky-400/20",
  aguardando: "text-amber-300 border-amber-400/20",
  feito: "text-emerald-300 border-emerald-400/20",
};

function StatusBadge({ status }: { status: DemandaStatus }) {
  return (
    <span
      className={cn(
        "rounded-md border bg-[#1a1a1a] px-2 py-0.5 text-[0.6875rem] font-medium",
        STATUS_TEXTO[status],
      )}
    >
      {DEMANDA_STATUS_LABELS[status]}
    </span>
  );
}

function dataCurta(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function DemandasPage({ project, demandaRef }: { project: ProjectSlug; demandaRef?: string }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [pessoas, setPessoas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("abertas");
  const [comQuemFiltro, setComQuemFiltro] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [novoTexto, setNovoTexto] = useState("");
  const [creating, setCreating] = useState(false);

  const [pessoaLista, setPessoaLista] = useState("Moacir");
  const [lista, setLista] = useState<{ itens: PendenciaItem[]; texto: string } | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    api
      .listDemandas(project)
      .then((res) => {
        setDemandas(res.demandas);
        setPessoas(res.pessoas);
      })
      .catch((e) => toast.error(toastErrorMessage(e, "Erro ao carregar demandas")))
      .finally(() => setLoading(false));
  }, [project, toast]);

  useEffect(() => {
    reload();
  }, [reload]);

  const contagem = useMemo(() => {
    const c: Record<Filtro, number> = { abertas: 0, a_fazer: 0, fazendo: 0, aguardando: 0, feito: 0 };
    for (const d of demandas) {
      c[d.status] += 1;
      if (d.status !== "feito") c.abertas += 1;
    }
    return c;
  }, [demandas]);

  const visiveis = useMemo(
    () =>
      demandas.filter((d) => {
        if (filtro === "abertas" ? d.status === "feito" : d.status !== filtro) return false;
        return !comQuemFiltro || d.comQuem === comQuemFiltro;
      }),
    [demandas, filtro, comQuemFiltro],
  );

  const selecionada = useMemo(() => {
    if (!demandaRef) return undefined;
    const ref = demandaRef.toUpperCase();
    return demandas.find((d) => d.codigo === ref || d.id === demandaRef);
  }, [demandas, demandaRef]);

  function trocar(d: Demanda) {
    setDemandas((todas) => todas.map((x) => (x.id === d.id ? d : x)));
  }

  async function criar() {
    if (!novoTexto.trim()) return;
    setCreating(true);
    try {
      const d = await api.createDemanda(project, { texto: novoTexto });
      setDemandas((todas) => [d, ...todas]);
      setNovoTexto("");
      setShowCreate(false);
      toast.success(`${d.codigo} criada`);
    } catch (e) {
      toast.error(toastErrorMessage(e, "Erro ao criar demanda"));
    } finally {
      setCreating(false);
    }
  }

  async function gerarLista() {
    if (!pessoaLista.trim()) return;
    try {
      const res = await api.listPendencias(project, pessoaLista.trim());
      setLista(res);
      if (res.itens.length === 0) {
        toast.info(`Nada pendente com ${res.comQuem}`);
        return;
      }
      await navigator.clipboard.writeText(res.texto);
      toast.success(`Lista com ${res.itens.length} item(ns) copiada`);
    } catch (e) {
      toast.error(toastErrorMessage(e, "Erro ao montar a lista"));
    }
  }

  const filtros: Filtro[] = ["abertas", ...DEMANDA_STATUS_ORDER];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Inbox className="size-4 shrink-0 opacity-80" />
          Encaminhe para #demandas no Discord ou anote aqui. Aguardando exige "com quem".
        </p>
        <button
          type="button"
          className={cn(actionBtnBase, actionBtn.create)}
          onClick={() => setShowCreate((v) => !v)}
        >
          <Plus className="size-4" />
          Nova demanda
        </button>
      </div>

      {showCreate && (
        <div className="relative space-y-3 overflow-hidden rounded-lg border border-border bg-background p-5">
          <div className="absolute bottom-0 left-0 top-0 w-1 bg-[var(--project-accent)]" aria-hidden />
          <label className="block space-y-1 pl-2 text-sm">
            <span className="font-medium text-muted-foreground">Texto (a primeira linha vira o título)</span>
            <textarea
              className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2"
              value={novoTexto}
              onChange={(e) => setNovoTexto(e.target.value)}
              placeholder="Ex.: Ver com o Moacir o limite de 4 lançamentos na composição"
            />
          </label>
          <div className="flex gap-2 pl-2">
            <button
              type="button"
              disabled={creating || !novoTexto.trim()}
              className={cn(actionBtnBase, actionBtn.save)}
              onClick={() => void criar()}
            >
              Criar
            </button>
            <button type="button" className={cn(actionBtnBase, actionBtn.ghost)} onClick={() => setShowCreate(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-background p-4">
        <label className="space-y-1 text-sm">
          <span className="block font-medium text-muted-foreground">Pendências com</span>
          <input
            list="demandas-pessoas"
            className="w-48 rounded-md border border-border bg-background px-3 py-2"
            value={pessoaLista}
            onChange={(e) => setPessoaLista(e.target.value)}
          />
          <datalist id="demandas-pessoas">
            {pessoas.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </label>
        <button type="button" className={cn(actionBtnBase, actionBtn.ghost)} onClick={() => void gerarLista()}>
          <ClipboardCopy className="size-4" />
          Copiar lista
        </button>
        {lista && lista.itens.length > 0 && (
          <pre className="w-full whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            {lista.texto}
          </pre>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {filtros.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFiltro(f)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm transition-colors",
              filtro === f ? "border-white/40 bg-white/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {f === "abertas" ? "Abertas" : DEMANDA_STATUS_LABELS[f]}{" "}
            <span className="tabular-nums opacity-70">{contagem[f]}</span>
          </button>
        ))}
        <select
          aria-label="Filtrar por com quem"
          className="ml-auto rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          value={comQuemFiltro}
          onChange={(e) => setComQuemFiltro(e.target.value)}
        >
          <option value="">Com quem: todos</option>
          {pessoas.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="min-w-0">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : visiveis.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              <Inbox className="mx-auto mb-2 size-8 opacity-40" />
              Nenhuma demanda neste filtro.
            </div>
          ) : (
            <ul className="space-y-2">
              {visiveis.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => navigate(projectDemandaPath(project, d.codigo))}
                    aria-current={selecionada?.id === d.id ? "true" : undefined}
                    className={cn(
                      "group relative flex w-full items-start gap-3 overflow-hidden rounded-lg border bg-background p-4 text-left transition-colors",
                      selecionada?.id === d.id ? "border-[var(--project-accent)]" : "border-border hover:bg-white/[0.03]",
                    )}
                  >
                    <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{d.codigo}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{d.titulo}</span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-2 text-[0.6875rem] text-muted-foreground">
                        <StatusBadge status={d.status} />
                        {d.comQuem && <span>com {d.comQuem}</span>}
                        {d.anexos.length > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Paperclip className="size-3" />
                            {d.anexos.length}
                          </span>
                        )}
                        <span className="tabular-nums">{dataCurta(d.criadaEm)}</span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="min-w-0 lg:sticky lg:top-4">
          {selecionada ? (
            <DemandaDetalhe key={selecionada.id} project={project} demanda={selecionada} onSalva={trocar} />
          ) : demandaRef && !loading ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              Demanda {demandaRef} não encontrada.{" "}
              <button type="button" className="underline" onClick={() => navigate(projectDemandasPath(project))}>
                Voltar à lista
              </button>
            </div>
          ) : (
            <div className="hidden rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground lg:block">
              Escolha uma demanda para ver o texto e os anexos.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function DemandaDetalhe({
  project,
  demanda,
  onSalva,
}: {
  project: ProjectSlug;
  demanda: Demanda;
  onSalva: (d: Demanda) => void;
}) {
  const toast = useToast();
  const [comQuem, setComQuem] = useState(demanda.comQuem ?? "");
  const [salvando, setSalvando] = useState(false);

  async function mudarStatus(status: DemandaStatus) {
    if (status === "aguardando" && !comQuem.trim()) {
      toast.error("Informe com quem a demanda está aguardando");
      return;
    }
    setSalvando(true);
    try {
      const d = await api.updateDemanda(project, demanda.codigo, {
        status,
        comQuem: status === "aguardando" ? comQuem.trim() : "",
      });
      onSalva(d);
      toast.success(`${d.codigo}: ${DEMANDA_STATUS_LABELS[d.status]}`);
    } catch (e) {
      toast.error(toastErrorMessage(e, "Erro ao atualizar"));
    } finally {
      setSalvando(false);
    }
  }

  const { origem } = demanda;

  return (
    <div className="space-y-4 rounded-lg border border-border bg-background p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs tabular-nums text-muted-foreground">{demanda.codigo}</p>
          <h2 className="text-base font-semibold text-foreground">{demanda.titulo}</h2>
        </div>
        <StatusBadge status={demanda.status} />
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        {origem.linkOriginal && (
          <a href={origem.linkOriginal} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-300 hover:underline">
            <ExternalLink className="size-3" />
            Mensagem original
          </a>
        )}
        {origem.linkCaptura && (
          <a href={origem.linkCaptura} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:underline">
            <ExternalLink className="size-3" />
            Captura no #demandas
          </a>
        )}
        {origem.dataOriginal && (
          <span className="tabular-nums text-muted-foreground">
            enviada em {new Date(origem.dataOriginal).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
          </span>
        )}
        {demanda.bugId && (
          <a href={projectBugDetailPath(project, demanda.bugId)} className="text-sky-300 hover:underline">
            Bug {demanda.bugId}
          </a>
        )}
      </div>

      {origem.textoDoPrint && (
        <p className="flex items-center gap-2 rounded-md border border-amber-400/20 bg-[#1a1a1a] px-3 py-2 text-xs text-amber-300">
          <ScanText className="size-4 shrink-0" />
          Parte do texto foi lida do print: confira números e nomes com a imagem.
        </p>
      )}

      <p className="max-h-[28rem] overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-muted/20 p-3 text-sm text-foreground scrollbar-thin">
        {demanda.texto || "(sem texto)"}
      </p>

      {demanda.anexos.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {demanda.anexos.map((a) =>
            a.mimeType.startsWith("image/") ? (
              <a key={a.fileId} href={api.evidenceUrl(a.storageKey)} target="_blank" rel="noreferrer">
                <img
                  src={api.evidenceUrl(a.storageKey)}
                  alt={a.filename}
                  className="max-h-48 rounded-md border border-border"
                />
              </a>
            ) : (
              <a
                key={a.fileId}
                href={api.evidenceUrl(a.storageKey)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-sky-300 hover:underline"
              >
                <Paperclip className="size-3" />
                {a.filename}
              </a>
            ),
          )}
        </div>
      )}

      <div className="space-y-3 border-t border-border pt-4">
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-muted-foreground">Com quem (para Aguardando)</span>
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            value={comQuem}
            onChange={(e) => setComQuem(e.target.value)}
            placeholder="Ex.: Moacir"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {DEMANDA_STATUS_ORDER.filter((s) => s !== demanda.status).map((s) => (
            <button
              key={s}
              type="button"
              disabled={salvando}
              className={cn(actionBtnBase, s === "feito" ? actionBtn.homologate : actionBtn.ghost)}
              onClick={() => void mudarStatus(s)}
            >
              {DEMANDA_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
