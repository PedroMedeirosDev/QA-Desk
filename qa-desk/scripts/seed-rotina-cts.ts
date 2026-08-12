/**
 * Cria CTs Rotina no catálogo Desk (aparecem no canal App · módulo Rotina).
 * Uso: npx tsx scripts/seed-rotina-cts.ts
 */
import { loadEnv } from "../server/load-env.ts";
loadEnv();

import {
  appendHistory,
  nextTestId,
  readCatalog,
  writeCatalog,
} from "../server/storage.ts";
import type { TestRecord } from "../server/types.ts";

const ITEMS = [
  {
    ctId: "ROTINA-01",
    title: "ROTINA-01 · Alimentação",
    suite: "Alimentacao",
    flowPath:
      "projects/polygonus/automation/maestro/flows/rotina/01_2_1_rotina_alimentacao.yaml",
    description:
      "Aba Rotina do Mural: registrar alimentação via BoomMenu (APP mobile / emulador).",
    steps: [
      "PHJESUS coordenador → Mural → aba Rotina",
      "FAB → Alimentação",
      "Selecionar turma/aluno (TURMA_ROTINA / ALUNO_ROTINA) e enviar",
    ],
  },
  {
    ctId: "ROTINA-02",
    title: "ROTINA-02 · Soneca",
    suite: "Soneca",
    flowPath:
      "projects/polygonus/automation/maestro/flows/rotina/01_2_1_rotina_soneca.yaml",
    description: "Aba Rotina: registrar soneca via BoomMenu.",
    steps: [
      "PHJESUS coordenador → Mural → aba Rotina",
      "FAB → Soneca",
      "Selecionar turma/aluno e enviar",
    ],
  },
  {
    ctId: "ROTINA-03",
    title: "ROTINA-03 · Banheiro",
    suite: "Banheiro",
    flowPath:
      "projects/polygonus/automation/maestro/flows/rotina/01_2_1_rotina_banheiro.yaml",
    description: "Aba Rotina: registrar banheiro via BoomMenu.",
    steps: [
      "PHJESUS coordenador → Mural → aba Rotina",
      "FAB → Banheiro",
      "Selecionar turma/aluno e enviar",
    ],
  },
  {
    ctId: "ROTINA-04",
    title: "ROTINA-04 · Bilhete",
    suite: "Bilhete",
    flowPath:
      "projects/polygonus/automation/maestro/flows/rotina/01_2_4_bilhete_enviar.yaml",
    description: "Aba Rotina: enviar bilhete via BoomMenu.",
    steps: [
      "PHJESUS coordenador → Mural → aba Rotina",
      "FAB → Bilhete",
      "Escrever mensagem assinada e enviar",
    ],
  },
] as const;

const catalog = await readCatalog("polygonus");
const now = new Date().toISOString().slice(0, 10);
let created = 0;
let skipped = 0;

for (const item of ITEMS) {
  const testKey = `rotina/${item.ctId.toLowerCase()}`;
  const exists = catalog.reports.find(
    (r) =>
      r.testKey === testKey ||
      r.automation?.flowPath?.replace(/\\/g, "/") === item.flowPath,
  );
  if (exists) {
    console.log("skip", exists.id, exists.title);
    skipped++;
    continue;
  }

  const id = nextTestId("polygonus", catalog);
  const report: TestRecord = {
    id,
    testKey,
    recordType: "teste",
    title: item.title,
    description: item.description,
    steps: [...item.steps],
    expectedResult: "Registro criado na aba Rotina sem acionar FAB indevido.",
    reportedAt: now,
    project: "polygonus",
    channel: "app",
    platform: "android",
    module: "Rotina",
    status: "rascunho",
    homologationStatus: "pendente",
    executionMode: "automated",
    priority: "media",
    evidence: [],
    comments: [],
    history: [],
    showInPortfolio: false,
    automation: {
      type: "maestro",
      flowPath: item.flowPath,
      label: item.ctId,
      readiness: "draft",
    },
    tags: [
      "rotina",
      "mural",
      "module:Rotina",
      `suite:${item.suite}`,
      `ct:${item.ctId}`,
      "maestro",
    ],
  };

  appendHistory(report, {
    actor: "system",
    action: "test_created",
    detail: "CT Rotina seed (flows Maestro)",
    meta: { testKey, flowPath: item.flowPath },
  });
  catalog.reports.unshift(report);
  created++;
  console.log("create", id, item.title);
}

if (created > 0) {
  await writeCatalog("polygonus", catalog);
}
console.log({ created, skipped, totalReports: catalog.reports.length });
