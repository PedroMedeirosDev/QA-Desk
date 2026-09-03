import assert from "node:assert/strict";
import {
  appendContinuacao,
  composeContinuacaoMessage,
  applyBugStatusToGestorCases,
  composeGestorBodyFromBug,
  composeIntroMessage,
  composeOwnCaseMessage,
  createGestorCase,
  discordUrlKind,
  findGestorCaseByLinkedTest,
  markGestorCaseDevolvido,
  replaceGestorCaseIntro,
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
  assert.equal(text, "**Caso 1:** Sessão legado\nDescrição caso 1");
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
  assert.ok(text.includes("**Caso 1** — https://discord.com/a"));
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
  assert.equal(text, "**Caso 2:** B\nB");
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
    "**Continuação do caso 1.**\nMais detalhes",
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
  assert.ok(text.includes("**Caso 1**\nPrimeiro caso, ainda sem colar no Discord"));
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
  assert.ok(text.includes("**Caso 1** — https://discord.com/channels/1/2/msg"));
}

{
  const channel = "https://discord.com/channels/1339775689209024612/1524389844153925662";
  const message = `${channel}/1524390000000000000`;
  assert.equal(discordUrlKind(channel), "channel");
  assert.equal(discordUrlKind(message), "message");
  assert.equal(discordUrlKind("https://example.com/x"), "other");
}

{
  const body = composeGestorBodyFromBug({
    description:
      "Responsável não vê o boletim no app.\n\nEscola: CEAV Unidade I\n\nObs: também some nas mensalidades.",
    testLogin: "64594815200",
    runtimeEnv: "producao",
    unitLabel: "Centro Educacional Adalberto Valle — Unidade I (Manaus)",
    deviceLabel: "app amostra",
    actualResult: "Nenhum aluno disponível",
    expectedResult: "Lista o aluno e abre o boletim",
    steps: ["Abrir o App", "Entrar no Boletim"],
  });
  assert.ok(body.includes("Escola: CEAV Unidade I\nLogin: 64594815200"));
  const withPeriodo = composeGestorBodyFromBug({
    description: "Escola: CEAV\nAluno: Davi\nPeríodo: 2026-EFII-1\n\nObs: x",
    testLogin: "64594815200",
  });
  assert.ok(withPeriodo.includes("Login: 64594815200  |  Período: 2026-EFII-1"));
  assert.ok(!withPeriodo.includes("\nLogin: 64594815200\n"));
  assert.ok(body.indexOf("Login: 64594815200") < body.indexOf("Obs:"));
  assert.ok(body.includes("Obs: também some nas mensalidades."));
  assert.ok(!body.includes("Ambiente:"));
  assert.ok(!body.includes("Unidade:"));
  assert.ok(!body.includes("Device:"));
  assert.ok(!body.includes("Obtido:"));
  assert.ok(!body.includes("Esperado:"));
  assert.ok(!body.includes("Passos:"));
  assert.equal(body.match(/CEAV|Adalberto/g)?.length, 1);

  const lostLogin = composeGestorBodyFromBug({
    description: "Texto curto.\nLogin: [CPF]",
    testLogin: "[CPF]",
  });
  assert.equal(lostLogin, "Texto curto.");

  const withFiles = composeGestorBodyFromBug({
    description: "x",
    evidence: [
      { filename: "boletim.png", type: "screenshot" },
      { filename: "repro.mp4", type: "video" },
    ],
  });
  assert.equal(withFiles, "x");
  assert.ok(!withFiles.toLowerCase().includes("anexo"));
}

{
  const cat = emptyCatalog();
  const c1 = createGestorCase(cat, {
    author: "Pedro",
    title: "Boletim não aparece no App (Web OK)",
    body:
      'Erro exibido: "Nenhum aluno disponível para consulta nesta unidade e ano letivo"\n\nEscola: CEAV\nAluno: Davi\nLogin: 64594815200  |  Período: 2026-EFII-1\n\nConferências OK: Exibição na Web, Funções do Portal e Perfil da Responsável.\nObs: some nas mensalidades (mesmo gatilho).',
  });
  const text = composeIntroMessage(cat, "Pedro", c1);
  assert.ok(text.startsWith("**Caso 1:** Boletim não aparece no App (Web OK)"));
  assert.ok(text.includes('**Erro exibido:** **"Nenhum aluno disponível para consulta nesta unidade e ano letivo"**'));
  assert.ok(text.includes("**Escola:** CEAV"));
  assert.ok(text.includes("**Aluno:** Davi"));
  assert.ok(text.includes("**Login:** `64594815200`  |  **Período:** `2026-EFII-1`"));
  assert.ok(text.includes("**Conferências OK:** Exibição na Web, Funções do Portal e Perfil da Responsável."));
  assert.ok(text.includes("**Obs:** some nas mensalidades (mesmo gatilho)."));
  assert.equal(composeOwnCaseMessage(c1), text);
}

{
  const cat = emptyCatalog();
  const c1 = createGestorCase(cat, {
    author: "Pedro",
    title: "Boletim app",
    body: "Corpo",
    linkedTestId: "BUG-2026-099",
  });
  assert.equal(findGestorCaseByLinkedTest(cat, "BUG-2026-099", "Pedro")?.id, c1.id);
  assert.equal(applyBugStatusToGestorCases(cat, "BUG-2026-099", "enviado_gestor"), false);
  assert.equal(c1.status, "pendente");
  assert.equal(applyBugStatusToGestorCases(cat, "BUG-2026-099", "em_tratamento"), false);
  assert.equal(c1.status, "pendente");
  assert.equal(applyBugStatusToGestorCases(cat, "BUG-2026-099", "corrigido_gestor"), true);
  assert.equal(c1.status, "devolvido");
  assert.equal(applyBugStatusToGestorCases(cat, "BUG-2026-099", "enviado_gestor"), true);
  assert.equal(c1.status, "pendente");
}

{
  const cat = emptyCatalog();
  const c1 = createGestorCase(cat, {
    author: "Pedro",
    title: "Antigo",
    body: "Texto velho",
    linkedTestId: "BUG-2026-012",
  });
  replaceGestorCaseIntro(c1, "Novo título", "Texto editado no bug");
  assert.equal(c1.title, "Novo título");
  assert.equal(c1.entries.find((e) => e.kind === "intro")?.body, "Texto editado no bug");
}

console.log("all gestor-cases tests passed");
