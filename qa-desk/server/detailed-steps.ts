/**
 * Passos detalhados + âncoras Maestro (match determinístico na falha).
 * Espelho de src/lib/detailed-steps.ts — manter alinhado.
 */

export interface DetailedStep {
  text: string;
  flows?: string[];
  actions?: string[];
}

export function normalizeDetailedStep(raw: unknown): DetailedStep {
  if (typeof raw === "string") return { text: raw };
  if (raw && typeof raw === "object" && "text" in raw) {
    const o = raw as DetailedStep;
    return {
      text: String(o.text ?? ""),
      flows: cleanList(o.flows),
      actions: cleanList(o.actions),
    };
  }
  return { text: "" };
}

export function normalizeDetailedSteps(raw: unknown): DetailedStep[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeDetailedStep).filter((s) => s.text.trim());
}

export function detailedStepsFromRecord(record: {
  stepsDetailed?: unknown;
  stepsManual?: unknown;
}): DetailedStep[] {
  if (record.stepsDetailed != null) return normalizeDetailedSteps(record.stepsDetailed);
  if (record.stepsManual != null) return normalizeDetailedSteps(record.stepsManual);
  return [];
}

function cleanList(list?: string[]): string[] | undefined {
  if (!list?.length) return undefined;
  const out = list.map((x) => x.trim()).filter(Boolean);
  return out.length ? out : undefined;
}

export function flowBasename(pathOrName: string): string {
  return pathOrName.replace(/\\/g, "/").split("/").pop() ?? pathOrName;
}

export function matchDetailedStepTrace(
  steps: DetailedStep[],
  failure: { failedFlow?: string; failedAction?: string; errorSummary?: string },
): { index: number; label: string } | undefined {
  if (!steps.length) return undefined;

  const flowBase = failure.failedFlow
    ? flowBasename(failure.failedFlow).toLowerCase()
    : "";
  const hay = `${failure.failedAction ?? ""} ${failure.errorSummary ?? ""}`.toLowerCase();

  let bestIdx = -1;
  let bestScore = 0;

  steps.forEach((step, i) => {
    let score = 0;
    for (const f of step.flows ?? []) {
      const base = flowBasename(f).toLowerCase();
      if (flowBase && (flowBase === base || flowBase.includes(base) || base.includes(flowBase))) {
        score += 2;
      }
    }
    for (const a of step.actions ?? []) {
      const needle = a.trim().toLowerCase();
      if (needle && hay.includes(needle)) score += 3;
    }
    if (score > bestScore || (score === bestScore && score > 0 && i > bestIdx)) {
      bestScore = score;
      bestIdx = i;
    }
  });

  if (bestIdx < 0 || bestScore === 0) return undefined;
  return { index: bestIdx, label: steps[bestIdx].text };
}
