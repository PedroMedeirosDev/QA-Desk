import { type ReactNode, useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { LinkedTestPanel } from "@/components/BugTraceability";
import { ambienteView } from "@/lib/bug-report-markdown";
import { cn } from "@/lib/utils";
import type { ProjectSlug, TestRecord } from "@/types/test-record";
import {
  PRIORITY_LABELS,
  REPRODUCIBILITY_LABELS,
  SEVERITY_LABELS,
  displayStatus,
  formatRecordId,
  isGestorReplyUnread,
  linkedTestIdOf,
} from "@/types/test-record";

const CHIP = "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[0.7rem] font-medium";

const SEVERITY_TONE: Record<NonNullable<TestRecord["severity"]>, string> = {
  critica: "border-red-500/40 bg-red-500/15 text-red-300",
  alta: "border-orange-500/40 bg-orange-500/15 text-orange-300",
  media: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  baixa: "border-border bg-muted text-muted-foreground",
};

const STATUS_TONE = {
  ok: "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
  warn: "border-amber-500/40 bg-amber-500/15 text-amber-300",
  fail: "border-red-500/40 bg-red-500/15 text-red-300",
  neutral: "border-border bg-muted text-muted-foreground",
} as const;

function fmtData(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("pt-BR");
}

function passosDe(bug: TestRecord): string[] {
  const detalhados = (bug.stepsDetailed ?? []).map((s) => s.text?.trim()).filter(Boolean) as string[];
  if (detalhados.length) return detalhados;
  return (bug.steps ?? []).map((s) => s.trim()).filter(Boolean);
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h4 className="text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">{titulo}</h4>
      {children}
    </section>
  );
}

/**
 * Bug v2 (docs/BUG_V2.md): três linhas — identificação, impacto/status,
 * rastreabilidade/ambiente — e, ao expandir, as seções na ordem do handoff GitHub.
 */
export function BugCard({
  project,
  bug,
  testTitles,
  onOpen,
}: {
  project: ProjectSlug;
  bug: TestRecord;
  /** id do caso de teste → código exibido (ex.: CT-MURAL-03). */
  testTitles: Map<string, string>;
  onOpen: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const { label, tone } = displayStatus(bug);
  const testeId = linkedTestIdOf(bug);
  const testeCodigo = testeId ? (testTitles.get(testeId) ?? formatRecordId(testeId)) : null;
  const execucao = fmtData(bug.linkedRunAt);
  const amb = ambienteView(bug);
  const ambienteResumo = [amb.headline, bug.build?.trim() && `versão ${bug.build.trim()}`]
    .filter(Boolean)
    .join(" · ");
  const prioridade = bug.priority ?? bug.severity;
  const passos = passosDe(bug);
  const historico = [...(bug.history ?? [])].slice(-5).reverse();

  const rastreio = [
    testeCodigo ? `Falhou no ${testeCodigo}` : "Encontrado em exploração",
    execucao ? `execução ${execucao}` : null,
    ambienteResumo || null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="leading-snug">
            <span className="mr-2 font-mono text-xs text-muted-foreground">{formatRecordId(bug.id, bug)}</span>
            <span className="font-medium">{bug.title}</span>
            {isGestorReplyUnread(bug) ? (
              <span className="ml-2 text-[0.65rem] font-medium text-amber-300">Resposta não lida</span>
            ) : null}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {bug.severity ? (
              <span className={cn(CHIP, SEVERITY_TONE[bug.severity])}>
                Severidade {SEVERITY_LABELS[bug.severity].toLowerCase()}
              </span>
            ) : null}
            {prioridade ? (
              <span className={cn(CHIP, "border-border bg-[#1a1a1a] text-muted-foreground")}>
                Prioridade {PRIORITY_LABELS[prioridade].toLowerCase()}
              </span>
            ) : null}
            <span className={cn(CHIP, STATUS_TONE[tone])}>{label}</span>
          </div>
          <p className="text-xs text-muted-foreground">{rastreio}</p>
        </div>
        <ChevronDown
          className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition-transform", aberto && "rotate-180")}
          aria-hidden
        />
      </button>

      {aberto ? (
        <div className="space-y-5 border-t border-border/60 px-4 py-4 text-sm">
          {bug.description?.trim() ? (
            <Secao titulo="Sintoma">
              <p className="whitespace-pre-wrap">{bug.description.trim()}</p>
            </Secao>
          ) : null}

          {bug.expectedResult?.trim() || bug.actualResult?.trim() ? (
            <Secao titulo="Esperado × Obtido">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <p className="mb-1 text-[0.7rem] text-emerald-400">Esperado</p>
                  <p className="whitespace-pre-wrap">{bug.expectedResult?.trim() || "—"}</p>
                </div>
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                  <p className="mb-1 text-[0.7rem] text-red-300">Obtido</p>
                  <p className="whitespace-pre-wrap">{bug.actualResult?.trim() || "—"}</p>
                </div>
              </div>
            </Secao>
          ) : null}

          {bug.preconditions?.trim() || passos.length || bug.reproducibility ? (
            <Secao titulo="Reproduzir">
              {bug.preconditions?.trim() ? (
                <p className="text-muted-foreground">
                  <span className="text-foreground">Pré-condições:</span> {bug.preconditions.trim()}
                </p>
              ) : null}
              {passos.length ? (
                <ol className="list-decimal space-y-0.5 pl-5">
                  {passos.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ol>
              ) : null}
              {bug.reproducibility ? (
                <p className="text-xs text-muted-foreground">
                  Reprodutibilidade: {REPRODUCIBILITY_LABELS[bug.reproducibility]}
                </p>
              ) : null}
            </Secao>
          ) : null}

          {bug.evidence?.length ? (
            <Secao titulo="Evidências">
              <p className="text-muted-foreground">
                {bug.evidence.length} arquivo(s): {bug.evidence.map((e) => e.filename).join(", ")}
              </p>
            </Secao>
          ) : null}

          {amb.fields.length || amb.headline ? (
            <Secao titulo="Ambiente">
              <p className="text-muted-foreground">
                {[amb.headline, ...amb.fields.map((f) => `${f.label}: ${f.value}`)].filter(Boolean).join(" · ")}
              </p>
            </Secao>
          ) : null}

          {testeId ? <LinkedTestPanel project={project} bug={bug} /> : null}

          {historico.length ? (
            <Secao titulo="Histórico">
              <ul className="space-y-1 text-xs text-muted-foreground">
                {historico.map((h, i) => (
                  <li key={i}>
                    <span className="tabular-nums">{fmtData(h.at)}</span> · {h.detail || h.action}
                  </li>
                ))}
              </ul>
            </Secao>
          ) : null}

          <button
            type="button"
            onClick={onOpen}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <ExternalLink className="size-3.5" />
            Abrir bug completo
          </button>
        </div>
      ) : null}
    </li>
  );
}
