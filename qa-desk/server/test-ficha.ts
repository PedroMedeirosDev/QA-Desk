/**
 * Ficha do caso de teste: histórico de execuções (test_runs) e o script de automação.
 * Visitante recebe só agregados e um trecho sanitizado do script (sem URL, login, ids).
 */
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./automation.js";
import { isDatabaseEnabled } from "./db/config.js";
import { getPrisma } from "./db/prisma.js";
import { redactPii } from "./privacy/redact-pii.js";
import type { ProjectSlug, TestRecord } from "./types.js";

export type ExecucaoResumo = {
  runId: string;
  status: string;
  startedAt: string;
  duracaoMs: number | null;
  appVersion: string | null;
  fonte: string | null;
  erro: string | null;
};

export type HistoricoExecucoes = {
  total: number;
  aprovacao: number | null;
  duracaoMediaMs: number | null;
  /** Alternou passou/falhou nas últimas execuções. */
  instavel: boolean;
  execucoes: ExecucaoResumo[];
};

/** Instável = pelo menos 2 trocas entre sucesso e falha na janela (mais recente primeiro). */
export function calcularHistorico(execucoes: ExecucaoResumo[]): Omit<HistoricoExecucoes, "execucoes"> {
  const validas = execucoes.filter((e) => e.status === "success" || e.status === "failed");
  const total = validas.length;
  const ok = validas.filter((e) => e.status === "success").length;
  const duracoes = validas.map((e) => e.duracaoMs).filter((d): d is number => typeof d === "number");
  let trocas = 0;
  for (let i = 1; i < validas.length; i++) if (validas[i].status !== validas[i - 1].status) trocas++;
  return {
    total,
    aprovacao: total ? Math.round((ok / total) * 100) : null,
    duracaoMediaMs: duracoes.length ? Math.round(duracoes.reduce((a, b) => a + b, 0) / duracoes.length) : null,
    instavel: trocas >= 2,
  };
}

export async function lerHistorico(
  project: ProjectSlug,
  testId: string,
  limite = 20,
  visitante = false,
): Promise<HistoricoExecucoes> {
  if (!isDatabaseEnabled()) return { total: 0, aprovacao: null, duracaoMediaMs: null, instavel: false, execucoes: [] };
  const rows = await getPrisma().testRun.findMany({
    where: { projectSlug: project, testId },
    orderBy: { startedAt: "desc" },
    take: limite,
  });
  const execucoes: ExecucaoResumo[] = rows.map((r) => {
    const meta = (r.meta ?? {}) as Record<string, unknown>;
    const duracao =
      typeof meta.duracaoMs === "number" ? meta.duracaoMs : r.finishedAt.getTime() - r.startedAt.getTime();
    return {
      runId: r.runId,
      status: r.status,
      startedAt: r.startedAt.toISOString(),
      duracaoMs: duracao >= 0 ? duracao : null,
      appVersion: r.appVersion,
      fonte: typeof meta.fonte === "string" ? meta.fonte : "qa-desk",
      // Mensagem de erro pode citar ambiente interno: fora do portfólio.
      erro: visitante ? null : (r.output?.split("\n").find((l) => l.trim()) ?? null),
    };
  });
  return { ...calcularHistorico(execucoes), execucoes };
}

const MAX_LINHAS_VISITANTE = 60;

/** Trecho do script para o portfólio: sem URL, host, login/senha, ids longos nem dados pessoais. */
export function sanitizarScript(fonte: string): string {
  const linhas = fonte.split(/\r?\n/).filter((l) => !/(senha|password|token|secret|apikey|api_key)/i.test(l));
  const limpas = linhas.map((l) => {
    let t = l.replace(/https?:\/\/[^\s"'`)]+/g, "<url>");
    t = t.replace(/\b[a-z0-9-]+\.(?:com|net|org)(?:\.br)?(?::\d+)?\b/gi, "<host>");
    if (/(login|usuario|usuário|user|cpf|matricula|matrícula)/i.test(t)) {
      t = t.replace(/(["'`])(?:(?!\1).)+\1/g, "$1<oculto>$1");
    }
    t = t.replace(/\b\d{5,}\b/g, "<id>");
    return redactPii(t);
  });
  const corte = limpas.slice(0, MAX_LINHAS_VISITANTE);
  if (limpas.length > MAX_LINHAS_VISITANTE) corte.push(`… (${limpas.length - MAX_LINHAS_VISITANTE} linhas omitidas)`);
  return corte.join("\n");
}

export type ScriptDoCaso = { tipo: "maestro" | "playwright"; caminho: string; conteudo: string; trecho: boolean };

/** Lê os scripts ligados ao caso (Maestro e/ou Playwright), dentro do repositório. */
export function lerScripts(teste: TestRecord, visitante: boolean): ScriptDoCaso[] {
  const alvos: Array<{ tipo: "maestro" | "playwright"; rel?: string }> = [
    { tipo: "maestro", rel: teste.automation?.flowPath },
    { tipo: "playwright", rel: teste.automation?.playwright?.specPath },
  ];
  const out: ScriptDoCaso[] = [];
  for (const a of alvos) {
    if (!a.rel) continue;
    const abs = path.resolve(REPO_ROOT, a.rel);
    if (!abs.startsWith(REPO_ROOT + path.sep) || !fs.existsSync(abs)) continue;
    const bruto = fs.readFileSync(abs, "utf8");
    out.push({
      tipo: a.tipo,
      caminho: visitante ? path.basename(a.rel) : a.rel.replace(/\\/g, "/"),
      conteudo: visitante ? sanitizarScript(bruto) : bruto,
      trecho: visitante,
    });
  }
  return out;
}
