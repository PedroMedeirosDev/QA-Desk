/**
 * FICHA-90 — E2E: fill completo → Gravar → abas → cascata matrícula (sem gravar matrícula) → Excluir.
 * PLAYWRIGHT_FICHA_KEEP=1 pula a exclusão (população).
 */
import { test, expect } from "@playwright/test";
import path from "node:path";
import { loadPlaywrightDotEnv } from "../../shared/gestao-auth";
import { buildAlunoCompleto } from "../fixtures/massa";
import {
  clickAba,
  excluirAlunoSeAberto,
  exercitarCascataMatricula,
  gravarAluno,
  preencherAlunoCompleto,
} from "./preencher-aluno";
import { abrirSessaoFicha, loginEAbrirNovoAluno } from "./ficha-session";

loadPlaywrightDotEnv(path.join(__dirname, "..", ".."));

test.use({ storageState: { cookies: [], origins: [] } });

test("FICHA-90 · E2E novo aluno — grava, abas, limpa", async () => {
  test.setTimeout(480_000);

  const { context, page } = await abrirSessaoFicha();
  let gravou = false;

  try {
    const { status } = await loginEAbrirNovoAluno(page);
    expect(status).toBe(200);

    await expect(page.getByPlaceholder("Nome completo", { exact: true })).toBeVisible({
      timeout: 45_000,
    });

    const dados = buildAlunoCompleto();
    console.log("[ficha-90] aluno =", dados.nome);
    const { filled, campos } = await preencherAlunoCompleto(page, dados);
    expect(filled.includes("nome")).toBe(true);
    await expect(campos.nome!).toHaveValue(dados.nome);

    await gravarAluno(page);
    gravou = true;
    console.log("[ficha-90] gravado — URL=", page.url());

    await expect(page.getByText(/Ficha Acadêmica/i).first()).toBeVisible({
      timeout: 30_000,
    });

    // Abas liberadas
    const familia = page.getByRole("tab", { name: /Família/i });
    await expect(familia).toBeEnabled({ timeout: 15_000 });

    await clickAba(page, /Família/i);
    await expect(
      page.getByText(/Parentes|responsáveis|Irmãos|Família/i).first(),
    ).toBeVisible({ timeout: 20_000 });

    await exercitarCascataMatricula(page);

    await clickAba(page, /Dados Principais/i);
  } finally {
    try {
      if (gravou) await excluirAlunoSeAberto(page, "[ficha-90]");
    } catch (err) {
      console.log(
        "[ficha-90] cleanup falhou:",
        err instanceof Error ? err.message : err,
        "URL=",
        page.url(),
      );
    }
    await context.close();
  }
});
