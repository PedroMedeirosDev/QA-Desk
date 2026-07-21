import type {
  AutomationLink,
  AutomationPlaywrightTarget,
  TestRecord,
} from "@/types/test-record";

export type AutomationRunner = "maestro" | "playwright";

export const AUTOMATION_RUNNER_LABELS: Record<AutomationRunner, string> = {
  maestro: "Emulador / Maestro",
  playwright: "Web / Playwright",
};

export const AUTOMATION_RUNNER_SHORT: Record<AutomationRunner, string> = {
  maestro: "Maestro",
  playwright: "Playwright",
};

export function hasMaestroAutomation(
  automation?: Pick<AutomationLink, "flowPath"> | null,
): boolean {
  return Boolean(automation?.flowPath?.trim());
}

export function hasPlaywrightAutomation(
  automation?: Pick<AutomationLink, "playwright"> | null,
): boolean {
  return Boolean(automation?.playwright?.specPath?.trim());
}

export function hasAnyAutomation(
  automation?: Pick<AutomationLink, "flowPath" | "playwright"> | null,
): boolean {
  return hasMaestroAutomation(automation) || hasPlaywrightAutomation(automation);
}

export function supportsRunner(
  automation: Pick<AutomationLink, "flowPath" | "playwright"> | undefined | null,
  runner: AutomationRunner,
): boolean {
  return runner === "maestro"
    ? hasMaestroAutomation(automation)
    : hasPlaywrightAutomation(automation);
}

export function playwrightTarget(
  automation?: Pick<AutomationLink, "playwright"> | null,
): AutomationPlaywrightTarget | undefined {
  const specPath = automation?.playwright?.specPath?.trim();
  if (!specPath) return undefined;
  return automation!.playwright;
}

export function resolveRunnerForRecord(
  record: Pick<TestRecord, "automation">,
  preferred: AutomationRunner,
): AutomationRunner | null {
  if (supportsRunner(record.automation, preferred)) return preferred;
  return null;
}

export function runnerStorageKey(suiteCollapseKey: string): string {
  return `qa-suite-runner:${suiteCollapseKey}`;
}

export function readSuiteRunner(suiteCollapseKey: string): AutomationRunner {
  try {
    const raw = sessionStorage.getItem(runnerStorageKey(suiteCollapseKey));
    if (raw === "playwright" || raw === "maestro") return raw;
  } catch {
    /* ignore */
  }
  return "maestro";
}

export function writeSuiteRunner(
  suiteCollapseKey: string,
  runner: AutomationRunner,
): void {
  try {
    sessionStorage.setItem(runnerStorageKey(suiteCollapseKey), runner);
  } catch {
    /* ignore */
  }
}
