import assert from "node:assert/strict";
import process from "node:process";

process.env.DATABASE_URL = "";
const { calcularHistorico, sanitizarScript } = await import("./test-ficha.js");

const exec = (status: string, duracaoMs: number | null = 1000) => ({
  runId: Math.random().toString(36),
  status,
  startedAt: "2026-11-05T12:00:00Z",
  duracaoMs,
  appVersion: null,
  fonte: null,
  erro: null,
});

// Aprovação e duração média; cancelado não conta.
const h = calcularHistorico([exec("success", 1000), exec("failed", 3000), exec("cancelled", null), exec("success", 2000)]);
assert.equal(h.total, 3);
assert.equal(h.aprovacao, 67);
assert.equal(h.duracaoMediaMs, 2000);
// success → failed → success = 2 trocas: instável.
assert.equal(h.instavel, true);

// Falha consistente não é instabilidade.
assert.equal(calcularHistorico([exec("failed"), exec("failed"), exec("success")]).instavel, false);
assert.deepEqual(calcularHistorico([]), { total: 0, aprovacao: null, duracaoMediaMs: null, instavel: false });

// Script para o visitante: sem URL, host, login, senha, ids longos.
const limpo = sanitizarScript(
  [
    'await page.goto("https://amostra.polygonus.com.br:8443/web/react/gestao");',
    'await loginAs(page, "PHJESUS");',
    "const senha = process.env.SENHA;",
    "await trocarPorId(page, 69690);",
    'await expect(page.getByText("Enviadas")).toBeVisible();',
  ].join("\n"),
);
assert.ok(!limpo.includes("polygonus"), limpo);
assert.ok(!limpo.includes("PHJESUS"), limpo);
assert.ok(!/senha/i.test(limpo), limpo);
assert.ok(!limpo.includes("69690"), limpo);
assert.ok(limpo.includes('getByText("Enviadas")'), "o passo de teste continua legível");

const longo = sanitizarScript(Array.from({ length: 80 }, (_, i) => `linha ${i}`).join("\n"));
assert.ok(longo.endsWith("(20 linhas omitidas)"));

console.log("test-ficha: ok");
