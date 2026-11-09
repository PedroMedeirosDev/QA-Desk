import assert from "node:assert/strict";
import process from "node:process";

process.env.DATABASE_URL = "";
const { blocosEntrada, blocosLembrete, linkDiscordNoTexto, textoDoSlack, textoRevisao, tituloDaIa } = await import("./slack-bot.js");

// Revisão do Grok levada ao #entrada.
assert.match(textoRevisao({ tipo: "bug", titulo: "Miniatura sumiu" }, "bug", true), /concorda — Bug[\s\S]*uso este ao confirmar/);
assert.match(textoRevisao({ tipo: "sugestao" }, "bug", false), /discorda — Sugestão/);
assert.match(textoRevisao({}, "bug", false), /não indicou o tipo/);
const cBug = { tipo: "bug", titulo: "t", resumo: "", confianca: 0.5, motivo: "", fonte: "regras" } as const;
assert.ok(JSON.stringify(blocosEntrada("x", cBug, [], "Revisão: responda").blocos).includes("Revisão: responda"));
// Com o aviso de revisão, os botões de confirmar continuam por último.
assert.ok(JSON.stringify(blocosEntrada("x", cBug, [], "aviso").blocos.at(-1)).includes("entrada_descartar"));

// Título: só o do Grok sem marcador do filtro; regras → título do texto original.
const base = { tipo: "bug", resumo: "", confianca: 0.9, motivo: "" } as const;
assert.equal(tituloDaIa({ ...base, titulo: "Miniatura do vídeo não aparece", fonte: "ia" }), "Miniatura do vídeo não aparece");
assert.equal(tituloDaIa({ ...base, titulo: "[NOME] relatou erro", fonte: "ia" }), undefined);
assert.equal(tituloDaIa({ ...base, titulo: "qualquer", fonte: "regras" }), undefined);

// Entrada: botão recomendado destacado; dúvida vira Demanda; aviso de parecido.
const entrada = blocosEntrada(
  "abc",
  { tipo: "duvida", titulo: "Onde fica a conciliação", resumo: "", confianca: 0.8, motivo: "pergunta de uso", fonte: "ia" },
  [{ codigo: "D-004", titulo: "Conciliação Getnet" }],
);
const entradaJson = JSON.stringify(entrada.blocos);
assert.match(entrada.texto, /Dúvida de uso/);
assert.ok(entradaJson.includes("Parecido com") && entradaJson.includes("D-004"));
const botoes = (entrada.blocos.at(-1) as { elements: Array<{ action_id: string; style?: string; value: string }> }).elements;
assert.deepEqual(botoes.map((b) => b.action_id), ["entrada_bug", "entrada_demanda", "entrada_sugestao", "entrada_descartar"]);
assert.equal(botoes.find((b) => b.style === "primary")?.action_id, "entrada_demanda");
assert.ok(botoes.every((b) => b.value === "abc"));

// Lembrete: nada a avisar → sem mensagem; com itens → um conjunto de botões por demanda.
assert.equal(blocosLembrete({ vencemHoje: [], atrasadas: [], proximos: [] }), null);
const dem = { codigo: "D-012", titulo: "Relatório de frequência", comQuem: "Dev", prazo: "2026-11-12", cobrancas: ["x"] } as never;
const lembrete = blocosLembrete({ vencemHoje: [dem], atrasadas: [], proximos: [] })!;
assert.match(lembrete.texto, /1 hoje/);
const json = JSON.stringify(lembrete.blocos);
assert.ok(json.includes("demanda_cobrei") && json.includes("demanda_entregue") && json.includes("demanda_adiar"));
assert.ok(json.includes("prazo 12/11") && json.includes("cobrado 1x"));

assert.equal(textoDoSlack("ver <https://x.com/a|aqui> &amp; <https://y.com/b>"), "ver aqui (https://x.com/a) & https://y.com/b");
assert.equal(
  linkDiscordNoTexto("Moacir pediu: https://discord.com/channels/1339775689209024612/1524389844153925662/1563189405949100093 ok"),
  "https://discord.com/channels/1339775689209024612/1524389844153925662/1563189405949100093",
);
assert.equal(linkDiscordNoTexto("sem link aqui"), undefined);

console.log("slack-bot: ok");
