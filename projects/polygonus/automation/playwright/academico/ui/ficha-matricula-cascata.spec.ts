/**
 * FICHA-30 — Cascata Matrícula (Curso → Grade → Período → Turma → Turno).
 * Self-setup: cria aluno mínimo, abre Matrícula, seleciona opções (não grava matrícula), exclui.
 */
import { test, expect } from "@playwright/test";
import path from "node:path";
import { loadPlaywrightDotEnv } from "../../shared/gestao-auth";
import { buildAlunoCompleto } from "../fixtures/massa";
import {
  excluirAlunoSeAberto,
  exercitarCascataMatricula,
  gravarAluno,
  preencherDadosPessoa,
} from "./preencher-aluno";
import { abrirSessaoFicha, loginEAbrirNovoAluno } from "./ficha-session";

loadPlaywrightDotEnv(path.join(__dirname, "..", ".."));

test.use({ storageState: { cookies: [], origins: [] } });

test("FICHA-30 · Matrícula — cascata Curso/Grade/Período/Turma", async () => {
  test.setTimeout(420_000);

  const { context, page } = await abrirSessaoFicha();
  let gravou = false;

  try {
    const { status } = await loginEAbrirNovoAluno(page);
    expect(status).toBe(200);

    const dados = buildAlunoCompleto(`ficha-30-${Date.now()}`);
    console.log("[ficha-30] aluno =", dados.nome);
    const { filled } = await preencherDadosPessoa(page, dados);
    expect(filled.includes("nome")).toBe(true);

    await gravarAluno(page);
    gravou = true;

    await exercitarCascataMatricula(page);

    await expect(
      page.getByText(/Nova matrícula|Alterar matrícula/i).first(),
    ).toBeVisible();

    // Volta para Dados Principais antes do Excluir (botão fica nessa aba)
    await page.getByRole("tab", { name: /Dados Principais/i }).click();
  } finally {
    try {
      if (gravou) await excluirAlunoSeAberto(page, "[ficha-30]");
    } catch (err) {
      console.log(
        "[ficha-30] cleanup falhou:",
        err instanceof Error ? err.message : err,
      );
    }
    await context.close();
  }
});
