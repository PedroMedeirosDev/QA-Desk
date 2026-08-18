/**
 * CQ-FREQ-01/03 — os dois forms de frequência (quadro × por turma).
 *
 *   npx playwright test academico/cq/cq-frequencia-abrir.spec.ts --headed
 */
import { test, expect } from "@playwright/test";
import path from "node:path";
import { GESTAO_URL, loadPlaywrightDotEnv } from "../../shared/gestao-auth";
import { abrirSessaoCq, abrirTelaCq, CQ_URLS } from "./cq-session";

loadPlaywrightDotEnv(path.join(__dirname, "..", ".."));

test.use({ storageState: { cookies: [], origins: [] } });

test("CQ-FREQ-01 · Abrir faltas diárias (quadro)", async () => {
  test.setTimeout(180_000);
  console.log("[cq-freq] Amostra CQ =", GESTAO_URL);
  const { context, page } = await abrirSessaoCq();
  try {
    await abrirTelaCq(
      page,
      CQ_URLS.faltasQuadro,
      /Falta|Frequência|Quadro/i,
      "[cq-freq-quadro]",
    );
    await expect(page.getByText(/Falta|Frequência|Quadro/i).first()).toBeVisible();
  } finally {
    await context.close();
  }
});

test("CQ-FREQ-03 · Abrir faltas por turma", async () => {
  test.setTimeout(180_000);
  const { context, page } = await abrirSessaoCq();
  try {
    await abrirTelaCq(
      page,
      CQ_URLS.faltasPorTurma,
      /Falta|turma|Frequência/i,
      "[cq-freq-turma]",
    );
    await expect(page.getByText(/Falta|turma|Frequência/i).first()).toBeVisible();
  } finally {
    await context.close();
  }
});
