/**
 * One-shot: Rotina (App e APP WEB) — horário do card em UTC.
 *   Já rodado (criou APP-07). Recategorização: scripts/update-app-07-app-e-web.ts
 *   npx tsx scripts/register-bug-rotina-horario-utc.ts
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
import { makeStoredEvidenceFilename, uploadEvidenceBuffer } from "../server/supabase-storage.js";
import type { EvidenceFile, TestRecord } from "../server/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(ROOT, ".env") });

const PROJECT = "polygonus" as const;
const EVIDENCE_SRC =
  "C:\\Users\\pedro\\.cursor\\projects\\c-Users-pedro-Projetos-Portfolio-Qa-Desk\\assets\\c__Users_pedro_AppData_Roaming_Cursor_User_workspaceStorage_88112ba197803e94bc5cbfd9f675b976_images_image-c7c7866a-9b4f-4c2c-9ace-77aa993a04fc.png";

async function main() {
  const catalog = await readCatalog(PROJECT);
  if (catalog.reports.some((r) => r.bugCode === "APP-07")) {
    throw new Error("APP-07 já existe — use scripts/update-app-07-app-e-web.ts");
  }
  const channel = "app" as const;
  const platform = "app_web" as const;
  const id = nextBugId(PROJECT, catalog);
  const bugCode = nextBugCode(catalog, channel, platform);
  const now = new Date().toISOString();

  const report: TestRecord = {
    id,
    recordType: "bug",
    title:
      "Rotina (Mural · App e APP WEB): horário do card em UTC (3h à frente do GMT-3)",
    description:
      "Na lista da aba Rotina (APP versão WEB), o horário ao lado do título do card (Soneca, Banheiro…) aparece 3 horas à frente do horário real de lançamento. Os chips de horário da própria rotina (ex.: 14:20 na Soneca) continuam corretos em GMT-3. Padrão UTC vs America/Sao_Paulo — mesmo desvio de ~3h já visto em comunicado (“há 3h”) e POL-11 (chat).",
    preconditions:
      "APP versão WEB (browser, amostra). URL: https://amostra.polygonus.com.br/web/react/gestao → iframe Flutter. Login PHJESUS, função COORDENADOR. Relógio do PC em GMT-3. Homologação Rotina 13/08/2026 (Playwright CT-ROTINA-02/03).",
    steps: [
      "Abrir o APP na versão WEB (browser, amostra)",
      "Logar como PHJESUS no perfil COORDENADOR",
      "Abrir Mural → aba Rotina",
      "Lançar uma rotina nova (ex.: Soneca Dormiu/Bem ou Banheiro Xixi/No vaso) e anotar o horário local do envio",
      "Voltar à lista Recebidas do dia e ler o horário ao lado do título do card",
    ],
    expectedResult:
      "O horário do cabeçalho do card (datRegistro) coincide com o instante local do lançamento em America/Sao_Paulo (ex.: envio às 14:20 → card 14:20).",
    actualResult:
      "Cabeçalho do card em UTC: Soneca 17:20 com chip 14:20; Banheiro 17:15; outra Soneca 17:14 com chip 14:15. Desvio fixo de +3h. Lançamentos feitos por volta das 14:15–14:20 (GMT-3) na homologação WEB.",
    reportedAt: now.slice(0, 10),
    project: PROJECT,
    channel,
    platform,
    module: "Rotina (Mural)",
    status: "reportado",
    priority: "media",
    severity: "media",
    build: "amostra WEB 13/08/2026",
    browser: "Chrome (Playwright headed)",
    testLogin: "PHJESUS",
    bugCode,
    technicalEvidence:
      "Flutter Web / iframe. Card: lib/rotina/widgets/rotina_card.dart — cabeçalho usa registro.datRegistro.hour/.minute sem toLocal(). Parse: DateTime.tryParse(json['datRegistro']) em rotina_registro.dart. Se a API manda RFC3339 com Z, .hour fica em UTC (17:20) e o chip TipResposta.horario (14:20) segue o valor da pergunta, não o datRegistro. Conferir JSON bruto de datRegistro no feed. Não conferido no App nativo neste ciclo (mesmo widget). Relacionado: CT mural “há 3h” e POL-11.",
    evidence: [],
    comments: [],
    history: [],
    showInPortfolio: false,
    tags: ["rotina", "fuso-horario", "utc", "app-web", "mural"],
  };

  appendHistory(report, {
    actor: "Pedro (script)",
    action: "test_created",
    detail: "Bug registrado (APP WEB · horário UTC no card de rotina)",
  });

  if (fs.existsSync(EVIDENCE_SRC)) {
    const buf = fs.readFileSync(EVIDENCE_SRC);
    const fileId = randomUUID();
    const originalName = "rotina-app-web-horario-utc.png";
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
