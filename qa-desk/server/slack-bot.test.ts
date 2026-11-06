import assert from "node:assert/strict";
import process from "node:process";

process.env.DATABASE_URL = "";
const { blocosLembrete, linkDiscordNoTexto, textoDoSlack } = await import("./slack-bot.js");

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
