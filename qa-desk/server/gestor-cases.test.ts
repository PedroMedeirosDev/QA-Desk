import assert from "node:assert/strict";
import {
  appendContinuacao,
  composeContinuacaoMessage,
  composeIntroMessage,
  createGestorCase,
  discordUrlKind,
  markGestorCaseDevolvido,
  updateGestorCaseDiscordUrl,
  type GestorCasesCatalog,
} from "./gestor-cases.js";

function emptyCatalog(): GestorCasesCatalog {
  return {
    meta: { project: "polygonus", updatedAt: "2026-08-31" },
    cases: [],
    lastNumberByAuthor: {},
  };
}

// 1. Pedro cria Caso 1 → copia → pendente vazio no bloco
{
  const cat = emptyCatalog();
  const c1 = createGestorCase(cat, {
    author: "Pedro",
    title: "Sessão legado",
    body: "Descrição caso 1",
    discordUrl: "https://discord.com/channels/1/2/3",
  });
  const text = composeIntroMessage(cat, "Pedro", c1);
  assert.equal(text, "Caso 1\nDescrição caso 1");
}

// 2. Cria Caso 2 → copia → bloco inclui Caso 1 pendente + link
{
  const cat = emptyCatalog();
  createGestorCase(cat, {
    author: "Pedro",
    title: "Primeiro",
    body: "Corpo 1",
    discordUrl: "https://discord.com/a",
  });
  const c2 = createGestorCase(cat, {
    author: "Pedro",
    title: "Segundo",
    body: "Corpo 2",
    discordUrl: "https://discord.com/b",
  });
  const text = composeIntroMessage(cat, "Pedro", c2);
  assert.ok(text.includes("Pendente (com link)"));
  assert.ok(text.includes("Caso 1 — https://discord.com/a"));
  assert.ok(text.includes("Caso 2"));
  assert.ok(text.includes("Corpo 2"));
}

// 3. Marca Caso 1 devolvido → Caso 3 não lista Caso 1 no Pendente
{
  const cat = emptyCatalog();
  const c1 = createGestorCase(cat, {
    author: "Pedro",
    title: "A",
    body: "A",
    discordUrl: "https://discord.com/a",
  });
  markGestorCaseDevolvido(c1);
  const c2 = createGestorCase(cat, {
    author: "Pedro",
    title: "B",
    body: "B",
    discordUrl: "https://discord.com/b",
  });
  const text = composeIntroMessage(cat, "Pedro", c2);
  assert.ok(!text.includes("Pendente"));
  assert.equal(text, "Caso 2\nB");
}

// 4. Continuação do Caso 2 → copia só "Continuação do caso 2."
{
  const cat = emptyCatalog();
  const c = createGestorCase(cat, {
    author: "Pedro",
    title: "X",
    body: "Intro",
    discordUrl: "https://discord.com/x",
  });
  createGestorCase(cat, {
    author: "Pedro",
    title: "Y",
    body: "Y",
    discordUrl: "https://discord.com/y",
  });
  appendContinuacao(c, "Mais detalhes");
  assert.equal(
    composeContinuacaoMessage(c, "Mais detalhes"),
    "Continuação do caso 1.\nMais detalhes",
  );
}

// 5. Segundo analista no mesmo projeto → contador independente (Caso 1 de novo)
{
  const cat = emptyCatalog();
  createGestorCase(cat, {
    author: "Pedro",
    title: "A",
    body: "A",
    discordUrl: "https://discord.com/1",
  });
  createGestorCase(cat, {
    author: "Lucas",
    title: "B",
    body: "B",
    discordUrl: "https://discord.com/2",
  });
  const p2 = createGestorCase(cat, {
    author: "Pedro",
    title: "C",
    body: "C",
    discordUrl: "https://discord.com/3",
  });
  assert.equal(p2.number, 2);
  assert.equal(cat.lastNumberByAuthor.Pedro, 2);
  assert.equal(cat.lastNumberByAuthor.Lucas, 1);
}

// 6. Pendente usa o link da mensagem original; sem link, só o número
{
  const cat = emptyCatalog();
  createGestorCase(cat, {
    author: "Pedro",
    title: "Sem link ainda",
    body: "Primeiro caso, ainda sem colar no Discord",
  });
  const c2 = createGestorCase(cat, {
    author: "Pedro",
    title: "Segundo",
    body: "Corpo 2",
  });
  const text = composeIntroMessage(cat, "Pedro", c2);
  assert.ok(text.includes("Pendente (com link)"));
  assert.ok(text.includes("Caso 1\nPrimeiro caso, ainda sem colar no Discord"));
  assert.ok(!text.includes("Caso 1 —"));
}

{
  const cat = emptyCatalog();
  const c1 = createGestorCase(cat, {
    author: "Pedro",
    title: "A",
    body: "Resumo A",
  });
  updateGestorCaseDiscordUrl(c1, "https://discord.com/channels/1/2/msg");
  const c2 = createGestorCase(cat, {
    author: "Pedro",
    title: "B",
    body: "Resumo B",
  });
  const text = composeIntroMessage(cat, "Pedro", c2);
  assert.ok(text.includes("Caso 1 — https://discord.com/channels/1/2/msg"));
}

{
  const channel = "https://discord.com/channels/1339775689209024612/1524389844153925662";
  const message = `${channel}/1524390000000000000`;
  assert.equal(discordUrlKind(channel), "channel");
  assert.equal(discordUrlKind(message), "message");
  assert.equal(discordUrlKind("https://example.com/x"), "other");
}

console.log("all gestor-cases tests passed");
