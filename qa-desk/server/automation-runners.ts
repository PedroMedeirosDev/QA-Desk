import type { AutomationLink } from "./types.js";

export type AutomationRunner = "maestro" | "playwright";

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

export function parseAutomationRunner(
  value: unknown,
  fallback: AutomationRunner = "maestro",
): AutomationRunner {
  return value === "playwright" || value === "maestro" ? value : fallback;
}
