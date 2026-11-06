import assert from "node:assert/strict";
import process from "node:process";

process.env.DATABASE_URL = "";
const { calcularMetricas } = await import("./metricas.js");

const base = { description: "", steps: [], reportedAt: "2026-11-01", project: "polygonus", platform: "web", history: [] };
const reports = [
  { ...base, id: "T1", title: "CT-1", recordType: "teste", status: "rascunho", module: "Mural", executionMode: "automated" },
  { ...base, id: "T2", title: "CT-2", recordType: "teste", status: "rascunho", module: "Mural", executionMode: "manual" },
  { ...base, id: "T3", title: "CT-3", recordType: "teste", status: "rascunho", module: "Rotina", automation: { type: "playwright", playwright: { specPath: "x.spec.ts" } } },
  { ...base, id: "B1", title: "Bug 1", recordType: "bug", status: "rascunho", severity: "alta", linkedRunId: "r1" },
  { ...base, id: "B2", title: "Bug 2", recordType: "bug", status: "homologado", severity: "media", reportedAt: "2026-11-01", homologatedAt: "2026-11-04" },
] as never[];

const d = (iso: string) => new Date(iso);
const run = (testId: string, status: string, iso: string, durMs = 1000) => ({ testId, status, startedAt: d(iso), finishedAt: d(iso), durMs });
const runs = [
  run("T1", "success", "2026-11-01T10:00:00Z"),
  run("T1", "failed", "2026-11-02T10:00:00Z"),
  run("T1", "success", "2026-11-03T10:00:00Z"),
  run("T3", "failed", "2026-11-03T10:00:00Z", 3000),
  run("T3", "cancelled", "2026-11-04T10:00:00Z"),
];

const m = calcularMetricas(reports, runs, 30);
assert.deepEqual(m.casos, { total: 3, automatizados: 2, pctAutomatizado: 67 });
assert.deepEqual(m.porModulo[0], { modulo: "Mural", total: 2, automatizados: 1 });
assert.equal(m.execucoes.total, 4);
assert.equal(m.execucoes.aprovacao, 50);
assert.equal(m.execucoes.instaveis, 1, "T1 alternou passou/falhou/passou");
assert.equal(m.execucoes.duracaoMediaMs, 1500);
assert.equal(m.bugs.total, 2);
assert.equal(m.bugs.abertos, 1);
assert.equal(m.bugs.porSeveridade.alta, 1);
assert.deepEqual(m.bugs.porOrigem, { automacao: 1, manual: 1 });
assert.equal(m.bugs.diasMedioAteHomologar, 3);

// Trabalho: prometido × entregue no prazo, sugestões e intenções do dia.
const { calcularTrabalho } = await import("./metricas.js");
const t = calcularTrabalho(
  [
    { criadaEm: "2026-11-05T10:00:00Z", prazo: "2026-11-12", concluidaEm: "2026-11-10T15:00:00Z", reuniao: "R1" },
    { criadaEm: "2026-11-05T10:00:00Z", prazo: "2026-11-12", concluidaEm: "2026-11-14T15:00:00Z", reuniao: "R1" },
    { criadaEm: "2026-11-05T10:00:00Z", prazo: "2026-11-20", reuniao: "R2" },
    { criadaEm: "2026-11-05T10:00:00Z" },
    { criadaEm: "2026-11-06T10:00:00Z", tipo: "sugestao", sugestaoStatus: "implementada" },
    { criadaEm: "2026-11-06T10:00:00Z", tipo: "sugestao", sugestaoStatus: "sem_retorno" },
    { criadaEm: "2026-09-01T10:00:00Z", prazo: "2026-09-02" },
  ],
  [["reuniao_cliente", "suporte_n2"], ["suporte_n2"], ["homologacao"]],
  "2026-10-07T00:00:00Z",
);
assert.equal(t.reunioes, 2);
assert.equal(t.prometidas, 3, "fora do período e sem prazo não contam");
assert.equal(t.entregues, 2);
assert.equal(t.entreguesNoPrazo, 1);
assert.equal(t.atrasoMedioDias, 2);
assert.deepEqual(t.sugestoes, { total: 2, comRetorno: 1, aceitas: 1, implementadas: 1 });
assert.deepEqual(t.diasPorIntencao, { reuniao_cliente: 1, orientacao_n1: 0, suporte_n2: 2 });

console.log("metricas: ok");
