import { useEffect, useState } from "react";
import { Activity, FileCode2, Target } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ProjectSlug, TestRecord } from "@/types/test-record";
import {
  TEST_LEVEL_LABELS,
  TEST_TYPE_LABELS,
  type HistoricoExecucoes,
  type ScriptDoCaso,
} from "@/types/ficha";

const META = "rounded-md border bg-[#1a1a1a] px-2 py-0.5 text-[0.6875rem] font-medium";

function duracao(ms: number | null) {
  if (ms == null) return "—";
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s`;
}

function Kpi({ rotulo, valor, tom }: { rotulo: string; valor: string; tom?: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
      <p className="text-[0.6875rem] uppercase tracking-wider text-gray-400">{rotulo}</p>
      <p className={cn("text-base font-semibold tabular-nums", tom)}>{valor}</p>
    </div>
  );
}

/** Ficha do caso de teste (leitura): objetivo, classificação, histórico e script. */
export function FichaCasoTeste({ project, test }: { project: ProjectSlug; test: TestRecord }) {
  const [historico, setHistorico] = useState<HistoricoExecucoes | null>(null);
  const [scripts, setScripts] = useState<ScriptDoCaso[]>([]);

  useEffect(() => {
    let vivo = true;
    api.getTestRuns(project, test.id).then((h) => vivo && setHistorico(h)).catch(() => undefined);
    api.getTestScripts(project, test.id).then((s) => vivo && setScripts(s.scripts)).catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [project, test.id]);

  const automatizado = test.executionMode === "automated" || Boolean(test.automation?.playwright?.specPath);
  const aprovacao = historico?.aprovacao;

  return (
    <section aria-label="Ficha do caso de teste" className="space-y-4 rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-center gap-2">
        {test.testType && <span className={cn(META, "border-sky-400/20 text-sky-300")}>{TEST_TYPE_LABELS[test.testType]}</span>}
        {test.testLevel && <span className={cn(META, "border-violet-400/20 text-violet-300")}>{TEST_LEVEL_LABELS[test.testLevel]}</span>}
        <span className={cn(META, automatizado ? "border-emerald-400/20 text-emerald-300" : "border-gray-400/20 text-gray-300")}>
          {automatizado ? "Automatizado" : "Manual"}
        </span>
        {historico?.instavel && <span className={cn(META, "border-amber-400/20 text-amber-300")}>Instável</span>}
      </div>

      {test.objective && (
        <p className="flex items-start gap-2 text-sm text-foreground">
          <Target className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            <span className="font-medium">Objetivo:</span> {test.objective}
          </span>
        </p>
      )}

      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Activity className="size-4 text-muted-foreground" aria-hidden />
          Histórico de execução
        </p>
        {!historico || historico.total === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma execução registrada ainda.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Kpi rotulo="Execuções" valor={String(historico.total)} />
              <Kpi
                rotulo="Aprovação"
                valor={aprovacao == null ? "—" : `${aprovacao}%`}
                tom={aprovacao == null ? undefined : aprovacao >= 90 ? "text-emerald-400" : aprovacao >= 70 ? "text-amber-300" : "text-red-400"}
              />
              <Kpi rotulo="Duração média" valor={duracao(historico.duracaoMediaMs)} />
              <Kpi rotulo="Última versão" valor={historico.execucoes[0]?.appVersion ?? "—"} />
            </div>
            <ul className="space-y-1">
              {historico.execucoes.slice(0, 10).map((e) => (
                <li key={e.runId} className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 font-semibold",
                      e.status === "success" ? "bg-emerald-600 text-white" : e.status === "failed" ? "bg-red-600 text-white" : "bg-gray-700 text-gray-200",
                    )}
                  >
                    {e.status === "success" ? "Passou" : e.status === "failed" ? "Falhou" : "Cancelado"}
                  </span>
                  <span className="tabular-nums">
                    {new Date(e.startedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                  <span className="tabular-nums">{duracao(e.duracaoMs)}</span>
                  {e.appVersion && <span className="tabular-nums">v{e.appVersion}</span>}
                  {e.fonte && <span>{e.fonte === "playwright-cli" ? "Playwright (CLI)" : e.fonte}</span>}
                  {e.erro && <span className="basis-full truncate text-red-300/80">{e.erro}</span>}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {scripts.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <FileCode2 className="size-4 text-muted-foreground" aria-hidden />
            Script de automação
          </p>
          {scripts.map((s) => (
            <details key={`${s.tipo}-${s.caminho}`} className="rounded-md border border-border">
              <summary className="cursor-pointer px-3 py-2 text-xs text-muted-foreground">
                {s.tipo === "maestro" ? "Maestro (mobile)" : "Playwright (web)"} · {s.caminho}
                {s.trecho && " · trecho, sem dados internos"}
              </summary>
              <pre className="max-h-96 overflow-auto border-t border-border bg-muted/20 p-3 text-xs leading-relaxed scrollbar-thin">
                <code>{s.conteudo}</code>
              </pre>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
