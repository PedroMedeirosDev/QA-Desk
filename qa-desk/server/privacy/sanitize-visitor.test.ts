import assert from "node:assert/strict";
import {
  abbreviatePersonName,
  maskEmail,
  sanitizeVisitorData,
  sanitizeVisitorTestRecord,
} from "./sanitize-visitor.js";
import type { TestRecord } from "../types.js";

assert.equal(maskEmail("jose@escola.com.br"), "j****@escola.com.br");
assert.equal(abbreviatePersonName("João da Silva"), "João S.");
assert.equal(abbreviatePersonName("Ana"), "Ana");

const scrubbed = sanitizeVisitorData({
  note: "Contato jose@escola.com.br CPF 529.982.247-25 tel (11) 98765-4321",
  actor: "Pedro Medeiros",
});
assert.match(String((scrubbed as { note: string }).note), /j\*\*\*\*@escola\.com\.br/);
assert.match(String((scrubbed as { note: string }).note), /\[CONFIDENCIAL\]/);
assert.equal((scrubbed as { actor: string }).actor, "Pedro M.");

const record = sanitizeVisitorTestRecord({
  id: "POLY-CT-1",
  title: "Login",
  description: "User mail@corp.com",
  reportedAt: "2026-01-01",
  project: "polygonus",
  platform: "android",
  status: "rascunho",
  history: [
    {
      at: "2026-01-01T00:00:00.000Z",
      actor: "Admin Full",
      action: "updated",
      detail: "segredo token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb",
    },
  ],
  automation: { flowPath: "secret.yaml" },
  technicalEvidence: "adb log",
  comments: [{ at: "x", author: "A", text: "interno" }],
  showInPortfolio: true,
  steps: ["abrir app"],
} as TestRecord);

assert.equal(record.showInPortfolio, true);
assert.equal(record.history.length, 0);
assert.equal(record.automation, undefined);
assert.equal(record.technicalEvidence, undefined);
assert.equal(record.comments, undefined);
assert.match(record.description ?? "", /m\*\*\*\*@corp\.com/);

console.log("all sanitize-visitor tests passed");
