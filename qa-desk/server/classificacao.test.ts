import assert from "node:assert/strict";
import process from "node:process";

process.env.XAI_API_KEY = "";
const { classificarPorRegras, classificarTexto, filtrarParaIaExterna, interpretarRespostaIa, parecidos } = await import(
  "./classificacao.js"
);

// Filtro antes da IA externa: nada pessoal passa.
const print = [
  "Sandra 10:32",
  "Oi Pedro, a Maria Eduarda Souza da Silva (matrícula 2024123) não aparece no boleto de R$ 1.234,56.",
  "CPF 123.456.789-09, tel (31) 98765-4321, sandra@escola.com.br",
  "Colégio Nossa Senhora do Carmo, ver https://colegiocarmo.polygonus.com.br/web/react/gestao",
  "@moacir pode olhar? A Conciliação Bancária também diverge.",
].join("\n");
const filtrado = filtrarParaIaExterna(print, ["Carmo"]);
for (const vazou of ["Sandra", "Pedro", "Maria", "Eduarda", "Souza", "2024123", "1.234,56", "123.456.789-09", "98765", "sandra@", "colegiocarmo", "Carmo", "moacir"]) {
  assert.ok(!filtrado.includes(vazou), `vazou "${vazou}" no texto para a IA:\n${filtrado}`);
}
assert.match(filtrado, /^\[NOME\] 10:32/m);
assert.match(filtrado, /\[VALOR\]/);
assert.match(filtrado, /\[LINK\]/);
assert.match(filtrado, /Conciliação Bancária/, "termos do produto continuam legíveis");
assert.match(filtrado, /não aparece no boleto/);

// Regras locais (sem chave da API).
assert.equal(classificarPorRegras("O boleto não aparece e dá erro ao gerar").tipo, "bug");
assert.equal(classificarPorRegras("Sugestão: seria bom a data da tarefa ser opcional").tipo, "sugestao");
assert.equal(classificarPorRegras("Como faço para conciliar? Onde fica a tela?").tipo, "duvida");
assert.equal(classificarPorRegras("Preciso que você refaça os lançamentos até sexta").tipo, "demanda");
const vago = classificarPorRegras("ok, combinado");
assert.equal(vago.tipo, "demanda");
assert.ok(vago.confianca < 0.3);

// Sem XAI_API_KEY: usa regras e o título sai do texto já filtrado.
const semIa = await classificarTexto("Oi Pedro, Maria Souza não aparece no boleto, dá erro");
assert.equal(semIa.fonte, "regras");
assert.equal(semIa.tipo, "bug");
assert.ok(!semIa.titulo.includes("Maria") && !semIa.titulo.includes("Pedro"), semIa.titulo);

// Resposta do Grok: só aceita o esquema.
const ok = interpretarRespostaIa(JSON.stringify({ tipo: "sugestao", titulo: "Data da tarefa opcional", resumo: "x", confianca: 1.7, motivo: "y" }));
assert.equal(ok?.tipo, "sugestao");
assert.equal(ok?.confianca, 1);
assert.equal(ok?.fonte, "ia");
assert.equal(interpretarRespostaIa(JSON.stringify({ tipo: "outro", titulo: "a" })), null);
assert.equal(interpretarRespostaIa(JSON.stringify({ tipo: "bug", titulo: "" })), null);
assert.equal(interpretarRespostaIa("não é json"), null);

// Parecidos: evita duplicidade.
const itens = [
  { codigo: "D-004", titulo: "Tarifa da conciliação Getnet arredondada" },
  { codigo: "BUG-APP-0012", titulo: "Miniatura do vídeo não aparece no Mural" },
  { codigo: "S-002", titulo: "Nome da IA de atendimento" },
];
assert.deepEqual(
  parecidos("A miniatura do vídeo continua sem aparecer no mural", itens).map((i) => i.codigo),
  ["BUG-APP-0012"],
);
assert.deepEqual(parecidos("Refazer lançamentos de setembro", itens), []);

console.log("classificacao.test: ok");
