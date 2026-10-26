import assert from "node:assert/strict";
import { formatBugReportMarkdown } from "../src/lib/bug-report-markdown.js";
import { displayStatus, linkedTestIdOf, type TestRecord } from "../src/types/test-record.js";
import { sanitizeVisitorTestRecord } from "./privacy/sanitize-visitor.js";

// Vínculo com o teste: campo v2 vence; bug antigo cai na tag origem:<id>.
assert.equal(linkedTestIdOf({ linkedTestId: "POLY-CT-9", tags: ["origem:POLY-CT-1"] }), "POLY-CT-9");
assert.equal(linkedTestIdOf({ tags: ["mural", "origem:POLY-CT-1"] }), "POLY-CT-1");
assert.equal(linkedTestIdOf({ tags: ["mural"] }), undefined);
assert.equal(linkedTestIdOf({}), undefined);

const bug: TestRecord = {
  id: "BUG-2026-010",
  recordType: "bug",
  bugCode: "APP-07",
  title: "Mural — anexo PDF some após enviar",
  description: "O anexo não aparece em Enviadas.",
  steps: ["Enviar comunicado com PDF"],
  expectedResult: "Comunicado com o anexo",
  actualResult: "Comunicado sem o anexo",
  reportedAt: "2026-10-26",
  project: "polygonus",
  channel: "app",
  platform: "android",
  status: "em_reteste",
  severity: "baixa",
  priority: "alta",
  reproducibility: "intermitente",
  linkedTestId: "POLY-CT-3",
  linkedRunId: "run-123",
  history: [],
};

// Severidade e prioridade saem separadas no handoff, com o teste de origem.
const md = formatBugReportMarkdown(bug);
assert.match(md, /\*\*Severidade \(impacto\):\*\* Baixa/);
assert.match(md, /\*\*Prioridade \(urgência\):\*\* Alta/);
assert.match(md, /\*\*Reprodutibilidade:\*\* Intermitente/);
assert.match(md, /\*\*Teste de origem:\*\* `POLY-CT-3`/);

// Bug antigo sem prioridade própria: repete a severidade.
assert.match(formatBugReportMarkdown({ ...bug, priority: undefined }), /\*\*Prioridade \(urgência\):\*\* Baixa/);

// Ciclo de vida v2.
assert.deepEqual(displayStatus(bug), { label: "Em reteste", tone: "warn" });
assert.deepEqual(displayStatus({ ...bug, status: "reaberto" }), { label: "Reaberto", tone: "fail" });
assert.deepEqual(displayStatus({ ...bug, status: "homologado" }), { label: "Fechado", tone: "ok" });

// Visitante: vê o vínculo e a reprodutibilidade, não a execução interna.
const publico = sanitizeVisitorTestRecord(bug);
assert.equal(publico.reproducibility, "intermitente");
assert.equal(publico.linkedTestId, "POLY-CT-3");
assert.equal(publico.linkedRunId, undefined);

console.log("bug-v2: ok");
