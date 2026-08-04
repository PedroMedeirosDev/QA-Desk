import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Eye, EyeOff, RefreshCw } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { DatePicker } from "@/components/DatePicker";
import { PremiumTooltip } from "@/components/PremiumTooltip";
import { api } from "@/lib/api";
import { actionBtn, actionBtnBase } from "@/lib/button-styles";
import { toastErrorMessage, useToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  DAILY_INTENT_LABELS,
  DAILY_INTENTS,
  type DailyIntent,
  type DailyPortfolioCard,
  type DailySummary,
} from "@/types/daily-summary";
import type { ProjectSlug } from "@/types/test-record";

function todaySaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatDayLabel(dateYmd: string): string {
  const [y, m, d] = dateYmd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function IntentChips({
  intents,
  editable,
  selected,
  onToggle,
}: {
  intents: DailyIntent[];
  editable?: boolean;
  selected?: DailyIntent[];
  onToggle?: (intent: DailyIntent) => void;
}) {
  const list = editable ? DAILY_INTENTS : intents;
  if (list.length === 0) {
    return <p className="text-xs text-muted-foreground">Sem intenção marcada</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((intent) => {
        const active = editable ? selected?.includes(intent) : true;
        if (!editable && !intents.includes(intent)) return null;
        return (
          <button
            key={intent}
            type="button"
            disabled={!editable}
            onClick={() => onToggle?.(intent)}
            className={cn(
              "rounded-md border px-2 py-0.5 text-[0.7rem] font-medium transition-colors",
              active
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-border bg-transparent text-muted-foreground",
              editable && "cursor-pointer hover:border-primary/60",
              !editable && "cursor-default",
            )}
          >
            {DAILY_INTENT_LABELS[intent]}
          </button>
        );
      })}
    </div>
  );
}

function MiniStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border bg-background/60 px-3 py-2">
      <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-[0.7rem] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function PortfolioCards({ cards }: { cards: DailyPortfolioCard[] }) {
  if (cards.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum dia liberado no portfolio ainda.
      </p>
    );
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {cards.map((card) => (
        <li key={card.date} className="rounded-lg border bg-background/60 p-3">
          <p className="text-sm font-medium">{formatDayLabel(card.date)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {card.manualTotal} manuais · {card.automatedTotal} automatizados
            {(card.kbReviewed > 0 || card.kbMerged > 0) &&
              ` · KB ${card.kbReviewed} rev. / ${card.kbMerged} merge`}
          </p>
          <div className="mt-2">
            <IntentChips intents={card.intents} />
          </div>
          {card.note && (
            <p className="mt-2 text-xs text-muted-foreground">{card.note}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

export function DailySummaryPanel({ project }: { project: ProjectSlug }) {
  const { isAdmin, isVisitor } = useAuth();
  const toast = useToast();
  const [date, setDate] = useState(todaySaoPaulo);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [portfolioCards, setPortfolioCards] = useState<DailyPortfolioCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [intents, setIntents] = useState<DailyIntent[]>([]);
  const [note, setNote] = useState("");

  const loadPortfolio = useCallback(async () => {
    try {
      const res = await api.listPortfolioDailySummaries(project);
      setPortfolioCards(res.cards);
    } catch {
      setPortfolioCards([]);
    }
  }, [project]);

  const loadDay = useCallback(async () => {
    setLoading(true);
    try {
      if (isVisitor) {
        await loadPortfolio();
        try {
          const s = await api.getDailySummary(project, date);
          setSummary(s);
          setIntents(s.intents);
          setNote(s.note ?? "");
        } catch {
          setSummary(null);
        }
      } else {
        const [s] = await Promise.all([
          api.getDailySummary(project, date),
          loadPortfolio(),
        ]);
        setSummary(s);
        setIntents(s.intents);
        setNote(s.note ?? "");
      }
    } catch (e) {
      toast.error(toastErrorMessage(e, "Erro ao carregar resumo do dia"));
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [project, date, isVisitor, loadPortfolio, toast]);

  useEffect(() => {
    void loadDay();
  }, [loadDay]);

  function toggleIntent(intent: DailyIntent) {
    setIntents((prev) =>
      prev.includes(intent) ? prev.filter((i) => i !== intent) : [...prev, intent],
    );
  }

  async function publish(showInPortfolio: boolean) {
    if (!summary) return;
    setSaving(true);
    try {
      const next = await api.publishDailySummary(project, {
        date,
        showInPortfolio,
        intents,
        note: note.trim() || null,
      });
      setSummary(next);
      setIntents(next.intents);
      setNote(next.note ?? "");
      await loadPortfolio();
      toast.success(
        showInPortfolio
          ? "Dia liberado no portfolio"
          : "Dia ocultado do portfolio",
      );
    } catch (e) {
      toast.error(toastErrorMessage(e, "Falha ao salvar resumo"));
    } finally {
      setSaving(false);
    }
  }

  if (isVisitor) {
    return (
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <CalendarDays className="size-4 text-primary" />
          <div>
            <p className="text-sm font-medium">Atividade diária</p>
            <p className="text-xs text-muted-foreground">
              Resumos liberados no portfolio
            </p>
          </div>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <PortfolioCards cards={portfolioCards} />
        )}
      </section>
    );
  }

  const a = summary?.automated;
  const m = summary?.manual;
  const kb = summary?.kbCuration;
  const kbTotal =
    (kb?.reviewed ?? 0) +
    (kb?.merged ?? 0) +
    (kb?.blocked ?? 0) +
    (kb?.imported ?? 0);
  const toolHintParts: string[] = [];
  if ((a?.byTool.maestro ?? 0) > 0) toolHintParts.push(`${a!.byTool.maestro} Maestro`);
  if ((a?.byTool.playwright ?? 0) > 0) {
    toolHintParts.push(`${a!.byTool.playwright} Playwright`);
  }
  const autoHint = [
    `${a?.passed ?? 0} ok · ${a?.failed ?? 0} falha`,
    ...toolHintParts,
  ].join(" · ");

  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <CalendarDays className="mt-0.5 size-4 text-primary" />
          <div>
            <p className="text-sm font-medium">Resumo do dia</p>
            <p className="text-xs text-muted-foreground">
              Manual × automatizado · intenção — fuso SP
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DatePicker
            value={date}
            max={todaySaoPaulo()}
            onChange={setDate}
          />
          <PremiumTooltip label="Atualizar" side="bottom">
            <button
              type="button"
              onClick={() => void loadDay()}
              className={cn(actionBtnBase, actionBtn.back, "px-2")}
              aria-label="Atualizar"
            >
              <RefreshCw className="size-3.5" />
            </button>
          </PremiumTooltip>
        </div>
      </div>

      {loading || !summary ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {loading ? "Carregando resumo…" : "Sem dados para este dia."}
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <div
            className={cn(
              "grid gap-2 sm:grid-cols-2",
              kbTotal > 0 && "lg:grid-cols-3",
            )}
          >
            <MiniStat
              label="Manuais"
              value={m?.total ?? 0}
              hint={`${m?.passed ?? 0} passou · ${m?.failed ?? 0} falhou`}
            />
            <MiniStat
              label="Automatizados"
              value={a?.total ?? 0}
              hint={autoHint}
            />
            {kbTotal > 0 && (
              <MiniStat
                label="Curadoria KB"
                value={(kb?.reviewed ?? 0) + (kb?.merged ?? 0)}
                hint={`${kb?.reviewed ?? 0} rev. · ${kb?.merged ?? 0} merge`}
              />
            )}
          </div>

          {(summary.homologations.created > 0 ||
            summary.homologations.statusChanges > 0) && (
            <p className="text-xs text-muted-foreground">
              Homologações: {summary.homologations.created} criada(s)
              {summary.homologations.statusChanges > 0
                ? ` · ${summary.homologations.statusChanges} mudança(s) de status`
                : ""}
              {summary.homologations.titles.length > 0
                ? ` · ${summary.homologations.titles.join(", ")}`
                : ""}
            </p>
          )}

          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Intenção do dia
            </p>
            <IntentChips
              intents={intents}
              editable={isAdmin}
              selected={intents}
              onToggle={toggleIntent}
            />
          </div>

          {isAdmin && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Nota (opcional, aparece no portfolio)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={200}
                placeholder="Ex.: smoke pós-release Mural + revisão KB"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
          )}

          {summary.highlights.length > 0 && (
            <details className="rounded-lg border bg-background/40 px-3 py-2">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                Destaques ({summary.highlights.length})
              </summary>
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm">
                {summary.highlights.map((h, i) => (
                  <li
                    key={`${h.kind}-${h.label}-${i}`}
                    className="flex items-baseline justify-between gap-2 border-b border-border/40 py-1 last:border-0"
                  >
                    <span className="min-w-0 truncate">
                      <span className="text-[0.65rem] uppercase text-muted-foreground">
                        {h.kind}
                        {h.tool ? `/${h.tool}` : ""}
                      </span>{" "}
                      {h.label}
                    </span>
                    {h.status && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {h.status}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => void publish(true)}
                className={cn(actionBtnBase, actionBtn.create)}
              >
                <Eye className="size-3.5" />
                Liberar no portfolio
              </button>
              {summary.showInPortfolio && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void publish(false)}
                  className={cn(actionBtnBase, actionBtn.back)}
                >
                  <EyeOff className="size-3.5" />
                  Ocultar do portfolio
                </button>
              )}
              <p className="text-xs text-muted-foreground">
                {summary.showInPortfolio
                  ? "Este dia está visível para visitantes"
                  : "Este dia ainda não está no portfolio"}
              </p>
            </div>
          )}

          {portfolioCards.length > 0 && (
            <details className="border-t pt-3">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                Já no portfolio ({portfolioCards.length})
              </summary>
              <div className="mt-2">
                <PortfolioCards cards={portfolioCards} />
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
