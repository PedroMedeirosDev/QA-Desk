/**
 * CQ-NOTAS-01 — Smoke Notas parciais (React, Amostra CQ).
 *
 *   npx playwright test academico/cq/cq-notas-abrir.spec.ts --headed
 */
import { test, expect } from "@playwright/test";
import path from "node:path";
import { GESTAO_URL, loadPlaywrightDotEnv } from "../../shared/gestao-auth";
import { abrirSessaoCq, abrirTelaCq, CQ_URLS } from "./cq-session";

loadPlaywrightDotEnv(path.join(__dirname, "..", ".."));

test.use({ storageState: { cookies: [], origins: [] } });

test("CQ-NOTAS-01 · Abrir lançamento de notas parciais", async () => {
  test.setTimeout(180_000);
  console.log("[cq-notas] Amostra CQ =", GESTAO_URL);
  console.log("[cq-notas] tela =", CQ_URLS.notasParciais);

  const { context, page } = await abrirSessaoCq();
  try {
    await abrirTelaCq(
      page,
      CQ_URLS.notasParciais,
      /Notas parciais|Lançamento/i,
      "[cq-notas]",
    );
    await expect(page.getByText(/Notas parciais|Lançamento/i).first()).toBeVisible();
  } finally {
    await context.close();
  }
});
