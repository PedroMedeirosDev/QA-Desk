import { Fragment, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Download,
  ExternalLink,
  GitMerge,
  GitPullRequest,
  Loader2,
  RefreshCw,
  Save,
  Search,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { actionBtn, actionBtnBase } from "@/lib/button-styles";
import { api } from "@/lib/api";
import { downloadHtmlReport } from "@/lib/html-report";
import {
  buildKbCurationHtmlReport,
  computeKbCurationReportMetrics,
  kbCurationReportFilename,
} from "@/lib/kb-curation-report";
import { listenKbCurationStream } from "@/lib/kb-curation-stream";
import { toastErrorMessage, useToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type {
  KbCurationMetrics,
  KbCurationRecord,
  KbCurationStatus,
  KbCurationVerdict,
} from "@/types/kb-curation";
import type { ProjectSlug } from "@/types/test-record";

const STATUS_OPTIONS: KbCurationStatus[] = [
  "aguardando_revisao",
  "aguardando_correcao",
  "aguardando_rerevisao",
  "aprovada",
  "mesclada",
  "bloqueada",
  "fechada",
];

const STATUS_LABELS: Record<KbCurationStatus, string> = {
  aguardando_revisao: "Aguardando revisão",
  aguardando_correcao: "Aguardando correção",
  aguardando_rerevisao: "Respondida (re-revisar)",
  aprovada: "Aprovada",
  mesclada: "Mesclada",
  bloqueada: "Bloqueada",
  fechada: "Fechada (sem merge)",
  pendente: "Aguardando revisão",
  em_revisao: "Aguardando revisão",
};

const VERDICT_LABELS: Record<KbCurationVerdict, string> = {
  aprovavel: "Aprovável",
  precisa_correcao: "Precisa correção",
  bloqueado: "Bloqueado",
  inconclusivo: "Inconclusivo",
};

const EMPTY_METRICS: KbCurationMetrics = {
  total: 0,
  awaitingReview: 0,
  awaitingCorrection: 0,
  awaitingRereview: 0,
  approved: 0,
  merged: 0,
  blocked: 0,
  closedUnmerged: 0,
  completionPercent: 0,
};

function matchesReportStatus(
  record: KbCurationRecord,
  status: "todas" | KbCurationStatus,
): boolean {
  if (status === "todas") return true;
  if (status === "aguardando_revisao") {
    return (
      record.status === "aguardando_revisao" ||
      record.status === "pendente" ||
      record.status === "em_revisao"
    );
  }
  return record.status === status;
}

function badgeClass(status: KbCurationStatus): string {
  if (status === "mesclada" || status === "aprovada") {
    return "border-emerald-500/40 bg-emerald-500/15 text-emerald-300";
  }
  if (status === "bloqueada") {
    return "border-red-500/40 bg-red-500/15 text-red-300";
  }
  if (status === "fechada") {
    return "border-zinc-500/40 bg-zinc-500/15 text-zinc-300";
  }
  if (status === "aguardando_rerevisao") {
    return "border-orange-500/50 bg-orange-500/20 text-orange-300";
  }
  if (status === "aguardando_correcao") {
    return "border-amber-500/40 bg-amber-500/15 text-amber-300";
  }
  if (status === "aguardando_revisao" || status === "pendente" || status === "em_revisao") {
    return "border-sky-500/40 bg-sky-500/15 text-sky-300";
  }
  return "border-primary/40 bg-primary/15 text-primary";
}

function MetricCard({
  label,
  value,
  hint,
  tone = "neutral",
  emphasis = false,
}: {
  label: string;
  value: number | string;
  hint: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "attention";
  /** Destaque sutil do totalizador (Escopo). */
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4",
        emphasis && "border-t-2 border-t-gray-500 bg-gray-800/50",
      )}
    >
      <p className="text-[0.75rem] uppercase tracking-wider text-gray-400">{label}</p>
      <p
        className={cn(
          "mt-2 text-3xl font-semibold tabular-nums text-foreground",
          tone === "success" && "text-green-400",
          tone === "warning" && "text-amber-300",
          tone === "danger" && "text-red-400",
          tone === "attention" && "text-orange-300",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RecordEditor({
  record,
  saving,
  onSave,
}: {
  record: KbCurationRecord;
  saving: boolean;
  onSave: (
    record: KbCurationRecord,
    update: {
      status: KbCurationStatus;
      verdict: KbCurationVerdict;
      solutionReview: string;
      corrections: string[];
      reviewer: string;
    },
  ) => Promise<void>;
}) {
  const [status, setStatus] = useState(record.status);
  const [verdict, setVerdict] = useState(record.verdict);
  const [solutionReview, setSolutionReview] = useState(
    record.solutionReview ?? record.summary ?? "",
  );
  const [corrections, setCorrections] = useState((record.corrections ?? []).join("\n"));
  const { user } = useAuth();
  const [reviewer, setReviewer] = useState(
    record.reviewer?.trim() || user?.actor || "",
  );

  return (
    <div className="grid gap-4 border-t border-border bg-muted/20 p-4 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-xs text-muted-foreground">
            Status
            <select
              className="h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground"
              value={status}
              onChange={(event) => setStatus(event.target.value as KbCurationStatus)}
            >
              {STATUS_OPTIONS.map((value) => (
                <option key={value} value={value}>{STATUS_LABELS[value]}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Veredito
            <select
              className="h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground"
              value={verdict}
              onChange={(event) => setVerdict(event.target.value as KbCurationVerdict)}
            >
              {Object.entries(VERDICT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Responsável
            <input
              className="h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground"
              value={reviewer}
              onChange={(event) => setReviewer(event.target.value)}
            />
          </label>
        </div>
        <label className="block space-y-1 text-xs text-muted-foreground">
          Parecer sobre o texto da solução
          <textarea
            className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground"
            value={solutionReview}
            onChange={(event) => setSolutionReview(event.target.value)}
          />
        </label>
        <label className="block space-y-1 text-xs text-muted-foreground">
          Correções solicitadas (uma por linha)
          <textarea
            className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground"
            value={corrections}
            onChange={(event) => setCorrections(event.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={saving}
          onClick={() =>
            void onSave(record, {
              status,
              verdict,
              solutionReview,
              reviewer,
              corrections: corrections.split("\n").map((item) => item.trim()).filter(Boolean),
            })
          }
          className={cn(actionBtnBase, actionBtn.save)}
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Salvar registro
        </button>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Linha do tempo
        </p>
        <ol className="space-y-3 border-l border-border pl-4">
          {[...record.history].reverse().map((entry, index) => (
            <li key={`${entry.at}-${entry.action}-${index}`} className="relative text-xs">
              <span className="absolute left-[-1.22rem] top-1 size-2 rounded-full bg-primary" />
              <p className="font-medium text-foreground">{entry.detail ?? entry.action}</p>
              <p className="mt-0.5 text-muted-foreground">
                {formatDate(entry.at)} · {entry.actor}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export function KbCurationPage({ project }: { project: ProjectSlug }) {
  const toast = useToast();
  const [records, setRecords] = useState<KbCurationRecord[]>([]);
  const [metrics, setMetrics] = useState<KbCurationMetrics>(EMPTY_METRICS);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [savingPr, setSavingPr] = useState<number | null>(null);
  const [expandedPr, setExpandedPr] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"todas" | KbCurationStatus>("todas");
  const [verdictFilter, setVerdictFilter] = useState<"todos" | KbCurationVerdict>("todos");
  const [reportStatus, setReportStatus] = useState<"todas" | KbCurationStatus>("todas");
  const [search, setSearch] = useState("");

  function reload(opts?: { quiet?: boolean }) {
    if (!opts?.quiet) setLoading(true);
    api
      .listKbCuration(project)
      .then((response) => {
        setRecords(response.pullRequests);
        setMetrics(response.metrics);
      })
      .catch((error) => toast.error(toastErrorMessage(error, "Erro ao carregar Curadoria KB")))
      .finally(() => {
        if (!opts?.quiet) setLoading(false);
      });
  }

  useEffect(() => {
    reload();
  }, [project]);

  // SSE: atualiza a lista quando webhook/sync/review grava o catálogo.
  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    let attempt = 0;

    async function loop() {
      while (!cancelled) {
        try {
          await listenKbCurationStream(
            project,
            () => {
              reload({ quiet: true });
            },
            ac.signal,
          );
          attempt = 0;
        } catch (error) {
          if (cancelled || ac.signal.aborted) break;
          const delay = Math.min(15_000, 1_500 * 2 ** Math.min(attempt, 3));
          attempt += 1;
          console.warn(
            "[kb-curation-sse] reconectando em",
            delay,
            "ms",
            error instanceof Error ? error.message : error,
          );
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    void loop();

    function onVisible() {
      if (document.visibilityState === "visible") reload({ quiet: true });
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      ac.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [project]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((record) => {
      if (statusFilter !== "todas" && record.status !== statusFilter) return false;
      if (verdictFilter !== "todos" && record.verdict !== verdictFilter) return false;
      if (!term) return true;
      return (
        String(record.prNumber).includes(term) ||
        record.title.toLowerCase().includes(term) ||
        record.summary?.toLowerCase().includes(term)
      );
    });
  }, [records, search, statusFilter, verdictFilter]);

  const reportRecords = useMemo(
    () => records.filter((record) => matchesReportStatus(record, reportStatus)),
    [records, reportStatus],
  );

  async function syncGithub() {
    setSyncing(true);
    try {
      const response = await api.syncKbCuration(project);
      setRecords(response.pullRequests);
      setMetrics(response.metrics);
      const parts = [
        `${response.synced} sincronizado(s)`,
        response.imported > 0 ? `${response.imported} importada(s)` : null,
        response.authorResponses > 0
          ? `${response.authorResponses} resposta(s) do autor`
          : null,
      ].filter(Boolean);
      toast.success(parts.join(" · "));
    } catch (error) {
      toast.error(toastErrorMessage(error, "Falha ao sincronizar GitHub"));
    } finally {
      setSyncing(false);
    }
  }

  function exportHtmlReport() {
    const emittedAt = new Date();
    const reportMetrics =
      reportStatus === "todas"
        ? metrics
        : computeKbCurationReportMetrics(reportRecords);
    const html = buildKbCurationHtmlReport(reportRecords, reportMetrics, {
      repository: "polygonus-br/polygonus-suporte-kb",
      author: "Pedro Medeiros (QA)",
      generatedAt: emittedAt.toISOString(),
      scopeLabel:
        reportStatus === "todas"
          ? "Todas as situações"
          : STATUS_LABELS[reportStatus],
    });
    downloadHtmlReport(html, kbCurationReportFilename(emittedAt));
    toast.success(
      `Relatório HTML baixado · ${reportRecords.length} PR(s) incluídas.`,
    );
  }

  async function saveRecord(
    record: KbCurationRecord,
    update: Parameters<typeof api.updateKbCuration>[2],
  ) {
    setSavingPr(record.prNumber);
    try {
      const response = await api.updateKbCuration(project, record.prNumber, update);
      setRecords((current) =>
        current.map((item) =>
          item.prNumber === record.prNumber ? response.pullRequest : item,
        ),
      );
      setMetrics(response.metrics);
      toast.success(`PR #${record.prNumber} atualizado.`);
    } catch (error) {
      toast.error(toastErrorMessage(error, "Erro ao salvar registro"));
    } finally {
      setSavingPr(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Registro de quando, como e por quem cada solução da base de conhecimento foi revisada.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Repositório: <code>polygonus-br/polygonus-suporte-kb</code>
          </p>
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:min-w-80">
          <select
            aria-label="Situação do relatório"
            className="h-9 rounded-md border border-gray-700 bg-transparent px-3 text-sm text-gray-200"
            value={reportStatus}
            onChange={(event) =>
              setReportStatus(event.target.value as "todas" | KbCurationStatus)
            }
            title="Define quais situações serão incluídas no relatório"
          >
            <option value="todas">Relatório: todas</option>
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                Relatório: {STATUS_LABELS[value]}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={loading || reportRecords.length === 0}
            onClick={exportHtmlReport}
            className={cn(
              actionBtnBase,
              "border border-red-500/50 bg-transparent text-red-400 hover:bg-red-500/10 disabled:opacity-50",
            )}
            title="Baixar relatório HTML com as PRs da situação selecionada"
          >
            <Download className="size-4" />
            Relatório HTML ({reportRecords.length})
          </button>
          <button
            type="button"
            disabled={syncing}
            onClick={() => void syncGithub()}
            className="rounded-md p-2 text-gray-500 transition-colors hover:text-green-400 disabled:opacity-50"
            title="Catch-up manual. Com GITHUB_WEBHOOK_SECRET, reviews/merges atualizam sozinhos."
            aria-label="Sincronizar GitHub"
          >
            {syncing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
          </button>
        </div>
      </div>

      <div className="animate-fade-in-up-soft grid gap-3 opacity-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-8">
        <MetricCard
          label="Escopo"
          value={metrics.total}
          hint="Soma das abas"
          emphasis
        />
        <MetricCard
          label="Aguardando revisão"
          value={metrics.awaitingReview}
          hint="Ainda sem review"
        />
        <MetricCard
          label="Correções"
          value={metrics.awaitingCorrection}
          hint="Review enviada"
          tone="warning"
        />
        <MetricCard
          label="Re-revisar"
          value={metrics.awaitingRereview}
          hint="Autor respondeu"
          tone="attention"
        />
        <MetricCard
          label="Aprovados"
          value={metrics.approved}
          hint="Prontos para merge"
          tone="success"
        />
        <MetricCard
          label="Mesclados"
          value={metrics.merged}
          hint="Entraram no master"
          tone="success"
        />
        <MetricCard
          label="Bloqueadas"
          value={metrics.blocked}
          hint="Trava de curadoria"
          tone="danger"
        />
        <MetricCard
          label="Fechadas"
          value={metrics.closedUnmerged}
          hint="GitHub closed sem merge"
        />
      </div>

      {metrics.awaitingRereview > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-3 text-sm text-orange-100">
          <p>
            <span className="font-semibold tabular-nums">{metrics.awaitingRereview}</span>{" "}
            PR{metrics.awaitingRereview === 1 ? "" : "s"} com resposta do autor — vale re-revisar.
          </p>
          <button
            type="button"
            className="rounded-md border border-orange-400/40 bg-orange-500/20 px-3 py-1.5 text-xs font-medium text-orange-100 hover:bg-orange-500/30"
            onClick={() => setStatusFilter("aguardando_rerevisao")}
          >
            Filtrar re-revisão
          </button>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Progresso (aprovados + mesclados)</span>
          <span className="tabular-nums font-medium text-foreground">
            {metrics.completionPercent}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${metrics.completionPercent}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 rounded-xl border bg-card p-3">
        <label className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <input
            className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm"
            placeholder="Buscar por PR, título ou parecer"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm text-foreground"
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as "todas" | KbCurationStatus)
          }
        >
          <option value="todas">Todos os status</option>
          {STATUS_OPTIONS.map((value) => (
            <option key={value} value={value}>{STATUS_LABELS[value]}</option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm text-foreground"
          value={verdictFilter}
          onChange={(event) =>
            setVerdictFilter(event.target.value as "todos" | KbCurationVerdict)
          }
        >
          <option value="todos">Todos os vereditos</option>
          {Object.entries(VERDICT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando curadoria…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-230 text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">PR</th>
                  <th className="px-4 py-3">Solução revisada</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Responsável</th>
                  <th className="px-4 py-3">Última atividade</th>
                  <th className="px-4 py-3 text-right">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((record) => (
                  <Fragment key={record.id}>
                    <tr className="border-t border-border transition-colors hover:bg-[#1a1a1a]">
                      <td className="px-4 py-3 align-middle">
                        <a
                          href={record.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-medium tabular-nums text-primary hover:underline"
                        >
                          #{record.prNumber} <ExternalLink className="size-3" />
                        </a>
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          {record.githubState === "merged" ? (
                            <GitMerge className="size-3 text-emerald-400" />
                          ) : (
                            <GitPullRequest className="size-3" />
                          )}
                          {record.githubState}
                        </p>
                      </td>
                      <td className="max-w-xl px-4 py-3 align-middle">
                        <p className="font-medium">{record.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {record.solutionReview ?? record.summary}
                        </p>
                        {(record.corrections?.length ?? 0) > 0 && (
                          <p className="mt-1 flex items-center gap-1 text-xs tabular-nums text-amber-300">
                            <AlertTriangle className="size-3" />
                            {record.corrections!.length} correção(ões)
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <span
                          className={cn(
                            "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5",
                            badgeClass(record.status),
                          )}
                        >
                          {STATUS_LABELS[record.status]}
                        </span>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {VERDICT_LABELS[record.verdict]}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-middle">{record.reviewer ?? "—"}</td>
                      <td className="px-4 py-3 align-middle text-xs tabular-nums text-muted-foreground">
                        {formatDate(
                          record.history.at(-1)?.at ??
                            record.reviewedAt ??
                            record.lastSyncedAt,
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedPr((current) =>
                              current === record.prNumber ? null : record.prNumber,
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          Abrir
                          <ChevronDown
                            className={cn(
                              "size-3.5 transition-transform",
                              expandedPr === record.prNumber && "rotate-180",
                            )}
                          />
                        </button>
                      </td>
                    </tr>
                    {expandedPr === record.prNumber && (
                      <tr key={`${record.id}-details`} className="border-t border-border">
                        <td colSpan={6} className="p-0">
                          <RecordEditor
                            record={record}
                            saving={savingPr === record.prNumber}
                            onSave={saveRecord}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-muted-foreground">
                      <span className="animate-fade-in-up-soft inline-block opacity-0">
                        Nenhum PR encontrado com estes filtros.
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CheckCircle2 className="size-4 text-emerald-400" />
        Cada alteração salva responsável, data, ação e detalhe na linha do tempo.
      </div>
    </div>
  );
}
