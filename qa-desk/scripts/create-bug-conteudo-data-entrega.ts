/**
 * Bug App: seletor de data de entrega vazio (6.06.35) + vínculo na HOM atual.
 *
 *   cd qa-desk
 *   npx tsx scripts/create-bug-conteudo-data-entrega.ts
 */
import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "../server/load-env.ts";

loadEnv();

import {
  appendHomologationHistory,
  findHomologationBySlug,
  linkTestsToHomologation,
  readHomologationCatalog,
  writeHomologationCatalog,
} from "../server/homologations.ts";
import {
  appendHistory,
  nextBugCode,
  nextBugId,
  readCatalog,
  writeCatalog,
} from "../server/storage.ts";
import type { TestRecord } from "../server/types.ts";

const project = "polygonus" as const;
const SLUG = "inconsistencias-diario-tarefas-notas-24-08";
const testKey = "academico/bug-app-conteudo-data-entrega";
const now = new Date().toISOString();
const reportedAt = now.slice(0, 10);

const srcImg = path.resolve(
  "C:/Users/PEDRO/.cursor/projects/c-projetos-QA-DESK-QA-Desk/assets/c__Users_PEDRO_AppData_Roaming_Cursor_User_workspaceStorage_7da2fed2e726108922ad505034e5a436_images_image-0569d330-d9c2-4782-982b-abf8fa73c272.png",
);

async function main() {
  if (!fs.existsSync(srcImg)) {
    throw new Error(`Print não encontrado: ${srcImg}`);
  }

  const catalog = await readCatalog(project);
  const existing = catalog.reports.find((r) => r.testKey === testKey);
  if (existing) {
    console.log(`Já existe ${existing.id} (${existing.bugCode})`);
    return;
  }

  const id = nextBugId(project, catalog);
  const bugCode = nextBugCode(catalog, "app", "android");
  const filename = "seletor-data-entrega-vazio.png";
  const uploadsDir = path.resolve("data/uploads", project, id);
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.copyFileSync(srcImg, path.join(uploadsDir, filename));
  const storageKey = `uploads/${project}/${id}/${filename}`;
  const sizeBytes = fs.statSync(path.join(uploadsDir, filename)).size;

  const report: TestRecord = {
    id,
    testKey,
    recordType: "bug",
    bugCode,
    title:
      "Conteúdo/Tarefas: seletor de data de entrega vazio (datas não exibidas)",
    description:
      "No App amostra, ao lançar Conteúdo/Tarefas, o modal “Selecione a data de entrega” aparece sem datas (faixa cinza vazia). Impede concluir o lançamento. Ocorre na build 6.06.35; não ocorre na versão da loja. Relato Discord: Pedro Medeiros — 10:32.",
    preconditions:
      "App amostra Android build 6.06.35 (não a da loja). Login PHJESUS (relatado como OPHJESUS), perfil PROFESSOR.",
    steps: [
      "Abrir o App amostra (build 6.06.35)",
      "Entrar com PHJESUS e garantir perfil PROFESSOR",
      "Abrir fluxo de Conteúdo / Tarefas (lançamento)",
      "Preencher conteúdo e tarefa",
      "Abrir a seleção de data de entrega",
      "Observar o modal: área do date picker sem datas",
    ],
    expectedResult:
      "O seletor exibe datas selecionáveis e permite confirmar a data de entrega.",
    actualResult:
      "Modal “Selecione a data de entrega” com faixa cinza vazia; CANCELAR/OK sem calendário/datas. Bloqueia o lançamento.",
    reportedAt,
    project,
    channel: "app",
    platform: "android",
    module: "Diário",
    status: "reportado",
    executionMode: "manual",
    priority: "alta",
    severity: "alta",
    build: "6.06.35",
    testLogin: "PHJESUS",
    deviceLabel: "App amostra (print do relato)",
    campaign: SLUG,
    tags: [
      "bug",
      "app",
      "conteudo",
      "tarefas",
      "date-picker",
      SLUG,
      "module:Diário",
      "build:6.06.35",
    ],
    technicalEvidence:
      "Print: modal Selecione a data de entrega sem conteúdo no date picker. Regressão só na 6.06.35 (loja OK).",
    evidence: [
      {
        fileId: crypto.randomUUID(),
        type: "screenshot",
        filename,
        mimeType: "image/png",
        sizeBytes,
        uploadedAt: now,
        storageKey,
      },
    ],
    comments: [],
    history: [],
    showInPortfolio: false,
  };

  appendHistory(report, {
    at: now,
    actor: "Pedro",
    action: "test_created",
    detail: "Bug registrado a partir do relato Discord + print (build 6.06.35)",
  });

  const homCatalog = await readHomologationCatalog(project);
  const hom = findHomologationBySlug(homCatalog, SLUG);
  if (!hom) throw new Error(`Homologação não encontrada: ${SLUG}`);

  report.homologationId = hom.id;
  // Bug NÃO entra em testKeys — aparece na seção "Bugs encontrados" via homologationId.
  catalog.reports.unshift(report);
  linkTestsToHomologation(catalog, hom);
  appendHomologationHistory(hom, {
    actor: "Pedro",
    action: "updated",
    detail: `Vinculado ${bugCode}: seletor de data de entrega vazio (6.06.35)`,
  });

  await writeCatalog(project, catalog);
  await writeHomologationCatalog(project, homCatalog);

  console.log(
    JSON.stringify(
      {
        id,
        bugCode,
        testKey,
        homologation: hom.id,
        slug: SLUG,
        uiBug: `http://localhost:5174/projects/polygonus/app/bugs/${id}`,
        uiHom: `http://localhost:5174/projects/polygonus/homologacoes/${SLUG}`,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
