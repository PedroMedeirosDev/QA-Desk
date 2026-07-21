import { defineConfig, devices } from "@playwright/test";

/**
 * E2E do próprio QA Desk (dogfooding).
 * Portas dedicadas: UI 5175 · API 3011 (não colide com npm run dev).
 * Auth mock via scripts e2e:api / e2e:ui-server (VITE_SUPABASE_* vazio).
 */
const UI_PORT = 5175;
const API_PORT = 3011;
const baseURL = `http://127.0.0.1:${UI_PORT}`;

export default defineConfig({
  testDir: ".",
  testMatch: ["**/*.spec.ts"],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  use: {
    baseURL,
    locale: "pt-BR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: [
    {
      command: "npm run e2e:api",
      cwd: "..",
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 90_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "npm run e2e:ui-server",
      cwd: "..",
      url: baseURL,
      reuseExistingServer: false,
      timeout: 90_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
