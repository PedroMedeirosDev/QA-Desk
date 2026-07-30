import { defineConfig } from "@playwright/test";

/**
 * Testes de API do QA Desk (sem browser / sem Vite).
 * Auth mock · porta 3011 · Maestro off.
 */
const API_PORT = 3011;
const baseURL = `http://127.0.0.1:${API_PORT}`;

export default defineConfig({
  testDir: "./api",
  testMatch: ["**/*.spec.ts"],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL,
    extraHTTPHeaders: {
      Accept: "application/json",
    },
  },
  webServer: {
    command: "npm run e2e:api",
    cwd: "..",
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
