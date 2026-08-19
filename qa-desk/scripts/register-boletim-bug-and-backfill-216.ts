/**
 * One-shot: registra bug boletim APP WEB + backfill comentário issue #216.
 *   npx tsx scripts/register-boletim-bug-and-backfill-216.ts
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
import { pullGestorCommentsIntoReport } from "../server/github/sync-bug-issue.js";
import type { EvidenceFile, TestRecord } from "../server/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(ROOT, ".env") });

const PROJECT = "polygonus" as const;
const EVIDENCE_SRC = "C:\\Users\\pedro\\.cursor\\projects\\c-Users-pedro-Projetos-Portfolio-Qa-Desk\\assets\\c__Users_pedro_AppData_Roaming_Cursor_User_workspaceStorage_88112ba197803e94bc5cbfd9f675b976_images_image-b1eec459-a653-490b-828d-51ad2222bffb.png";

async function createBoletimBug(): Promise<TestRecord> {
  const catalog = await readCatalog(PROJECT);
  const channel = "app" as const;
  const platform = "web" as const;
  const id = nextBugId(PROJECT, catalog);
  const bugCode = nextBugCode(catalog, channel, platform);
  const now = new Date().toISOString();

  const report: TestRecord = {
    id,
    recordType: "bug",
    title: "Boletim Online (APP WEB): Visualizar PDF lan\u00e7a \u201cUnsupported operation\u2026 n\u00e3o dispon\u00edvel na web\u201d",
    description: "No APP vers\u00e3o WEB, ao abrir Boletim Online como respons\u00e1vel e clicar em Visualizar, o app exibe modal Aten\u00e7\u00e3o com UnsupportedError de PDF no web. Impacto baixo: pais \u201cpuros\u201d em geral n\u00e3o t\u00eam o menu; afeta pais que tamb\u00e9m s\u00e3o colaboradores e tentam ver o boletim no navegador.",
    preconditions: "APP vers\u00e3o WEB (browser Opera); amostra; login PHJESUS com perfil/fun\u00e7\u00e3o de respons\u00e1vel; build 6.06.24.",
    steps: [
      "Abrir o APP na vers\u00e3o WEB (Opera)",
      "Logar como PHJESUS no perfil de respons\u00e1vel",
      "Acessar o menu Boletim Online",
      "Selecionar aluno e per\u00edodo",
      "Clicar em Visualizar",
    ],
    expectedResult:
      "O boletim em PDF abre ou baixa normalmente no navegador.",
    actualResult: "Modal Aten\u00e7\u00e3o: \u201cUnsupported operation: Visualiza\u00e7\u00e3o do boletim em PDF n\u00e3o dispon\u00edvel na web.\u201d",
    reportedAt: now.slice(0, 10),
    project: PROJECT,
    channel,
    platform,
    module: "Boletim Online",
    status: "reportado",
    priority: "baixa",
    severity: "baixa",
    build: "6.06.24",
    browser: "Opera",
    testLogin: "PHJESUS",
    bugCode,
    technicalEvidence:
      "Flutter Web / kIsWeb \u2014 UnsupportedError ao visualizar boletim PDF. Reproduzido em Opera.",
    evidence: [],
    comments: [],
    history: [],
    showInPortfolio: false,
    tags: ["boletim", "app-web", "pdf"],
  };

  appendHistory(report, {
    actor: "Pedro (script)",
    action: "test_created",
    detail: "Bug registrado (APP WEB \u00b7 prioridade baixa)",
  });

  if (fs.existsSync(EVIDENCE_SRC)) {
    const buf = fs.readFileSync(EVIDENCE_SRC);
    const fileId = randomUUID();
    const originalName = "boletim-app-web-unsupported-pdf.png";
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
  return report;
}

async function backfillIssue216(): Promise<void> {
  const catalog = await readCatalog(PROJECT);
  let idx = catalog.reports.findIndex(
    (r) =>
      (r.recordType ?? (r.campaign ? "teste" : "bug")) === "bug" &&
      r.githubIssueNumber === 216,
  );
  if (idx < 0) {
    console.warn("Nenhum bug com githubIssueNumber=216 — tentando APP-02 / FAB rotina");
    idx = catalog.reports.findIndex(
      (r) =>
        r.bugCode === "APP-02" ||
        (Boolean(r.title?.includes("APP WEB")) &&
          Boolean(r.title?.toLowerCase().includes("fab")) &&
          Boolean(r.title?.toLowerCase().includes("rotina"))),
    );
    if (idx < 0) {
      console.warn("APP-02 tambem nao encontrado");
      return;
    }
    const report = catalog.reports[idx]!;
    if (!report.githubIssueNumber) {
      report.githubIssueNumber = 216;
      report.githubIssueUrl =
        "https://github.com/polygonus-br/polygonus-suporte-kb/issues/216";
      console.log("vinculou githubIssueNumber=216 em", report.id, report.bugCode);
    }
  }

  const report = catalog.reports[idx]!;
  const catchup = await pullGestorCommentsIntoReport(report, {
    actor: "Pedro (backfill #216)",
  });
  catalog.reports[idx] = report;
  await writeCatalog(PROJECT, catalog);
  console.log("backfill #216", {
    id: report.id,
    bugCode: report.bugCode,
    status: report.status,
    catchup,
  });
}

async function main() {
  await createBoletimBug();
  await backfillIssue216();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
