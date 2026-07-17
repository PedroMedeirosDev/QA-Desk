/**
 * Corretor leve para passos e textos de report (sem LLM).
 * Normaliza numeração, espaços, unicode e tom de report QA.
 * Usa o contrato de campos (description ≠ preconditions ≠ expectedResult).
 */

import { normalizeCtFields } from "@/lib/ct-field-contract";

const UNICODE_FIXES: Array<[RegExp, string]> = [
[/\u00A0/g, " "], // nbsp
[/\u201C|\u201D/g, '"'],
[/\u2018|\u2019/g, "'"],
[/N\u00E3o|N\u00e3o/gi, "Não"],
[/nao\b/gi, "não"],
];

function fixUnicode(text: string): string {
  let out = text;
  for (const [re, rep] of UNICODE_FIXES) out = out.replace(re, rep);
  return out;
}

function collapseSpaces(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function capitalizeSentence(text: string): string {
  const t = text.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function normalizeStepLine(line: string, index: number): string {
  let s = line.trim();
  if (!s) return s;
  s = s.replace(/^\d+\s*[-.)]\s*/, "");
  s = capitalizeSentence(s);
  if (!/[.!?]$/.test(s) && s.length > 20) s += ".";
  return `${index + 1} - ${s}`;
}

export function polishSteps(steps: string[]): string[] {
  const nonEmpty = steps.map((s) => fixUnicode(s.trim())).filter(Boolean);
  return nonEmpty.map((s, i) => normalizeStepLine(s, i));
}

export function polishParagraph(text: string): string {
  if (!text.trim()) return text;
  let out = fixUnicode(text);
  out = collapseSpaces(out);
  out = capitalizeSentence(out);
  return out;
}

export interface PolishFormInput {
  steps?: string[];
  expectedResult?: string;
  actualResult?: string;
  description?: string;
  preconditions?: string;
  title?: string;
}

export interface PolishFormOutput {
  steps: string[];
  expectedResult: string;
  actualResult: string;
  description: string;
  preconditions: string;
  changes: string[];
  warnings: string[];
}

export function polishTestForm(input: PolishFormInput): PolishFormOutput {
  const changes: string[] = [];

  const normalized = normalizeCtFields({
    title: input.title,
    description: input.description,
    preconditions: input.preconditions,
    expectedResult: input.expectedResult,
    steps: input.steps,
  });
  for (const f of normalized.fixed) changes.push(f);

  const stepsBefore = (input.steps ?? []).join("|");
  const steps = polishSteps(normalized.fields.steps);
  if (steps.join("|") !== stepsBefore) changes.push("Passos renumerados e normalizados");

  const expectedResult = polishParagraph(normalized.fields.expectedResult);
  if (expectedResult !== (input.expectedResult ?? "").trim()) {
    changes.push("Resultado esperado ajustado");
  }

  const actualResult = polishParagraph(input.actualResult ?? "");
  if (actualResult !== (input.actualResult ?? "").trim()) {
    changes.push("Resultado observado ajustado");
  }

  const description = polishParagraph(normalized.fields.description);
  if (description !== (input.description ?? "").trim()) changes.push("Descrição ajustada");

  const preconditions = polishParagraph(normalized.fields.preconditions);
  if (preconditions !== (input.preconditions ?? "").trim()) {
    changes.push("Pré-condições ajustadas");
  }

  return {
    steps,
    expectedResult,
    actualResult,
    description,
    preconditions,
    changes,
    warnings: normalized.warnings.map((w) => w.message),
  };
}
