/**
 * Sanitização de payload para o perfil visitante (portfólio público).
 * Sempre no backend — o browser nunca deve ver o dado bruto na Network.
 *
 * Regras:
 * - e-mails mascarados (j****@empresa.com)
 * - CPF/CNPJ/telefone/tokens → [CONFIDENCIAL]
 * - nomes próprios abreviados (João S.) quando detectáveis em campos de ator/autor
 * - campos operacionais sensíveis removidos do CT (logs, automação interna, etc.)
 */

import { redactPiiDeep } from "./redact-pii.js";
import type { TestCatalog, TestRecord } from "../types.js";

const EMAIL_RE =
  /\b([A-Za-z0-9])[A-Za-z0-9._%+-]*@([A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,})\b/g;

const TOKENISH_RE =
  /\b(?:Bearer\s+)?[A-Za-z0-9_-]{20,}(?:\.[A-Za-z0-9_-]+){2,}\b/g;

const CONFIDENTIAL = "[CONFIDENCIAL]";

/** j****@empresa.com */
export function maskEmail(email: string): string {
  const m = email.trim().match(/^([A-Za-z0-9])([A-Za-z0-9._%+-]*)@(.+)$/);
  if (!m) return CONFIDENTIAL;
  return `${m[1]}****@${m[3]}`;
}

/** "João da Silva" → "João S." | "Ana" → "Ana" */
export function abbreviatePersonName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return name;
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const last = parts[parts.length - 1];
  const initial = last.charAt(0).toUpperCase();
  return `${first} ${initial}.`;
}

function scrubString(input: string): string {
  if (!input) return input;

  // 1) Mascarar e-mails primeiro (e proteger o resultado)
  const preserved: string[] = [];
  let out = input.replace(EMAIL_RE, (_full, first: string, domain: string) => {
    const masked = `${first}****@${domain}`;
    const idx = preserved.length;
    preserved.push(masked);
    return `@@EMAIL${idx}@@`;
  });

  out = out.replace(TOKENISH_RE, CONFIDENTIAL);

  // 2) CPF / CNPJ / telefone via redact-pii (e-mails já protegidos)
  out = String(redactPiiDeep(out))
    .replace(/\[CPF\]/g, CONFIDENTIAL)
    .replace(/\[CNPJ\]/g, CONFIDENTIAL)
    .replace(/\[TELEFONE\]/g, CONFIDENTIAL)
    .replace(/\[EMAIL\]/g, CONFIDENTIAL);

  // 3) Restaurar e-mails mascarados
  preserved.forEach((masked, i) => {
    out = out.replace(`@@EMAIL${i}@@`, masked);
  });

  return out;
}

function scrubDeep<T>(value: T): T {
  if (value == null) return value;
  if (typeof value === "string") return scrubString(value) as T;
  if (Array.isArray(value)) return value.map((item) => scrubDeep(item)) as T;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = scrubDeep(v);
    }
    return out as T;
  }
  return value;
}

const ACTOR_KEYS = new Set([
  "actor",
  "author",
  "reviewer",
  "displayName",
  "name",
]);

function scrubActors<T>(value: T): T {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map((item) => scrubActors(item)) as T;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (ACTOR_KEYS.has(k) && typeof v === "string" && v.trim() && !v.includes("@")) {
        out[k] = abbreviatePersonName(v);
      } else {
        out[k] = scrubActors(v);
      }
    }
    return out as T;
  }
  return value;
}

/**
 * Projeta um CT/bug para o portfólio: só campos seguros + PII scrubbed.
 * `showInPortfolio` é forçado a true (já filtrado no backend).
 */
export function sanitizeVisitorTestRecord(report: TestRecord): TestRecord {
  const isBug =
    (report.recordType ?? (report.campaign ? "teste" : "bug")) === "bug";

  const base: TestRecord = {
    id: report.id,
    testKey: report.testKey,
    recordType: report.recordType,
    title: report.title,
    // Bugs: description = citação do chamado (operacional) — fora do portfólio
    description: isBug ? "" : (report.description ?? ""),
    preconditions: report.preconditions,
    steps: report.steps,
    stepsDetailed: report.stepsDetailed?.map((s) => ({
      text: s.text,
      // Âncoras Maestro internas não vão para o visitante
    })),
    expectedResult: report.expectedResult,
    // actualResult / evidência técnica / logs de falha: omitidos
    reportedAt: report.reportedAt,
    project: report.project,
    channel: report.channel,
    platform: report.platform,
    module: report.module,
    campaign: report.campaign,
    status: report.status,
    homologationStatus: report.homologationStatus,
    executionMode: report.executionMode,
    priority: report.priority,
    severity: report.severity,
    build: report.build,
    // Sem device/os/technicalEvidence/comments/automation/history bruto
    evidence: (report.evidence ?? []).map((ev) => ({
      fileId: ev.fileId,
      type: ev.type,
      filename: scrubString(ev.filename),
      mimeType: ev.mimeType,
      sizeBytes: ev.sizeBytes,
      uploadedAt: ev.uploadedAt,
      storageKey: ev.storageKey,
    })),
    history: [],
    showInPortfolio: true,
    tags: report.tags,
  };

  return scrubActors(scrubDeep(base));
}

export function sanitizeVisitorCatalog(catalog: TestCatalog): TestCatalog {
  return {
    meta: catalog.meta,
    reports: catalog.reports.map(sanitizeVisitorTestRecord),
  };
}

/** Sanitização genérica de qualquer JSON de resposta ao visitante. */
export function sanitizeVisitorData<T>(data: T): T {
  return scrubActors(scrubDeep(data));
}
