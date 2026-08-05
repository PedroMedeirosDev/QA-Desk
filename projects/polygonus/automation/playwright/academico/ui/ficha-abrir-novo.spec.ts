/**
 * FICHA-01 — Smoke Ficha Acadêmica (amostra CQ)
 * Login → Novo aluno → contexto API → UI + fill enxuto (sem Gravar).
 */
import { test, expect } from "@playwright/test";
import path from "node:path";
import { GESTAO_URL, loadPlaywrightDotEnv } from "../../shared/gestao-auth";
import { buildAlunoDemo } from "../fixtures/massa";
import { preencherAlunoDemo } from "./preencher-aluno";
import {
  FICHA_NOVO_URL,
  abrirSessaoFicha,
  loginEAbrirNovoAluno,
} from "./ficha-session";

loadPlaywrightDotEnv(path.join(__dirname, "..", ".."));

test.use({ storageState: { cookies: [], origins: [] } });

test("FICHA-01 · Abrir ficha (novo aluno) — UI + contexto + mock", async () => {
  test.setTimeout(240_000);

  console.log("[ficha] amostra CQ =", GESTAO_URL);
  console.log("[ficha] novo aluno =", FICHA_NOVO_URL);

  const { context, page } = await abrirSessaoFicha();

  try {
    const { status, body } = await loginEAbrirNovoAluno(page);
    expect(status, "contexto deve responder 200").toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        ufEntidade: expect.any(String),
        mostrarRa: expect.any(Boolean),
        podeVerSitFin: expect.any(Boolean),
        deficiencias: expect.any(Array),
        classificacoes: expect.any(Array),
      }),
    );

    const ancoraUi = page
      .getByText(/Nome|Dados principais|Matrícula|Gravar|Novo aluno|Ficha/i)
      .first();
    await expect(ancoraUi, "formulário da ficha deve aparecer").toBeVisible({
      timeout: 45_000,
    });

    const demo = buildAlunoDemo();
    console.log("[ficha] mock =", demo.nome);
    const { filled, campos } = await preencherAlunoDemo(page, demo);
    expect(
      filled.includes("nome"),
      "pelo menos o Nome do cadastro deve ter sido preenchido",
    ).toBe(true);
    expect(campos.nome, "locator do Nome do cadastro").toBeTruthy();
    await expect(campos.nome!).toHaveValue(demo.nome);

    console.log(
      `[ficha] ok — UF=${body.ufEntidade} filled=[${filled.join(",")}]`,
    );
  } finally {
    await context.close();
  }
});
