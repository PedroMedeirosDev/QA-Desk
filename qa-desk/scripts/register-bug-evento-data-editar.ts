/**
 * One-shot: registra bug edição de data de Evento no Mural (APP WEB).
 *   npx tsx scripts/register-bug-evento-data-editar.ts
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import {
  appendHistory,
  nextBugCode,
  nextBugId,
  readCatalog,
  writeCatalog,
} from "../server/storage.js";
import type { TestRecord } from "../server/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(ROOT, ".env") });

const PROJECT = "polygonus" as const;

async function main() {
  const catalog = await readCatalog(PROJECT);
  const channel = "app" as const;
  const platform = "web" as const;
  const id = nextBugId(PROJECT, catalog);
  const bugCode = nextBugCode(catalog, channel, platform);
  const now = new Date().toISOString();

  const report: TestRecord = {
    id,
    recordType: "bug",
    title:
      "Evento (Mural · APP WEB): editar datas confirma sucesso, mas card e conteúdo mantêm a data original",
    description:
      "Ao editar um Evento já publicado e alterar as datas, o app mostra mensagem de confirmação de que a alteração foi feita. No card do comunicado (lista) e no conteúdo do próprio evento, as datas continuam as originais. O save visualmente “passa”; a persistência/exibição da nova data não.",
    preconditions:
      "APP versão WEB (browser, amostra, iframe Comunicados); login PHJESUS com função COORDENADOR; ao menos um Evento já enviado na lista Enviadas. Build 6.06.23+.",
    steps: [
      "Abrir o APP na versão WEB (browser)",
      "Logar como PHJESUS no perfil COORDENADOR",
      "Abrir Mural / Comunicados e filtrar Enviadas",
      "Abrir o menu ⋮ de um Evento existente e clicar em Editar",
      "Alterar a(s) data(s) do evento",
      "Salvar / enviar a edição",
      "Observar a mensagem de confirmação",
      "Voltar à lista e abrir o card / o conteúdo do evento",
    ],
    expectedResult:
      "As datas novas aparecem no card do comunicado e no conteúdo do evento.",
    actualResult:
      "A UI confirma a alteração, mas o card e o conteúdo do evento mantêm a data original.",
    reportedAt: now.slice(0, 10),
    project: PROJECT,
    channel,
    platform,
    module: "Mural / Eventos",
    status: "reportado",
    priority: "media",
    severity: "media",
    build: "6.06.23+",
    browser: "Opera",
    testLogin: "PHJESUS",
    bugCode,
    technicalEvidence:
      "Flutter Web / iframe Comunicados. Edição de Evento: toast/modal de sucesso sem atualizar data no card nem no detalhe. Possível dessincronia de persistência vs UI (BrasilTime / campo data no PUT). Não aberto GitHub ainda.",
    evidence: [],
    comments: [],
    history: [],
    showInPortfolio: false,
    tags: ["mural", "evento", "data", "editar", "app-web"],
  };

  appendHistory(report, {
    actor: "Pedro (script)",
    action: "test_created",
    detail: "Bug registrado (APP WEB · prioridade média) — issue GitHub não aberta",
  });

  catalog.reports.unshift(report);
  await writeCatalog(PROJECT, catalog);
  console.log("bug criado", { id, bugCode, title: report.title });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
