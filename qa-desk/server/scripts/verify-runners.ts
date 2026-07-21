/**
 * Verificação rápida dos helpers de runner (sem framework de testes).
 * Uso: npx tsx server/scripts/verify-runners.ts
 */
import assert from "node:assert/strict";
import {
  hasAnyAutomation,
  hasMaestroAutomation,
  hasPlaywrightAutomation,
  parseAutomationRunner,
  supportsRunner,
} from "../automation-runners.js";
import { listPlaywrightSpecs } from "../playwright-run.js";
import type { AutomationLink } from "../types.js";

const maestroOnly: AutomationLink = {
  type: "maestro",
  flowPath: "projects/polygonus/automation/maestro/mural/foo.yaml",
};

const playwrightOnly: AutomationLink = {
  type: "playwright",
  playwright: {
    specPath: "projects/polygonus/automation/playwright/mural/bar.spec.ts",
  },
};

const both: AutomationLink = {
  type: "maestro",
  flowPath: maestroOnly.flowPath,
  playwright: playwrightOnly.playwright,
};

assert.equal(hasMaestroAutomation(maestroOnly), true);
assert.equal(hasPlaywrightAutomation(maestroOnly), false);
assert.equal(supportsRunner(maestroOnly, "maestro"), true);
assert.equal(supportsRunner(maestroOnly, "playwright"), false);

assert.equal(hasMaestroAutomation(playwrightOnly), false);
assert.equal(hasPlaywrightAutomation(playwrightOnly), true);
assert.equal(supportsRunner(playwrightOnly, "playwright"), true);

assert.equal(hasAnyAutomation(both), true);
assert.equal(supportsRunner(both, "maestro"), true);
assert.equal(supportsRunner(both, "playwright"), true);

assert.equal(parseAutomationRunner("playwright"), "playwright");
assert.equal(parseAutomationRunner("nope"), "maestro");

const specs = listPlaywrightSpecs();
assert.ok(Array.isArray(specs));
console.log(`OK — helpers + ${specs.length} spec(s) Playwright listados`);
for (const s of specs.slice(0, 5)) {
  console.log(`  - ${s.specPath}`);
}
