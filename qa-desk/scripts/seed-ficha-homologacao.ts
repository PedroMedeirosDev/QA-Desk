/**
 * Cria/atualiza a homologação Ficha Acadêmica + CTs (Playwright).
 *
 *   cd qa-desk
 *   npx tsx scripts/seed-ficha-homologacao.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "../server/load-env.ts";

loadEnv();

import { FICHA_HOMOLOGATION_SLUG } from "../server/homologation-config.ts";
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
  smoke:
    "projects/polygonus/automation/playwright/academico/ui/ficha-abrir-novo.spec.ts",
  dados:
    "projects/polygonus/automation/playwright/academico/ui/ficha-dados-principais.spec.ts",
  matricula:
    "projects/polygonus/automation/playwright/academico/ui/ficha-matricula-cascata.spec.ts",
  e2e: "projects/polygonus/automation/playwright/academico/ui/ficha-e2e-novo-aluno.spec.ts",
} as const;

const DRAFTS: Array<
  Omit<TestRecord, "id" | "history" | "evidence"> & { testKey: string }
> = [
  {
    testKey: "academico/ficha-01",
    recordType: "teste",
    title: "FICHA-01 · Abrir ficha (novo aluno)",
    description:
      "Smoke Web: login amostra CQ → Acadêmico/Novo aluno → formulário monta + GET /academico/aluno/contexto 200 + fill enxuto (sem Gravar).",
    preconditions:
      "PLAYWRIGHT_* no .env (URL amostra CQ :8443, SUPPETER); Chrome; Cloudflare ok.",
    expectedResult:
      "Contexto 200; âncoras da ficha; Nome preenchido via massa-br.",
    steps: [
      "Abrir amostra CQ e autenticar (SUPPETER)",
      "Ir em /academico/alunos/novo",
      "Assert GET /academico/aluno/contexto + UI + smoke fill",
    ],
    reportedAt,
    project,
    channel: "web",
    platform: "web",
    module: "Acadêmico",
    status: "rascunho",
    homologationStatus: "pendente",
    executionMode: "automated",
    priority: "alta",
    campaign: FICHA_HOMOLOGATION_SLUG,
    automation: {
      type: "playwright",
      label: "FICHA-01",
      playwright: {
        specPath: SPEC.smoke,
        headed: true,
        readiness: "draft",
      },
    },
    tags: [
      "homologacao",
      "academico",
      "ficha",
      FICHA_HOMOLOGATION_SLUG,
      "module:Acadêmico",
      "suite:Smoke",
      "ct:FICHA-01",
    ],
    showInPortfolio: false,
  },
  {
    testKey: "academico/ficha-02",
    recordType: "teste",
    title: "FICHA-02 · Buscar aluno existente",
    description:
      "Abrir lista de alunos, buscar por nome/código e abrir ficha de um aluno já cadastrado (sem gravar).",
    preconditions: "Sessão amostra CQ; aluno de demonstração conhecido.",
    expectedResult: "Ficha abre com dados do aluno; contexto/aluno id ok.",
    steps: [
      "Acadêmico → Alunos → buscar",
      "Abrir ficha do aluno",
      "Validar cabeçalho / dados principais (somente leitura nesta rodada)",
    ],
    reportedAt,
    project,
    channel: "web",
    platform: "web",
    module: "Acadêmico",
    status: "rascunho",
    homologationStatus: "pendente",
    executionMode: "manual",
    priority: "media",
    campaign: FICHA_HOMOLOGATION_SLUG,
    tags: [
      "homologacao",
      "academico",
      "ficha",
      FICHA_HOMOLOGATION_SLUG,
      "module:Acadêmico",
      "suite:Consulta",
      "ct:FICHA-02",
    ],
    showInPortfolio: false,
  },
  {
    testKey: "academico/ficha-10",
    recordType: "teste",
    title: "FICHA-10 · Dados Principais — fill completo",
    description:
      "Preenche todas as seções aplicáveis da aba Dados Principais com massa brasileira (massa-br). Não grava.",
    preconditions: "PLAYWRIGHT_* amostra CQ; Chrome headed.",
    expectedResult:
      "Nome + CPF/DN e demais campos preenchidos sem erro de UI; sem Gravar.",
    steps: [
      "Login SUPPETER → Novo aluno",
      "Fill: pessoa, aluno, endereço (ViaCEP), contatos, profissionais, avaliação médica",
      "Assert Nome e campos críticos",
    ],
    reportedAt,
    project,
    channel: "web",
    platform: "web",
    module: "Acadêmico",
    status: "rascunho",
    homologationStatus: "pendente",
    executionMode: "automated",
    priority: "alta",
    campaign: FICHA_HOMOLOGATION_SLUG,
    automation: {
      type: "playwright",
      label: "FICHA-10",
      playwright: {
        specPath: SPEC.dados,
        headed: true,
        readiness: "draft",
      },
    },
    tags: [
      "homologacao",
      "academico",
      "ficha",
      FICHA_HOMOLOGATION_SLUG,
      "module:Acadêmico",
      "suite:Cadastro",
      "ct:FICHA-10",
    ],
    showInPortfolio: false,
  },
  {
    testKey: "academico/ficha-20",
    recordType: "teste",
    title: "FICHA-20 · Família (parentesco mínimo)",
    description:
      "Após aluno gravado: aba Família — vínculo mínimo de responsável (draft).",
    preconditions: "Aluno existente ou criado no E2E.",
    expectedResult: "Editor de parentesco abre e aceita vínculo básico.",
    steps: [
      "Abrir ficha em edição",
      "Aba Família → adicionar responsável",
      "Validar listagem (sem obrigar Gravar nesta rodada)",
    ],
    reportedAt,
    project,
    channel: "web",
    platform: "web",
    module: "Acadêmico",
    status: "rascunho",
    homologationStatus: "pendente",
    executionMode: "manual",
    priority: "media",
    campaign: FICHA_HOMOLOGATION_SLUG,
    tags: [
      "homologacao",
      "academico",
      "ficha",
      FICHA_HOMOLOGATION_SLUG,
      "module:Acadêmico",
      "suite:Familia",
      "ct:FICHA-20",
    ],
    showInPortfolio: false,
  },
  {
    testKey: "academico/ficha-30",
    recordType: "teste",
    title: "FICHA-30 · Matrícula — cascata",
    description:
      "Self-setup aluno → aba Matrícula: Curso → Grade → Período → Turma → Turno populam. Não grava matrícula; exclui aluno no finally.",
    preconditions: "PLAYWRIGHT_* amostra CQ; unidade com grades/turmas.",
    expectedResult: "Combos da cascata selecionáveis sem erro de API.",
    steps: [
      "Criar aluno mínimo e Gravar",
      "Aba Matrícula → selecionar 1ª opção de cada nível",
      "Excluir aluno (cleanup)",
    ],
    reportedAt,
    project,
    channel: "web",
    platform: "web",
    module: "Acadêmico",
    status: "rascunho",
    homologationStatus: "pendente",
    executionMode: "automated",
    priority: "alta",
    campaign: FICHA_HOMOLOGATION_SLUG,
    automation: {
      type: "playwright",
      label: "FICHA-30",
      playwright: {
        specPath: SPEC.matricula,
        headed: true,
        readiness: "draft",
      },
    },
    tags: [
      "homologacao",
      "academico",
      "ficha",
      FICHA_HOMOLOGATION_SLUG,
      "module:Acadêmico",
      "suite:Matricula",
      "ct:FICHA-30",
    ],
    showInPortfolio: false,
  },
  {
    testKey: "academico/ficha-03",
    recordType: "teste",
    title: "FICHA-03 · Aba Matrícula (legado → ver FICHA-30)",
    description:
      "Substituído por FICHA-30 (cascata automatizada). Mantido no catálogo como referência.",
    preconditions: "Ver academico/ficha-30.",
    expectedResult: "Usar FICHA-30.",
    steps: ["Ver CT FICHA-30"],
    reportedAt,
    project,
    channel: "web",
    platform: "web",
    module: "Acadêmico",
    status: "rascunho",
    homologationStatus: "pendente",
    executionMode: "manual",
    priority: "baixa",
    campaign: FICHA_HOMOLOGATION_SLUG,
    tags: [
      "homologacao",
      "academico",
      "ficha",
      FICHA_HOMOLOGATION_SLUG,
      "module:Acadêmico",
      "suite:Matricula",
      "ct:FICHA-03",
      "legado",
    ],
    showInPortfolio: false,
  },
  {
    testKey: "academico/ficha-90",
    recordType: "teste",
    title: "FICHA-90 · E2E novo aluno (grava + limpa)",
    description:
      "Orquestra: fill completo (massa-br) → Gravar → abas liberadas → cascata matrícula (sem gravar matrícula) → Excluir no finally. PLAYWRIGHT_FICHA_KEEP=1 pula exclusão.",
    preconditions: "PLAYWRIGHT_* amostra CQ; Chrome.",
    expectedResult:
      "Aluno criado, Família/Matrícula habilitadas, aluno removido ao final (salvo KEEP).",
    steps: [
      "Fill Dados Principais completo",
      "Gravar → assert Ficha Acadêmica",
      "Abrir Família + Matrícula (cascata)",
      "Excluir (escopo todos os cadastros) no finally",
    ],
    reportedAt,
    project,
    channel: "web",
    platform: "web",
    module: "Acadêmico",
    status: "rascunho",
    homologationStatus: "pendente",
    executionMode: "automated",
    priority: "alta",
    campaign: FICHA_HOMOLOGATION_SLUG,
    automation: {
      type: "playwright",
      label: "FICHA-90",
      playwright: {
        specPath: SPEC.e2e,
        headed: true,
        readiness: "draft",
      },
    },
    tags: [
      "homologacao",
      "academico",
      "ficha",
      FICHA_HOMOLOGATION_SLUG,
      "module:Acadêmico",
      "suite:E2E",
      "ct:FICHA-90",
    ],
    showInPortfolio: false,
  },
];

const homCatalog = await readHomologationCatalog(project);
let ficha = findHomologationBySlug(homCatalog, FICHA_HOMOLOGATION_SLUG);

if (!ficha) {
  ficha = createHomologation(homCatalog, {
    project,
    title: "Homologação Ficha Acadêmica",
    description:
      "Smoke + Cadastro + Matrícula + E2E Web da Ficha Acadêmica (amostra CQ) via Playwright / massa-br.",
    channel: "web",
    changeScope: "backend",
    testKeys: DRAFTS.map((d) => d.testKey),
  });
  ficha.slug = FICHA_HOMOLOGATION_SLUG;
  ficha.campaign = FICHA_HOMOLOGATION_SLUG;
  console.log(`Homologação criada: ${ficha.id} / ${ficha.slug}`);
} else {
  console.log(`Homologação já existe: ${ficha.id} / ${ficha.slug}`);
  const keys = new Set([
    ...(ficha.testKeys ?? []),
    ...DRAFTS.map((d) => d.testKey),
  ]);
  ficha.testKeys = [...keys];
  ficha.description =
    "Smoke + Cadastro + Matrícula + E2E Web da Ficha Acadêmica (amostra CQ) via Playwright / massa-br.";
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
    existing.campaign = FICHA_HOMOLOGATION_SLUG;
    existing.homologationId = ficha.id;
    existing.executionMode = draft.executionMode;
    existing.priority = draft.priority;
    if (draft.automation) {
      existing.automation = {
        ...existing.automation,
        ...draft.automation,
        playwright: draft.automation.playwright
          ? {
              ...existing.automation?.playwright,
              ...draft.automation.playwright,
            }
          : existing.automation?.playwright,
      };
    }
    appendHistory(existing, {
      at: now,
      actor: "system",
      action: "updated",
      detail: "Seed Ficha Acadêmica (suite smoke/cadastro/matricula/e2e)",
      meta: {
        testKey: draft.testKey,
        homologationId: ficha.id,
        homologationSlug: FICHA_HOMOLOGATION_SLUG,
      },
    });
    updated++;
  } else {
    const record: TestRecord = {
      ...draft,
      id: nextTestId(project, catalog),
      homologationId: ficha.id,
      evidence: [],
      history: [
        {
          at: now,
          actor: "system",
          action: "test_created",
          detail: "Caso de teste criado (Homologação Ficha Acadêmica)",
          meta: {
            testKey: draft.testKey,
            homologationId: ficha.id,
            homologationSlug: FICHA_HOMOLOGATION_SLUG,
          },
        },
      ],
    };
    catalog.reports.unshift(record);
    created++;
  }
}

linkTestsToHomologation(catalog, ficha);
appendHomologationHistory(ficha, {
  at: now,
  actor: "system",
  action: "homologation_synced",
  detail: `Checklist Ficha: ${DRAFTS.length} no escopo · ${created} novo(s) · ${updated} atualizado(s)`,
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
  `OK — ${created} criado(s), ${updated} atualizado(s). Abra a homologação "${FICHA_HOMOLOGATION_SLUG}" no Desk.`,
);
