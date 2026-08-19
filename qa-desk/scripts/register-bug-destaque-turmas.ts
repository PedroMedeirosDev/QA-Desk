/**
 * One-shot: registra bug Destaque some filtro de turmas (APP + APP WEB).
 *   npx tsx scripts/register-bug-destaque-turmas.ts
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
      "Mural (APP e APP WEB): filtro de turmas some ao marcar Destaque nas opções do envio",
    description:
      "No composer de Novo comunicado, ao abrir a engrenagem (opções) e marcar Destaque (ex.: 1 dia), o filtro/seletor de turmas desaparece da UI. O envio continua funcionando. Se as turmas já tinham sido filtradas/selecionadas antes, o comunicado ainda chega a essas turmas — só a UI some. Reproduzido no App Android e no APP versão WEB (mesmo Flutter).",
    preconditions:
      "Reproduzido no App Android (amostra) e no APP versão WEB (browser, iframe Comunicados). Login PHJESUS com função COORDENADOR. Build 6.06.23+.",
    steps: [
      "Abrir o Mural / Comunicados (App nativo ou APP versão WEB)",
      "Logar como PHJESUS no perfil COORDENADOR",
      "Abrir Novo comunicado",
      "Selecionar/filtrar turmas (opcional — para confirmar que o envio ainda respeita a seleção)",
      "Tocar na engrenagem (opções do envio)",
      "Marcar Destaque por 1 dia",
      "Fechar as opções e observar o composer (campo/filtro de turmas)",
    ],
    expectedResult:
      "O filtro/seletor de turmas permanece visível no composer após marcar Destaque.",
    actualResult:
      "O filtro de turmas desaparece da UI. O envio funciona; com turmas já selecionadas, o comunicado ainda chega a essas turmas.",
    reportedAt: now.slice(0, 10),
    project: PROJECT,
    channel,
    platform,
    module: "Mural / Comunicados",
    status: "reportado",
    priority: "media",
    severity: "media",
    build: "6.06.23+",
    browser: "Opera",
    testLogin: "PHJESUS",
    bugCode,
    technicalEvidence:
      "Flutter (Android + Flutter Web / kIsWeb). Composer de comunicado: opções (engrenagem) → Destaque. O estado das turmas permanece no envio; só a UI do filtro some. Canal Desk: App · plataforma web (APP WEB) com reprodução também no App nativo.",
    evidence: [],
    comments: [],
    history: [],
    showInPortfolio: false,
    tags: ["mural", "comunicados", "destaque", "turma", "app-web"],
  };

  appendHistory(report, {
    actor: "Pedro (script)",
    action: "test_created",
    detail: "Bug registrado (APP + APP WEB · prioridade média) — issue GitHub não aberta",
  });

  catalog.reports.unshift(report);
  await writeCatalog(PROJECT, catalog);
  console.log("bug criado", { id, bugCode, title: report.title });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
