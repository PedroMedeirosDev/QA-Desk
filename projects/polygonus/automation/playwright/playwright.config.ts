import { defineConfig, devices } from "@playwright/test";

const storageState =
  process.env.PLAYWRIGHT_STORAGE_STATE?.trim() || ".auth/user.json";

export default defineConfig({
  testDir: ".",
  testMatch: ["**/*.spec.ts"],
  testIgnore: ["**/_*.spec.ts"],
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  // O JSON alimenta o histórico do QA Desk (qa-desk/scripts/importar-playwright.ts).
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ["json", { outputFile: "resultados/ultima-execucao.json" }],
  ],
  use: {
    locale: "pt-BR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    storageState,
    ...devices["Desktop Chrome"],
  },
});
