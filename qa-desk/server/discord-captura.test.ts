import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

process.env.QA_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "qa-captura-"));
process.env.DATABASE_URL = "";

const { extrairConteudo, montarTexto } = await import("./discord-captura.js");

const print = { url: "https://cdn.discordapp.com/x/image.png", name: "image.png", contentType: "image/webp", size: 26046 };
const criada = new Date("2026-10-24T13:00:00Z");

// Encaminhada: o discord.js entrega snapshots e anexos em Collection (Map), não em array.
const encaminhada = extrairConteudo({
  content: "",
  url: "https://discord.com/channels/1/2/3",
  createdAt: new Date("2026-10-27T13:38:00Z"),
  attachments: new Map(),
  reference: { guildId: "1339775689209024612", channelId: "1524389844153925662", messageId: "1563189405949100093" },
  messageSnapshots: new Map([["1563189405949100093", { content: "", createdAt: criada, attachments: new Map([["9", print]]) }]]),
});
assert.equal(encaminhada.encaminhada, true);
assert.deepEqual(encaminhada.anexos, [print]);
assert.equal(
  encaminhada.linkOriginal,
  "https://discord.com/channels/1339775689209024612/1524389844153925662/1563189405949100093",
);
assert.equal(encaminhada.linkCaptura, "https://discord.com/channels/1/2/3");
assert.equal(encaminhada.dataOriginal, criada.toISOString());

// Comentário escrito junto do encaminhamento entra depois do texto original.
const comComentario = extrairConteudo({
  content: "ver com o Moacir",
  url: "u",
  createdAt: criada,
  attachments: new Map(),
  reference: { channelId: "c", messageId: "m" },
  messageSnapshots: new Map([["m", { content: "Texto original", createdAt: criada, attachments: null }]]),
});
assert.equal(comComentario.texto, "Texto original\n\nver com o Moacir");
assert.equal(comComentario.linkOriginal, "https://discord.com/channels/@me/c/m");

// Mensagem escrita direto no canal.
const direta = extrairConteudo({ content: "  bug no login  ", url: "u", createdAt: criada, attachments: new Map([["1", print]]) });
assert.equal(direta.encaminhada, false);
assert.equal(direta.texto, "bug no login");
assert.equal(direta.linkOriginal, undefined);
assert.equal(direta.anexos.length, 1);

assert.equal(montarTexto("escrito", ""), "escrito");
assert.equal(montarTexto("", "lido"), "lido");
assert.equal(montarTexto("escrito", "lido"), "escrito\n\n--- Texto lido do print ---\nlido");

console.log("discord-captura.test: ok");
