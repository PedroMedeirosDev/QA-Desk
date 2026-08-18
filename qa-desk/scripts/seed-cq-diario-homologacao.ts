/**
 * Homologação CQ — Notas / Conteúdo / Frequência (React, o Amostra).
 *
 *   cd qa-desk
 *   npx tsx scripts/seed-cq-diario-homologacao.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "../server/load-env.ts";

loadEnv();

import { CQ_DIARIO_HOMOLOGATION_SLUG } from "../server/homologation-config.ts";
import {
  appendHomologationHistory,
  createHomologation,
  findHomologationBySlug,
  linkTestsToHomologation,
  readHomologationCatalog,
  writeHomologationCatalog,
} from "../server/homologations.ts";
import {
  appendHistory,
  nextTestId,
  readCatalog,
  writeCatalog,
} from "../server/storage.ts";
import { findByTestKey } from "../server/test-key.ts";
import type { TestRecord } from "../server/types.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const project = "polygonus" as const;
const now = new Date().toISOString();
const reportedAt = now.slice(0, 10);

const SPEC = {
  notas: "projects/polygonus/automation/playwright/academico/cq/cq-notas-abrir.spec.ts",
  conteudo: "projects/polygonus/automation/playwright/academico/cq/cq-conteudo-abrir.spec.ts",
  freq: "projects/polygonus/automation/playwright/academico/cq/cq-frequencia-abrir.spec.ts",
} as const;

type Draft = Omit<TestRecord, "id" | "history" | "evidence"> & { testKey: string };

function ct(partial: Draft): Draft {
  return {
    recordType: "teste",
    reportedAt,
    project,
    channel: "web",
    platform: "web",
    module: "Acadêmico",
    status: "rascunho",
    homologationStatus: "pendente",
    campaign: CQ_DIARIO_HOMOLOGATION_SLUG,
    showInPortfolio: false,
    ...partial,
  };
}

const DRAFTS: Draft[] = [
  ct({
    testKey: "academico/cq-notas-01",
    title: "CQ-NOTAS-01 · Abrir lançamento de notas parciais",
    description:
      "Smoke React no Amostra: login gestão CQ → /academico/notas-parciais monta (filtros turma/disciplina/etapa).",
    preconditions: "PLAYWRIGHT_* no .env; Chrome; o Amostra :8443.",
    expectedResult: "Tela Notas parciais visível, sem toast FireDAC/500.",
    steps: [
      "Login no Amostra (gestão React)",
      "Abrir Acadêmico → Notas parciais",
      "Validar cabeçalho e combos",
    ],
    executionMode: "automated",
    priority: "alta",
    automation: {
      type: "playwright",
      label: "CQ-NOTAS-01",
      playwright: { specPath: SPEC.notas, headed: true, readiness: "draft" },
    },
    tags: ["homologacao", "cq", CQ_DIARIO_HOMOLOGATION_SLUG, "module:Acadêmico", "suite:Notas", "ct:CQ-NOTAS-01"],
  }),
  ct({
    testKey: "academico/cq-notas-02",
    title: "CQ-NOTAS-02 · Lançar nota inteira e gravar",
    description: "Selecionar turma/disciplina/etapa/avaliação, lançar nota inteira em 1 aluno, Gravar.",
    preconditions: "Professor ou suporte com turma lançável no Amostra.",
    expectedResult: "Gravação 200; nota persiste no reload; sem nvarchar/numeric.",
    steps: [
      "Abrir Notas parciais e selecionar turma + disciplina + etapa + AT",
      "Digitar nota inteira (ex. 7 ou 30 conforme valor da AT)",
      "Gravar e recarregar a tela",
    ],
    executionMode: "manual",
    priority: "alta",
    tags: ["homologacao", "cq", CQ_DIARIO_HOMOLOGATION_SLUG, "module:Acadêmico", "suite:Notas", "ct:CQ-NOTAS-02"],
  }),
  ct({
    testKey: "academico/cq-notas-03",
    title: "CQ-NOTAS-03 · Nota com vírgula (29,5)",
    description: "Mesmo form React: decimal pt-BR. No fonte novo a vírgula vira ponto no POST.",
    preconditions: "CQ-NOTAS-02 ok na mesma avaliação.",
    expectedResult: "Grava; valor exibido com vírgula; backend sem erro de conversão.",
    steps: ["Digitação 29,5 (ou 7,5 se máximo 10)", "Gravar", "Conferir persistência"],
    executionMode: "manual",
    priority: "alta",
    tags: ["homologacao", "cq", CQ_DIARIO_HOMOLOGATION_SLUG, "module:Acadêmico", "suite:Notas", "ct:CQ-NOTAS-03"],
  }),
  ct({
    testKey: "academico/cq-notas-04",
    title: "CQ-NOTAS-04 · Um aluno preenchido, demais vazios",
    description: "POST manda o grid; células vazias no Go são DELETE. Validar que vazios não estouram CAST.",
    preconditions: "Lista com ≥2 alunos.",
    expectedResult: "Só o aluno preenchido grava; sem toast nvarchar.",
    steps: ["Preencher 1 linha", "Deixar o resto em branco", "Gravar"],
    executionMode: "manual",
    priority: "alta",
    tags: ["homologacao", "cq", CQ_DIARIO_HOMOLOGATION_SLUG, "module:Acadêmico", "suite:Notas", "ct:CQ-NOTAS-04"],
  }),
  ct({
    testKey: "academico/cq-notas-05",
    title: "CQ-NOTAS-05 · Nota igual ao valor máximo da avaliação",
    description: "Ex.: valor 30 → lançar 30 (caso da Stefanie no iOS legado).",
    preconditions: "Avaliação com máximo conhecido (10 ou 30).",
    expectedResult: "Aceita e grava.",
    steps: ["Conferir Valor da AT", "Lançar exatamente o máximo", "Gravar"],
    executionMode: "manual",
    priority: "media",
    tags: ["homologacao", "cq", CQ_DIARIO_HOMOLOGATION_SLUG, "module:Acadêmico", "suite:Notas", "ct:CQ-NOTAS-05"],
  }),
  ct({
    testKey: "academico/cq-notas-06",
    title: "CQ-NOTAS-06 · Nota acima do máximo (recusa)",
    description: "UI/backend deve recusar, não mandar lixo numérico.",
    preconditions: "Máximo conhecido.",
    expectedResult: "Bloqueio ou recusado no POST; nada gravado acima do teto.",
    steps: ["Digitação > máximo", "Tentar Gravar", "Conferir mensagem"],
    executionMode: "manual",
    priority: "media",
    tags: ["homologacao", "cq", CQ_DIARIO_HOMOLOGATION_SLUG, "module:Acadêmico", "suite:Notas", "ct:CQ-NOTAS-06"],
  }),
  ct({
    testKey: "academico/cq-conteudo-01",
    title: "CQ-CONTEUDO-01 · Abrir conteúdo — quadro por etapa (form 1)",
    description: "React /academico/conteudo (realizado). Um dos dois forms do Moacir.",
    preconditions: "Amostra CQ.",
    expectedResult: "Quadro monta (etapa/disciplina/mês).",
    steps: ["Login", "Acadêmico → Conteúdo (quadro)", "Validar header"],
    executionMode: "automated",
    priority: "alta",
    automation: {
      type: "playwright",
      label: "CQ-CONTEUDO-01",
      playwright: { specPath: SPEC.conteudo, headed: true, readiness: "draft" },
    },
    tags: ["homologacao", "cq", CQ_DIARIO_HOMOLOGATION_SLUG, "module:Acadêmico", "suite:Conteudo", "ct:CQ-CONTEUDO-01"],
  }),
  ct({
    testKey: "academico/cq-conteudo-02",
    title: "CQ-CONTEUDO-02 · Gravar conteúdo no quadro por etapa",
    description: "Editar texto de uma aula do dia letivo e gravar.",
    preconditions: "Dia letivo na janela de lançamento.",
    expectedResult: "POST quadro/gravar ok; texto permanece no reload.",
    steps: ["Selecionar professor/etapa/disciplina", "Editar uma célula", "Gravar"],
    executionMode: "manual",
    priority: "alta",
    tags: ["homologacao", "cq", CQ_DIARIO_HOMOLOGATION_SLUG, "module:Acadêmico", "suite:Conteudo", "ct:CQ-CONTEUDO-02"],
  }),
  ct({
    testKey: "academico/cq-conteudo-03",
    title: "CQ-CONTEUDO-03 · Abrir conteúdo por turma (form 2)",
    description: "React /academico/conteudo-por-turma — segundo form de conteúdo.",
    preconditions: "Amostra CQ.",
    expectedResult: "Tela por turma+data monta; aulas do dia listadas.",
    steps: ["Login", "Acadêmico → Conteúdo por turma", "Escolher turma e data"],
    executionMode: "automated",
    priority: "alta",
    automation: {
      type: "playwright",
      label: "CQ-CONTEUDO-03",
      playwright: { specPath: SPEC.conteudo, headed: true, readiness: "draft" },
    },
    tags: ["homologacao", "cq", CQ_DIARIO_HOMOLOGATION_SLUG, "module:Acadêmico", "suite:Conteudo", "ct:CQ-CONTEUDO-03"],
  }),
  ct({
    testKey: "academico/cq-conteudo-04",
    title: "CQ-CONTEUDO-04 · Gravar conteúdo por turma",
    description: "Digitação por turma+data; texto vazio no legado apaga a linha.",
    preconditions: "Dia letivo (dia não letivo bloqueia a tela).",
    expectedResult: "Gravação ok em dia letivo; feriado permanece bloqueado.",
    steps: ["Turma + data letiva", "Preencher uma aula", "Gravar"],
    executionMode: "manual",
    priority: "alta",
    tags: ["homologacao", "cq", CQ_DIARIO_HOMOLOGATION_SLUG, "module:Acadêmico", "suite:Conteudo", "ct:CQ-CONTEUDO-04"],
  }),
  ct({
    testKey: "academico/cq-freq-01",
    title: "CQ-FREQ-01 · Abrir faltas diárias — quadro (form 1)",
    description: "React /academico/faltas-diarias. Um dos dois forms de frequência.",
    preconditions: "Amostra CQ.",
    expectedResult: "Quadro de faltas monta (turma/etapa/mês).",
    steps: ["Login", "Acadêmico → Faltas diárias", "Validar grid"],
    executionMode: "automated",
    priority: "alta",
    automation: {
      type: "playwright",
      label: "CQ-FREQ-01",
      playwright: { specPath: SPEC.freq, headed: true, readiness: "draft" },
    },
    tags: ["homologacao", "cq", CQ_DIARIO_HOMOLOGATION_SLUG, "module:Acadêmico", "suite:Frequencia", "ct:CQ-FREQ-01"],
  }),
  ct({
    testKey: "academico/cq-freq-02",
    title: "CQ-FREQ-02 · Marcar falta no quadro e gravar",
    description: "Diff marcar/desmarcar → INSERT/DELETE falta_diaria.",
    preconditions: "Turma com alunos e aula até hoje (data futura bloqueada).",
    expectedResult: "Falta persiste; desmarcar remove.",
    steps: ["Abrir quadro", "Marcar 1 célula", "Gravar", "Desmarcar e gravar de novo"],
    executionMode: "manual",
    priority: "alta",
    tags: ["homologacao", "cq", CQ_DIARIO_HOMOLOGATION_SLUG, "module:Acadêmico", "suite:Frequencia", "ct:CQ-FREQ-02"],
  }),
  ct({
    testKey: "academico/cq-freq-03",
    title: "CQ-FREQ-03 · Abrir faltas por turma (form 2)",
    description: "React /academico/faltas-por-turma — segundo form de frequência.",
    preconditions: "Amostra CQ.",
    expectedResult: "Tela por turma+dia monta.",
    steps: ["Login", "Acadêmico → Faltas por turma", "Escolher turma e data"],
    executionMode: "automated",
    priority: "alta",
    automation: {
      type: "playwright",
      label: "CQ-FREQ-03",
      playwright: { specPath: SPEC.freq, headed: true, readiness: "draft" },
    },
    tags: ["homologacao", "cq", CQ_DIARIO_HOMOLOGATION_SLUG, "module:Acadêmico", "suite:Frequencia", "ct:CQ-FREQ-03"],
  }),
  ct({
    testKey: "academico/cq-freq-04",
    title: "CQ-FREQ-04 · Marcar falta por turma e gravar",
    description: "Mesmos endpoints do quadro, com dia na URL; feriado bloqueia.",
    preconditions: "Dia letivo.",
    expectedResult: "Grava; dia não letivo não grava.",
    steps: ["Turma + data letiva", "Marcar falta", "Gravar"],
    executionMode: "manual",
    priority: "alta",
    tags: ["homologacao", "cq", CQ_DIARIO_HOMOLOGATION_SLUG, "module:Acadêmico", "suite:Frequencia", "ct:CQ-FREQ-04"],
  }),
];

const homCatalog = await readHomologationCatalog(project);
let campanha = findHomologationBySlug(homCatalog, CQ_DIARIO_HOMOLOGATION_SLUG);

if (!campanha) {
  campanha = createHomologation(homCatalog, {
    project,
    title: "Homologação CQ — Notas, Conteúdo, Frequência",
    description:
      "WEB React no Amostra (CQ). Notas parciais + Conteúdo e Frequência nos dois forms (quadro e por turma). Pedido Moacir 18/08. iOS/Delphi da Stefanie fora deste recorte.",
    channel: "web",
    changeScope: "fullstack",
    testKeys: DRAFTS.map((d) => d.testKey),
  });
  campanha.slug = CQ_DIARIO_HOMOLOGATION_SLUG;
  campanha.campaign = CQ_DIARIO_HOMOLOGATION_SLUG;
  console.log(`Homologação criada: ${campanha.id} / ${campanha.slug}`);
} else {
  console.log(`Homologação já existe: ${campanha.id} / ${campanha.slug}`);
  campanha.testKeys = [...new Set([...(campanha.testKeys ?? []), ...DRAFTS.map((d) => d.testKey)])];
  campanha.description =
    "WEB React no Amostra (CQ). Notas parciais + Conteúdo e Frequência nos dois forms (quadro e por turma).";
}

const catalog = await readCatalog(project);
let created = 0;
let updated = 0;

for (const draft of DRAFTS) {
  const existing = findByTestKey(catalog, draft.testKey);
  if (existing) {
    existing.title = draft.title;
    existing.description = draft.description;
    existing.preconditions = draft.preconditions;
    existing.expectedResult = draft.expectedResult;
    existing.steps = draft.steps;
    existing.tags = draft.tags;
    existing.module = draft.module;
    existing.channel = draft.channel;
    existing.platform = draft.platform;
    existing.campaign = CQ_DIARIO_HOMOLOGATION_SLUG;
    existing.homologationId = campanha.id;
    existing.executionMode = draft.executionMode;
    existing.priority = draft.priority;
    if (draft.automation) {
      existing.automation = {
        ...existing.automation,
        ...draft.automation,
        playwright: draft.automation.playwright
          ? { ...existing.automation?.playwright, ...draft.automation.playwright }
          : existing.automation?.playwright,
      };
    }
    appendHistory(existing, {
      at: now,
      actor: "system",
      action: "updated",
      detail: "Seed CQ diário (Notas/Conteúdo/Frequência)",
      meta: { testKey: draft.testKey, homologationId: campanha.id },
    });
    updated++;
  } else {
    const record: TestRecord = {
      ...draft,
      id: nextTestId(project, catalog),
      homologationId: campanha.id,
      evidence: [],
      history: [
        {
          at: now,
          actor: "system",
          action: "test_created",
          detail: "Caso de teste criado (Homologação CQ diário)",
          meta: { testKey: draft.testKey, homologationId: campanha.id },
        },
      ],
    };
    catalog.reports.unshift(record);
    created++;
  }
}

linkTestsToHomologation(catalog, campanha);
appendHomologationHistory(campanha, {
  at: now,
  actor: "system",
  action: "homologation_synced",
  detail: `Checklist CQ diário: ${DRAFTS.length} no escopo · ${created} novo(s) · ${updated} atualizado(s)`,
});

catalog.meta.updatedAt = new Date().toISOString().slice(0, 10);
homCatalog.meta.updatedAt = catalog.meta.updatedAt;

await writeCatalog(project, catalog);
await writeHomologationCatalog(project, homCatalog);

fs.writeFileSync(
  path.join(root, "data/projects/polygonus/tests.json"),
  `${JSON.stringify({ meta: catalog.meta, reports: catalog.reports }, null, 2)}\n`,
);
fs.writeFileSync(
  path.join(root, "data/projects/polygonus/homologations.json"),
  `${JSON.stringify({ meta: homCatalog.meta, homologations: homCatalog.homologations }, null, 2)}\n`,
);

console.log(
  `OK — ${created} criado(s), ${updated} atualizado(s). Abra "${CQ_DIARIO_HOMOLOGATION_SLUG}" no Desk.`,
);
