import assert from "node:assert/strict";
import process from "node:process";

process.env.DATABASE_URL = "";
const { linkDiscordNoTexto, textoDoSlack } = await import("./slack-bot.js");

assert.equal(textoDoSlack("ver <https://x.com/a|aqui> &amp; <https://y.com/b>"), "ver aqui (https://x.com/a) & https://y.com/b");
assert.equal(
  linkDiscordNoTexto("Moacir pediu: https://discord.com/channels/1339775689209024612/1524389844153925662/1563189405949100093 ok"),
  "https://discord.com/channels/1339775689209024612/1524389844153925662/1563189405949100093",
);
assert.equal(linkDiscordNoTexto("sem link aqui"), undefined);

console.log("slack-bot: ok");
