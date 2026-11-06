import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

// Dados isolados e modo JSON, antes de carregar os módulos que leem o caminho.
// DATABASE_URL vazia (e não apagada): o load-env não sobrescreve variável que já existe,
// então o .env local nunca liga o banco de produção neste teste.
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "qa-demandas-"));
process.env.QA_DATA_DIR = pasta;
process.env.DATABASE_URL = "";

const { formatarListaPendencias, tituloDoTexto, codigoDemanda } = await import("../src/types/demanda.js");
const { criarDemanda, atualizarDemanda, buscarDemanda, listarPendencias, DemandaInvalidaError } = await import(
  "./demandas.js"
);

const P = "anihype";

assert.equal(codigoDemanda(7), "D-007");
assert.equal(tituloDoTexto("\n\n  Conciliação do Carmo travou  \nresto"), "Conciliação do Carmo travou");
assert.equal(tituloDoTexto(""), "(sem título)");

// Numeração sequencial e título pela primeira linha.
const a = await criarDemanda(P, { texto: "Ver limite de 4 lançamentos\ndetalhes" }, "pedro");
const b = await criarDemanda(P, { texto: "Conta Caixa Comunidade", status: "aguardando", comQuem: "Sandra" }, "pedro");
assert.equal(a.codigo, "D-001");
assert.equal(b.codigo, "D-002");
assert.equal(a.titulo, "Ver limite de 4 lançamentos");
assert.ok(b.aguardandoDesde, "aguardando registra desde quando");

// Mascaramento de dados pessoais na gravação.
const c = await criarDemanda(P, { texto: "Responsável CPF 529.982.247-25 pediu retorno" }, "pedro");
assert.match(c.texto, /\[CPF\]/);
assert.doesNotMatch(c.texto, /529\.982/);

// Regras de status.
await assert.rejects(criarDemanda(P, { texto: "x", status: "aguardando" }, "pedro"), DemandaInvalidaError);
await assert.rejects(criarDemanda(P, { texto: "  " }, "pedro"), DemandaInvalidaError);

// Busca pelo código público e mudança de status com histórico.
assert.equal((await buscarDemanda(P, "d-1"))?.id, a.id);
const a2 = await atualizarDemanda(P, "D-001", { status: "aguardando", comQuem: "Sandra" }, "pedro");
assert.equal(a2?.status, "aguardando");
assert.ok(a2?.historico.some((h) => h.action === "demanda_status"));
const a3 = await atualizarDemanda(P, a.id, { status: "feito" }, "pedro");
assert.equal(a3?.aguardandoDesde, undefined, "sair de aguardando limpa o desde");

// Pendências com uma pessoa: só as aguardando com ela, mais antiga primeiro.
const d = await criarDemanda(P, { texto: "Outra da Sandra", status: "aguardando", comQuem: "sandra" }, "pedro");
const pend = await listarPendencias(P, "Sandra");
assert.deepEqual(pend.map((p) => p.ref), ["D-002", d.codigo]);

// Texto para o Discord: só nome e link, numerado.
assert.equal(
  formatarListaPendencias([
    { fonte: "demanda", ref: "D-002", titulo: "Conta Caixa", link: "https://discord.com/channels/1/2/3", desde: "" },
    { fonte: "demanda", ref: "D-004", titulo: "Sem link", desde: "" },
  ]),
  "1. Conta Caixa — https://discord.com/channels/1/2/3\n2. Sem link",
);

fs.rmSync(pasta, { recursive: true, force: true });
console.log("demandas: ok");
