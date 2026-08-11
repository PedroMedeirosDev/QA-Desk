import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Construction,
  FolderOpen,
  LayoutDashboard,
  Sparkles,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { DailySummaryPanel } from "@/components/DailySummaryPanel";
import { api } from "@/lib/api";
import { useActiveProject } from "@/lib/active-project";
import { cn } from "@/lib/utils";
import {
  CHANNEL_LABELS,
  displayStatus,
  formatRecordId,
  inferChannel,
  type ProjectSlug,
  type TestRecord,
} from "@/types/test-record";

/**
 * Portfólio visitante: se ainda não há cases/métricas liberados, mostra aviso
 * de perfil ativo em preparação. Com conteúdo, lista o que está marcado.
 */
export function VisitorPortfolioPage() {
  const { project, activeProject } = useActiveProject();
  const slug = (activeProject ?? project?.slug) as ProjectSlug | undefined;
  const [reports, setReports] = useState<TestRecord[]>([]);
  const [portfolioCardCount, setPortfolioCardCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setReports([]);
      setPortfolioCardCount(0);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.listTests(slug).catch(() => ({ reports: [] as TestRecord[] })),
      api.listPortfolioDailySummaries(slug).catch(() => ({ cards: [] })),
    ])
      .then(([catalog, portfolio]) => {
        if (cancelled) return;
        setReports(catalog.reports);
        setPortfolioCardCount(portfolio.cards.length);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const hasPublicContent = reports.length > 0 || portfolioCardCount > 0;

  if (loading) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Carregando portfólio…
      </p>
    );
  }

  if (!hasPublicContent) {
    return (
      <div className="relative flex min-h-[min(28rem,70dvh)] flex-col items-center justify-center px-4 py-10 text-center">
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-40"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 60% 45% at 50% 35%, color-mix(in srgb, var(--primary) 12%, transparent), transparent 70%)",
          }}
        />

        <div className="animate-fade-in-up flex max-w-md flex-col items-center gap-5 opacity-0">
          <BrandLogo size="lg" className="text-foreground" />

          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--project-highlight-border)] bg-[var(--project-highlight-bg)] px-3 py-1 text-xs font-medium text-[var(--project-highlight-text)]">
            <Construction className="size-3.5 shrink-0" strokeWidth={2} />
            Perfil ativo · portfólio em preparação
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Bem-vindo ao QA Desk
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
              Seu acesso de visitante já está liberado. Em breve aparecerão aqui
              cases e métricas marcados para o portfólio público — por enquanto
              ainda não há conteúdo publicado.
            </p>
          </div>

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground/80">
            <Sparkles className="size-3.5 shrink-0 text-primary/80" strokeWidth={2} />
            Obrigado pela visita — volte em breve.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <LayoutDashboard className="size-4 text-primary" />
            Portfólio QA
          </p>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Atividade diária liberada e seleção pública de cases — sem dados
            operacionais ou PII.
          </p>
        </div>
        <BrandLogo size="sm" className="text-foreground opacity-80" />
      </div>

      {slug && portfolioCardCount > 0 && <DailySummaryPanel project={slug} />}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <FolderOpen className="size-4 text-primary" />
          <div>
            <p className="text-sm font-medium">Cases públicos</p>
            <p className="text-xs text-muted-foreground">
              Itens marcados para portfólio neste projeto
            </p>
          </div>
        </div>

        {reports.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
            Ainda não há cases públicos — só métricas diárias liberadas.
          </p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {reports.map((r) => {
              const open = openId === r.id;
              const st = displayStatus(r);
              const ch = inferChannel(r);
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                    onClick={() => setOpenId(open ? null : r.id)}
                    aria-expanded={open}
                  >
                    {open ? (
                      <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {r.title || formatRecordId(r.id, r)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatRecordId(r.id, r)}
                        {ch ? ` · ${CHANNEL_LABELS[ch]}` : ""}
                        {r.module ? ` · ${r.module}` : ""}
                        {r.platform ? ` · ${r.platform}` : ""}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-md border px-2 py-0.5 text-[0.65rem] font-medium",
                        st.tone === "ok" &&
                          "border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
                        st.tone === "fail" &&
                          "border-red-500/30 text-red-600 dark:text-red-400",
                        st.tone === "warn" &&
                          "border-amber-500/30 text-amber-700 dark:text-amber-300",
                        st.tone === "neutral" &&
                          "border-border text-muted-foreground",
                      )}
                    >
                      {st.label}
                    </span>
                  </button>
                  {open && (
                    <div className="space-y-3 border-t bg-muted/20 px-4 py-3 text-sm">
                      {r.preconditions?.trim() && (
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Pré-condições
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-foreground/90">
                            {r.preconditions}
                          </p>
                        </div>
                      )}
                      {(r.steps?.filter(Boolean).length ?? 0) > 0 && (
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Passos
                          </p>
                          <ol className="mt-1 list-decimal space-y-1 pl-4 text-foreground/90">
                            {r.steps.filter(Boolean).map((step, i) => (
                              <li key={i}>{step}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                      {r.expectedResult?.trim() && (
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Esperado
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-foreground/90">
                            {r.expectedResult}
                          </p>
                        </div>
                      )}
                      {(r.evidence?.length ?? 0) > 0 && (
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Evidência
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {r.evidence!.map((ev) => (
                              <a
                                key={ev.fileId}
                                href={api.evidenceUrl(ev.storageKey)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block overflow-hidden rounded-md border"
                              >
                                {ev.type === "video" ? (
                                  <span className="flex h-20 w-28 items-center justify-center bg-muted text-xs text-muted-foreground">
                                    Vídeo
                                  </span>
                                ) : (
                                  <img
                                    src={api.evidenceUrl(ev.storageKey)}
                                    alt={ev.filename}
                                    className="h-20 w-auto object-cover"
                                  />
                                )}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      {!r.preconditions?.trim() &&
                        !(r.steps?.filter(Boolean).length) &&
                        !r.expectedResult?.trim() &&
                        !(r.evidence?.length) && (
                          <p className="text-xs text-muted-foreground">
                            Sem detalhe público adicional neste case.
                          </p>
                        )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
