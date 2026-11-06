import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ProjectSlug } from "@/types/test-record";
import type { MetricasQa } from "@/types/metricas";

const PERIODOS = [7, 30, 90] as const;
const SEVERIDADES = [
  ["critica", "Crítica", "text-red-400"],
  ["alta", "Alta", "text-orange-300"],
  ["media", "Média", "text-amber-300"],
  ["baixa", "Baixa", "text-gray-300"],
] as const;

function duracao(ms: number | null) {
  if (ms == null) return "—";
  const min = Math.round(ms / 60000);
  if (min >= 60) return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
  return min >= 1 ? `${min} min` : `${Math.round(ms / 1000)}s`;
}

function Kpi({ rotulo, valor, detalhe, tom }: { rotulo: string; valor: string; detalhe?: string; tom?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-[0.75rem] uppercase tracking-wider text-gray-400">{rotulo}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", tom)}>{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-muted-foreground tabular-nums">{detalhe}</p>}
    </div>
  );
}

/** Métricas de QA (admin e portfólio): só números agregados. */
export function MetricasPanel({ project }: { project: ProjectSlug }) {
  const [dias, setDias] = useState<(typeof PERIODOS)[number]>(30);
  const [m, setM] = useState<MetricasQa | null>(null);

  useEffect(() => {
    let vivo = true;
    api.getMetricas(project, dias).then((r) => vivo && setM(r)).catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [project, dias]);

  if (!m) return null;
  const aprov = m.execucoes.aprovacao;

  return (
    <section aria-label="Métricas de QA" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <BarChart3 className="size-4 text-primary" aria-hidden />
          Métricas de QA
        </p>
        <div className="flex gap-1" role="group" aria-label="Período">
          {PERIODOS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setDias(p)}
              aria-pressed={dias === p}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs tabular-nums transition-colors",
                dias === p ? "border-white/40 bg-white/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {p} dias
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          rotulo="Casos automatizados"
          valor={m.casos.pctAutomatizado == null ? "—" : `${m.casos.pctAutomatizado}%`}
          detalhe={`${m.casos.automatizados} de ${m.casos.total} casos`}
        />
        <Kpi
          rotulo="Aprovação das execuções"
          valor={aprov == null ? "—" : `${aprov}%`}
          detalhe={`${m.execucoes.total} execuções no período`}
          tom={aprov == null ? undefined : aprov >= 90 ? "text-emerald-400" : aprov >= 70 ? "text-amber-300" : "text-red-400"}
        />
        <Kpi
          rotulo="Testes instáveis"
          valor={String(m.execucoes.instaveis)}
          detalhe="alternaram passou e falhou"
          tom={m.execucoes.instaveis > 0 ? "text-amber-300" : "text-emerald-400"}
        />
        <Kpi
          rotulo="Tempo automatizado"
          valor={duracao(m.execucoes.duracaoTotalMs)}
          detalhe={`média por teste: ${duracao(m.execucoes.duracaoMediaMs)}`}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-[0.75rem] uppercase tracking-wider text-gray-400">Bugs</p>
          <p className="mt-1 text-sm tabular-nums text-foreground">
            {m.bugs.total} registrados · {m.bugs.abertos} abertos
            {m.bugs.diasMedioAteHomologar != null && ` · ${m.bugs.diasMedioAteHomologar} dias até homologar a correção`}
          </p>
          <ul className="mt-3 flex flex-wrap gap-3 text-sm">
            {SEVERIDADES.map(([k, rotulo, tom]) => (
              <li key={k} className="tabular-nums">
                <span className={cn("font-semibold", tom)}>{m.bugs.porSeveridade[k]}</span>{" "}
                <span className="text-muted-foreground">{rotulo}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground tabular-nums">
            Origem: {m.bugs.porOrigem.automacao} pela automação · {m.bugs.porOrigem.manual} por teste manual ou suporte
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 lg:col-span-2">
          <p className="text-[0.75rem] uppercase tracking-wider text-gray-400">Trabalho com clientes e time</p>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Prometido × entregue no prazo</dt>
              <dd className="tabular-nums text-foreground">
                {m.trabalho.entreguesNoPrazo}/{m.trabalho.prometidas}
                {m.trabalho.atrasoMedioDias != null && (
                  <span className="text-amber-300"> · atraso médio {m.trabalho.atrasoMedioDias} dias</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Reuniões com cliente</dt>
              <dd className="tabular-nums text-foreground">
                {m.trabalho.reunioes} registradas · {m.trabalho.diasPorIntencao.reuniao_cliente} dias
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Orientação ao N1 · Suporte N2</dt>
              <dd className="tabular-nums text-foreground">
                {m.trabalho.diasPorIntencao.orientacao_n1} dias · {m.trabalho.diasPorIntencao.suporte_n2} dias
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Sugestões de melhoria</dt>
              <dd className="tabular-nums text-foreground">
                {m.trabalho.sugestoes.total} enviadas · {m.trabalho.sugestoes.comRetorno} com retorno ·{" "}
                {m.trabalho.sugestoes.implementadas} implementadas
              </dd>
            </div>
          </dl>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-[0.75rem] uppercase tracking-wider text-gray-400">Cobertura por módulo</p>
          <ul className="mt-3 space-y-2">
            {m.porModulo.map((mod) => {
              const pct = mod.total ? Math.round((mod.automatizados / mod.total) * 100) : 0;
              return (
                <li key={mod.modulo} className="text-xs">
                  <div className="flex justify-between gap-2 tabular-nums">
                    <span className="truncate text-foreground">{mod.modulo}</span>
                    <span className="text-muted-foreground">
                      {mod.automatizados}/{mod.total} automatizados
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
