/**
 * CQ-CONTEUDO-01/03 — os dois forms de conteúdo (quadro × por turma).
 *
 *   npx playwright test academico/cq/cq-conteudo-abrir.spec.ts --headed
 */
import { test, expect } from "@playwright/test";
import path from "node:path";
import { GESTAO_URL, loadPlaywrightDotEnv } from "../../shared/gestao-auth";
import { abrirSessaoCq, abrirTelaCq, CQ_URLS } from "./cq-session";

loadPlaywrightDotEnv(path.join(__dirname, "..", ".."));

test.use({ storageState: { cookies: [], origins: [] } });

test("CQ-CONTEUDO-01 · Abrir conteúdo (quadro por etapa)", async () => {
  test.setTimeout(180_000);
  console.log("[cq-conteudo] Amostra CQ =", GESTAO_URL);
  const { context, page } = await abrirSessaoCq();
  try {
    await abrirTelaCq(
      page,
      CQ_URLS.conteudoQuadro,
      /Conteúdo|Plano de aula|Digitação/i,
      "[cq-conteudo-quadro]",
    );
    await expect(
      page.getByText(/Conteúdo|Plano de aula|Digitação/i).first(),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

test("CQ-CONTEUDO-03 · Abrir conteúdo por turma", async () => {
  test.setTimeout(180_000);
  const { context, page } = await abrirSessaoCq();
  try {
    await abrirTelaCq(
      page,
      CQ_URLS.conteudoPorTurma,
      /Conteúdo|turma|aula/i,
      "[cq-conteudo-turma]",
    );
    await expect(page.getByText(/Conteúdo|turma|aula/i).first()).toBeVisible();
  } finally {
    await context.close();
  }
});
