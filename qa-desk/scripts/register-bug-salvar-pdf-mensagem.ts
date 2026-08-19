/**
 * One-shot: bug Salvar PDF — mensagem técnica vs copy amigável do boleto.
 *   npx tsx scripts/register-bug-salvar-pdf-mensagem.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import {
  appendHistory,
  nextBugCode,
  nextBugId,
  readCatalog,
  writeCatalog,
} from "../server/storage.js";
import {
  makeStoredEvidenceFilename,
  uploadEvidenceBuffer,
} from "../server/supabase-storage.js";
import type { EvidenceFile, TestRecord } from "../server/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(ROOT, ".env") });

const PROJECT = "polygonus" as const;
const EVIDENCE_SRC =
  "C:\\Users\\pedro\\.cursor\\projects\\c-Users-pedro-Projetos-Portfolio-Qa-Desk\\assets\\c__Users_pedro_AppData_Roaming_Cursor_User_workspaceStorage_88112ba197803e94bc5cbfd9f675b976_images_image-30f47784-7089-41d9-bdaf-ae0bc7d90989.png";

async function main() {
  const catalog = await readCatalog(PROJECT);
  const channel = "app" as const;
  const platform = "app_web" as const;
  const id = nextBugId(PROJECT, catalog);
  const bugCode = nextBugCode(catalog, channel, platform);
  const now = new Date().toISOString();

  const report: TestRecord = {
    id,
    recordType: "bug",
    title:
      "Mural (APP e APP WEB): Salvar PDF avulso mostra erro técnico; só Compartilhar funciona",
    description:
      "Não é mais possível Salvar anexos em comunicado com PDF avulso — só Compartilhar. O toast atual vaza exceção Dart: “Erro ao salvar anexos: Invalid argument(s): Illegal percent encoding in URI” (nome com espaço, º, acento, parênteses). A mensagem precisa ser a mesma copy amigável já usada ao salvar anexo de boleto. Reproduzido no App Android e no APP versão WEB.",
    preconditions:
      "Reproduzido no App Android (amostra) e no APP versão WEB (browser, iframe Comunicados). Login PHJESUS COORDENADOR. Comunicado com PDF avulso (ex.: “2º Comunicado JICS 2026 - Camisa e países (3) (1).pdf”). Build 6.06.23+.",
    steps: [
      "Abrir o Mural / Comunicados (App nativo ou APP versão WEB)",
      "Logar como PHJESUS no perfil COORDENADOR",
      "Abrir um comunicado que tenha PDF avulso (não boleto)",
      "Tocar no menu ⋮ do card",
      "Tocar em Salvar anexos",
    ],
    expectedResult:
      "Se Salvar PDF estiver indisponível, mostrar a mesma mensagem amigável do anexo de boleto (sem stack/URI). Compartilhar anexos continua ok.",
    actualResult:
      "Toast: “Erro ao salvar anexos: Invalid argument(s): Illegal percent encoding in URI”. Salvar falha; Compartilhar ainda funciona.",
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
      "Flutter (Android + Web). Salvar anexos monta URI com percent-encoding inválido no filename (espaço, º, acentos, parênteses). Boleto no mesmo menu já trata com mensagem amigável — reutilizar. Canal: App · APP + WEB.",
    evidence: [],
    comments: [],
    history: [],
    showInPortfolio: false,
    tags: ["mural", "pdf", "salvar-anexos", "mensagem", "app-web"],
  };

  appendHistory(report, {
    actor: "Pedro (script)",
    action: "test_created",
    detail: "Bug registrado (APP + WEB · prioridade média) — issue GitHub não aberta",
  });

  if (fs.existsSync(EVIDENCE_SRC)) {
    const buf = fs.readFileSync(EVIDENCE_SRC);
    const fileId = randomUUID();
    const originalName = "mural-salvar-pdf-illegal-percent-encoding.png";
    const storedFilename = makeStoredEvidenceFilename(originalName, fileId);
    const uploaded = await uploadEvidenceBuffer({
      project: PROJECT,
      testId: id,
      buffer: buf,
      originalName,
      mimeType: "image/png",
      storedFilename,
    });
    const evidence: EvidenceFile = {
      fileId,
      type: "screenshot",
      filename: originalName,
      mimeType: "image/png",
      sizeBytes: buf.length,
      uploadedAt: now,
      storageKey: uploaded.storageKey,
    };
    report.evidence = [evidence];
    appendHistory(report, {
      actor: "Pedro (script)",
      action: "evidence_uploaded",
      detail: originalName,
    });
    console.log("evidencia ok", uploaded.storageKey);
  } else {
    console.warn("print nao encontrado:", EVIDENCE_SRC);
  }

  catalog.reports.unshift(report);
  await writeCatalog(PROJECT, catalog);
  console.log("bug criado", { id, bugCode, title: report.title });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
