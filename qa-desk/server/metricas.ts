/**
 * Métricas de QA do projeto (Dashboard e portfólio). Só números agregados:
 * nada de título, unidade, login ou mensagem de erro — vale para o visitante.
 */
import { isDatabaseEnabled } from "./db/config.js";
import { getPrisma } from "./db/prisma.js";
import type { ProjectSlug, TestRecord } from "./types.js";

export type RunLeve = { testId: string; status: string; startedAt: Date; finishedAt: Date; durMs: number | null };

export type MetricasQa = {
  periodoDias: number;
  casos: { total: number; automatizados: number; pctAutomatizado: number | null };
  porModulo: Array<{ modulo: string; total: number; automatizados: number }>;
  execucoes: {
    total: number;
    aprovacao: number | null;
    instaveis: number;
    duracaoMediaMs: number | null;
    duracaoTotalMs: number;
  };
  bugs: {
    total: number;
    abertos: number;
    porSeveridade: Record<"baixa" | "media" | "alta" | "critica" | "sem", number>;
    porOrigem: { automacao: number; manual: number };
    diasMedioAteHomologar: number | null;
  };
};

const FECHADOS = new Set(["homologado", "cancelado", "sem_correcao"]);

function automatizado(r: TestRecord): boolean {
  return r.executionMode === "automated" || Boolean(r.automation?.flowPath || r.automation?.playwright?.specPath);
}

export function calcularMetricas(reports: TestRecord[], runs: RunLeve[], periodoDias: number): MetricasQa {
  const testes = reports.filter((r) => (r.recordType ?? "teste") === "teste");
  const bugs = reports.filter((r) => r.recordType === "bug");

  const autos = testes.filter(automatizado).length;
  const modulos = new Map<string, { total: number; automatizados: number }>();
  for (const t of testes) {
    const m = (t.module || t.testKey?.split("/")[0] || "sem módulo").trim();
    const acc = modulos.get(m) ?? { total: 0, automatizados: 0 };
    acc.total += 1;
    if (automatizado(t)) acc.automatizados += 1;
    modulos.set(m, acc);
  }

  const validas = runs.filter((r) => r.status === "success" || r.status === "failed");
  const ok = validas.filter((r) => r.status === "success").length;
  const durs = validas.map((r) => r.durMs).filter((d): d is number => typeof d === "number" && d >= 0);
  // Instável: ≥ 2 trocas passou/falhou nas últimas 10 execuções do caso.
  const porTeste = new Map<string, RunLeve[]>();
  for (const r of validas) porTeste.set(r.testId, [...(porTeste.get(r.testId) ?? []), r]);
  let instaveis = 0;
  for (const lista of porTeste.values()) {
    const ult = [...lista].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime()).slice(0, 10);
    let trocas = 0;
    for (let i = 1; i < ult.length; i++) if (ult[i].status !== ult[i - 1].status) trocas++;
    if (trocas >= 2) instaveis++;
  }

  const sev: MetricasQa["bugs"]["porSeveridade"] = { baixa: 0, media: 0, alta: 0, critica: 0, sem: 0 };
  let daAutomacao = 0;
  const diasHomologar: number[] = [];
  for (const b of bugs) {
    sev[b.severity ?? "sem"] += 1;
    if (b.linkedRunId) daAutomacao += 1;
    if (b.status === "homologado" && b.homologatedAt && b.reportedAt) {
      const d = (new Date(b.homologatedAt).getTime() - new Date(b.reportedAt).getTime()) / 86_400_000;
      if (d >= 0) diasHomologar.push(d);
    }
  }

  return {
    periodoDias,
    casos: { total: testes.length, automatizados: autos, pctAutomatizado: testes.length ? Math.round((autos / testes.length) * 100) : null },
    porModulo: [...modulos.entries()]
      .map(([modulo, v]) => ({ modulo, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8),
    execucoes: {
      total: validas.length,
      aprovacao: validas.length ? Math.round((ok / validas.length) * 100) : null,
      instaveis,
      duracaoMediaMs: durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : null,
      duracaoTotalMs: durs.reduce((a, b) => a + b, 0),
    },
    bugs: {
      total: bugs.length,
      abertos: bugs.filter((b) => !FECHADOS.has(b.status)).length,
      porSeveridade: sev,
      porOrigem: { automacao: daAutomacao, manual: bugs.length - daAutomacao },
      diasMedioAteHomologar: diasHomologar.length
        ? Math.round((diasHomologar.reduce((a, b) => a + b, 0) / diasHomologar.length) * 10) / 10
        : null,
    },
  };
}

export async function lerRunsDoPeriodo(project: ProjectSlug, dias: number): Promise<RunLeve[]> {
  if (!isDatabaseEnabled()) return [];
  const desde = new Date(Date.now() - dias * 86_400_000);
  const rows = await getPrisma().testRun.findMany({
    where: { projectSlug: project, startedAt: { gte: desde } },
    select: { testId: true, status: true, startedAt: true, finishedAt: true, meta: true },
  });
  return rows.map((r) => {
    const meta = (r.meta ?? {}) as Record<string, unknown>;
    const dur = typeof meta.duracaoMs === "number" ? meta.duracaoMs : r.finishedAt.getTime() - r.startedAt.getTime();
    return { testId: r.testId, status: r.status, startedAt: r.startedAt, finishedAt: r.finishedAt, durMs: dur };
  });
}
