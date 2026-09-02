import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, MessageSquare, Plus, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import { actionBtn, actionBtnBase } from "@/lib/button-styles";
import {
  POLYGONUS_GESTOR_DISCORD_CHANNEL,
  discordUrlKind,
} from "@/lib/discord-gestor";
import { toastErrorMessage, useToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { ProjectSlug } from "@/types/test-record";
import type { GestorCase } from "@/types/gestor-case";

type Mode = "list" | "novo" | "continuacao";

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

export function GestorCasesPage({ project }: { project: ProjectSlug }) {
  const toast = useToast();
  const [cases, setCases] = useState<GestorCase[]>([]);
  const [suggestedNext, setSuggestedNext] = useState(1);
  const [discordChannelUrl, setDiscordChannelUrl] = useState(
    POLYGONUS_GESTOR_DISCORD_CHANNEL,
  );
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [discordUrl, setDiscordUrl] = useState("");
  const [internalRef, setInternalRef] = useState("");
  const [linkedTestId, setLinkedTestId] = useState("");
  const [preview, setPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const [contBody, setContBody] = useState("");

  const reload = useCallback(() => {
    setLoading(true);
    api
      .listGestorCases(project)
      .then((res) => {
        setCases(res.cases);
        setSuggestedNext(res.suggestedNextNumber);
        if (res.discordChannelUrl) setDiscordChannelUrl(res.discordChannelUrl);
      })
      .catch((e) => toast.error(toastErrorMessage(e, "Erro ao carregar casos")))
      .finally(() => setLoading(false));
  }, [project, toast]);

  useEffect(() => {
    reload();
  }, [reload]);

  const pendentes = useMemo(
    () => cases.filter((c) => c.status === "pendente"),
    [cases],
  );
  const devolvidos = useMemo(
    () => cases.filter((c) => c.status === "devolvido"),
    [cases],
  );
  const selected = useMemo(
    () => cases.find((c) => c.id === selectedId) ?? null,
    [cases, selectedId],
  );

  function resetNovo() {
    setTitle("");
    setBody("");
    setDiscordUrl("");
    setInternalRef("");
    setLinkedTestId("");
    setPreview("");
    setCreatedId(null);
  }

  async function submitNovo() {
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    try {
      const res = await api.createGestorCase(project, {
        title,
        body,
        discordUrl: discordUrl.trim() || undefined,
        internalRef: internalRef.trim() || undefined,
        linkedTestId: linkedTestId.trim() || undefined,
      });
      setCreatedId(res.case.id);
      setPreview(res.message);
      toast.success(`Caso ${res.case.number} criado — copie e cole no Discord`);
      reload();
    } catch (e) {
      toast.error(toastErrorMessage(e, "Erro ao criar caso"));
    } finally {
      setSaving(false);
    }
  }

  async function submitContinuacao() {
    if (!selectedId || !contBody.trim()) return;
    setSaving(true);
    try {
      const res = await api.addGestorCaseContinuacao(project, selectedId, {
        body: contBody,
      });
      setPreview(res.message);
      toast.success("Continuação registrada");
      setContBody("");
      reload();
    } catch (e) {
      toast.error(toastErrorMessage(e, "Erro ao salvar continuação"));
    } finally {
      setSaving(false);
    }
  }

  async function copiarPreview() {
    if (!preview.trim()) return;
    try {
      await copyText(preview);
      toast.success("Mensagem copiada — cole no Discord");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  async function salvarLinkOriginal(id: string, url: string) {
    if (discordUrlKind(url) !== "message") {
      toast.error(
        "Esse é o link do canal. Depois de enviar, clique com o botão direito na mensagem → Copiar link da mensagem (tem um ID a mais no final).",
      );
      return;
    }
    try {
      await api.updateGestorCaseDiscordUrl(project, id, url);
      toast.success("Link da mensagem original salvo — entra na lista Pendente");
      reload();
    } catch (e) {
      toast.error(toastErrorMessage(e, "Erro ao salvar o link"));
    }
  }

  async function marcarDevolvido(id: string) {
    try {
      await api.markGestorCaseDevolvido(project, id);
      toast.success("Caso marcado como devolvido");
      reload();
    } catch (e) {
      toast.error(toastErrorMessage(e, "Erro ao atualizar"));
    }
  }

  async function recopiarIntro(c: GestorCase) {
    try {
      const res = await api.composeGestorCase(project, c.id, "intro");
      await copyText(res.message);
      toast.success(`Caso ${c.number} copiado`);
    } catch (e) {
      toast.error(toastErrorMessage(e, "Erro ao gerar mensagem"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <MessageSquare className="size-4 shrink-0 opacity-80" />
            Repasse ao gestor via Discord — numeração pessoal (Caso 1, 2, 3…). Próximo
            sugerido:{" "}
            <span className="font-semibold text-foreground">Caso {suggestedNext}</span>
          </p>
          {discordChannelUrl && (
            <a
              href={discordChannelUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1.5 text-xs text-primary underline"
            >
              <ExternalLink className="size-3 shrink-0" />
              Abrir canal do report
            </a>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={cn(actionBtnBase, actionBtn.save)}
            onClick={() => {
              resetNovo();
              setMode("novo");
              setSelectedId(null);
            }}
          >
            <Plus className="size-4" />
            Novo caso
          </button>
          {mode !== "list" && (
            <button
              type="button"
              className={cn(actionBtnBase, actionBtn.ghost)}
              onClick={() => {
                setMode("list");
                setPreview("");
              }}
            >
              Voltar à lista
            </button>
          )}
        </div>
      </div>

      {mode === "novo" && (
        <div className="relative space-y-4 overflow-hidden rounded-lg border border-border bg-background p-5">
          <div
            className="absolute bottom-0 left-0 top-0 w-1 bg-[var(--project-accent)]"
            aria-hidden
          />
          <p className="pl-2 text-sm font-medium">Novo Caso {suggestedNext}</p>
          <label className="block space-y-1 pl-2 text-sm">
            <span className="font-medium text-muted-foreground">Assunto (uma linha)</span>
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Sessão expira no histórico legado"
            />
          </label>
          <label className="block space-y-1 pl-2 text-sm">
            <span className="font-medium text-muted-foreground">Descrição (vai pro Discord)</span>
            <textarea
              className="min-h-28 w-full rounded-md border border-border bg-background px-3 py-2"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Texto do Caso N…"
            />
          </label>
          <label className="block space-y-1 pl-2 text-sm">
            <span className="font-medium text-muted-foreground">
              Referência interna (opcional — não vai pro Discord)
            </span>
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              value={internalRef}
              onChange={(e) => setInternalRef(e.target.value)}
              placeholder="BUG-2026-042, HOM-004, etc."
            />
          </label>
          <label className="block space-y-1 pl-2 text-sm">
            <span className="font-medium text-muted-foreground">
              ID registro Desk (opcional)
            </span>
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              value={linkedTestId}
              onChange={(e) => setLinkedTestId(e.target.value)}
              placeholder="TEST-2026-077"
            />
          </label>
          <div className="flex gap-2 pl-2">
            <button
              type="button"
              disabled={saving || !title.trim() || !body.trim()}
              className={cn(actionBtnBase, actionBtn.save)}
              onClick={() => void submitNovo()}
            >
              Criar e gerar mensagem
            </button>
          </div>
          {preview && (
            <div className="space-y-4 pl-2">
              <PreviewBlock preview={preview} onCopy={() => void copiarPreview()} />
              {createdId && (
                <DiscordOriginalLinkField
                  currentUrl={
                    cases.find((c) => c.id === createdId)?.discordUrl || discordUrl
                  }
                  channelUrl={discordChannelUrl}
                  onSave={(url) => {
                    setDiscordUrl(url);
                    void salvarLinkOriginal(createdId, url);
                  }}
                />
              )}
            </div>
          )}
        </div>
      )}

      {mode === "continuacao" && selected && (
        <div className="relative space-y-4 overflow-hidden rounded-lg border border-border bg-background p-5">
          <div
            className="absolute bottom-0 left-0 top-0 w-1 bg-[var(--project-accent)]"
            aria-hidden
          />
          <p className="pl-2 text-sm font-medium">
            Continuação — Caso {selected.number}: {selected.title}
          </p>
          <label className="block space-y-1 pl-2 text-sm">
            <span className="font-medium text-muted-foreground">Texto da continuação</span>
            <textarea
              className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2"
              value={contBody}
              onChange={(e) => setContBody(e.target.value)}
              placeholder="Continuação do caso…"
            />
          </label>
          <button
            type="button"
            disabled={saving || !contBody.trim()}
            className={cn(actionBtnBase, actionBtn.save)}
            onClick={() => void submitContinuacao()}
          >
            Gerar continuação
          </button>
          {preview && (
            <PreviewBlock preview={preview} onCopy={() => void copiarPreview()} />
          )}
        </div>
      )}

      {mode === "list" && (
        <>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : cases.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum caso seu ainda. Crie o Caso 1.
            </p>
          ) : (
            <div className="space-y-6">
              {pendentes.length > 0 && (
                <CaseSection
                  title="Pendentes"
                  discordChannelUrl={discordChannelUrl}
                  items={pendentes}
                  onContinuacao={(id) => {
                    setSelectedId(id);
                    setPreview("");
                    setContBody("");
                    setMode("continuacao");
                  }}
                  onDevolvido={(id) => void marcarDevolvido(id)}
                  onRecopiar={(c) => void recopiarIntro(c)}
                  onSaveOriginalLink={(id, url) => void salvarLinkOriginal(id, url)}
                />
              )}
              {devolvidos.length > 0 && (
                <CaseSection
                  title="Devolvidos"
                  discordChannelUrl={discordChannelUrl}
                  items={devolvidos}
                  onContinuacao={() => undefined}
                  onDevolvido={() => undefined}
                  onRecopiar={(c) => void recopiarIntro(c)}
                  onSaveOriginalLink={(id, url) => void salvarLinkOriginal(id, url)}
                  devolvido
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DiscordOriginalLinkField({
  currentUrl,
  channelUrl,
  onSave,
}: {
  currentUrl: string;
  channelUrl?: string;
  onSave: (url: string) => void;
}) {
  const [url, setUrl] = useState(currentUrl);

  useEffect(() => {
    setUrl(currentUrl);
  }, [currentUrl]);

  const dirty = url.trim() !== currentUrl.trim();
  const missing = !currentUrl.trim();
  const pastedKind = url.trim() ? discordUrlKind(url) : null;

  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium text-muted-foreground">
        Link da mensagem original no Discord
      </span>
      <p className="text-xs text-muted-foreground">
        Cole no{" "}
        {channelUrl ? (
          <a href={channelUrl} target="_blank" rel="noreferrer" className="text-primary underline">
            canal do report
          </a>
        ) : (
          "canal do report"
        )}
        , depois botão direito na mensagem → Copiar link da mensagem. Esse link (com o ID da
        mensagem no final) é o que o Moacir vê na lista{" "}
        <span className="font-medium">Pendente</span>.
      </p>
      {missing && (
        <p className="text-xs text-amber-400/90">Ainda sem o link original deste caso.</p>
      )}
      {pastedKind === "channel" && (
        <p className="text-xs text-amber-400/90">
          Isso é o link do canal. Falta o ID da mensagem no final.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          className="min-w-[16rem] flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={
            channelUrl
              ? `${channelUrl.replace(/\/$/, "")}/…`
              : "https://discord.com/channels/…/…/…"
          }
        />
        <button
          type="button"
          disabled={!url.trim() || !dirty}
          className={cn(actionBtnBase, actionBtn.save)}
          onClick={() => onSave(url.trim())}
        >
          Salvar link
        </button>
      </div>
      {currentUrl.trim() && (
        <a
          href={currentUrl}
          target="_blank"
          rel="noreferrer"
          className="block truncate text-xs text-primary underline"
        >
          {currentUrl}
        </a>
      )}
    </div>
  );
}

function PreviewBlock({
  preview,
  onCopy,
}: {
  preview: string;
  onCopy: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">Preview Discord</span>
        <button type="button" className={cn(actionBtnBase, actionBtn.save)} onClick={onCopy}>
          <Copy className="size-4" />
          Copiar mensagem
        </button>
      </div>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-sm">
        {preview}
      </pre>
    </div>
  );
}

function CaseSection({
  title,
  items,
  discordChannelUrl,
  onContinuacao,
  onDevolvido,
  onRecopiar,
  onSaveOriginalLink,
  devolvido = false,
}: {
  title: string;
  items: GestorCase[];
  discordChannelUrl?: string;
  onContinuacao: (id: string) => void;
  onDevolvido: (id: string) => void;
  onRecopiar: (c: GestorCase) => void;
  onSaveOriginalLink: (id: string, url: string) => void;
  devolvido?: boolean;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <ul className="space-y-2">
        {items.map((c) => (
          <li
            key={c.id}
            className="rounded-lg border border-border bg-background p-4 text-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">
                  Caso {c.number} — {c.title}
                </p>
                {(c.internalRef || c.linkedTestId) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ref. interna: {[c.internalRef, c.linkedTestId].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={cn(actionBtnBase, actionBtn.ghost)}
                  onClick={() => onRecopiar(c)}
                >
                  <Copy className="size-3.5" />
                  Copiar intro
                </button>
                {!devolvido && (
                  <>
                    <button
                      type="button"
                      className={cn(actionBtnBase, actionBtn.ghost)}
                      onClick={() => onContinuacao(c.id)}
                    >
                      Continuação
                    </button>
                    <button
                      type="button"
                      className={cn(actionBtnBase, actionBtn.save)}
                      onClick={() => onDevolvido(c.id)}
                    >
                      <RotateCcw className="size-3.5" />
                      Devolvido
                    </button>
                  </>
                )}
              </div>
            </div>
            {!devolvido && (
              <div className="mt-3 border-t border-border/60 pt-3">
                <DiscordOriginalLinkField
                  currentUrl={c.discordUrl}
                  channelUrl={discordChannelUrl}
                  onSave={(url) => onSaveOriginalLink(c.id, url)}
                />
              </div>
            )}
            {devolvido && c.discordUrl.trim() && (
              <a
                href={c.discordUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block truncate text-xs text-primary underline"
              >
                {c.discordUrl}
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
