/**
 * FICHA-10 — Fill completo da aba Dados Principais (sem Gravar).
 */
import { test, expect } from "@playwright/test";
import path from "node:path";
import { loadPlaywrightDotEnv } from "../../shared/gestao-auth";
import { buildAlunoCompleto } from "../fixtures/massa";
import { preencherAlunoCompleto } from "./preencher-aluno";
import { abrirSessaoFicha, loginEAbrirNovoAluno } from "./ficha-session";

loadPlaywrightDotEnv(path.join(__dirname, "..", ".."));

test.use({ storageState: { cookies: [], origins: [] } });

test("FICHA-10 · Dados Principais — fill completo (sem Gravar)", async () => {
  test.setTimeout(300_000);

  const { context, page } = await abrirSessaoFicha();
  try {
    const { status } = await loginEAbrirNovoAluno(page);
    expect(status).toBe(200);

    await expect(page.getByPlaceholder("Nome completo", { exact: true })).toBeVisible({
      timeout: 45_000,
    });

    const dados = buildAlunoCompleto();
    console.log("[ficha-10] aluno =", dados.nome);
    const { filled, campos } = await preencherAlunoCompleto(page, dados);

    expect(filled.includes("nome"), "Nome obrigatório").toBe(true);
    expect(campos.nome).toBeTruthy();
    await expect(campos.nome!).toHaveValue(dados.nome);

    expect(
      filled.includes("cpf") || filled.includes("dataNascimento"),
      "pelo menos CPF ou DN",
    ).toBe(true);

    console.log(`[ficha-10] filled=[${filled.join(",")}]`);
  } finally {
    await context.close();
  }
});
