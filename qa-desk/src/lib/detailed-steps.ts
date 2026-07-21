/**
 * Passos detalhados + âncoras Maestro (match determinístico na falha).
 */

export interface DetailedStep {
  text: string;
  /** Basename do YAML, ex. abrir_filtro_extras_composer.yaml */
  flows?: string[];
  /** Trechos da ação Maestro (contains), ex. mural_composer_filtro */
  actions?: string[];
}

/** Aceita string legada ou objeto. */
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

/** Compat: `stepsDetailed` ou legado `stepsManual` (string[]). */
export function detailedStepsFromRecord(record: {
  stepsDetailed?: unknown;
  stepsManual?: unknown;
}): DetailedStep[] {
  if (record.stepsDetailed != null) return normalizeDetailedSteps(record.stepsDetailed);
  if (record.stepsManual != null) return normalizeDetailedSteps(record.stepsManual);
  return [];
}

export function detailedStepsForSave(steps: DetailedStep[]): DetailedStep[] {
  return steps
    .map((s) => ({
      text: s.text.trim(),
      flows: cleanList(s.flows),
      actions: cleanList(s.actions),
    }))
    .filter((s) => s.text);
}

function cleanList(list?: string[]): string[] | undefined {
  if (!list?.length) return undefined;
  const out = list.map((x) => x.trim()).filter(Boolean);
  return out.length ? out : undefined;
}

export function flowBasename(pathOrName: string): string {
  return pathOrName.replace(/\\/g, "/").split("/").pop() ?? pathOrName;
}

/**
 * Casa falha Maestro com âncoras do passo.
 * Prioridade: action (3) > flow (2). Empate → índice maior (passo mais avançado).
 */
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
