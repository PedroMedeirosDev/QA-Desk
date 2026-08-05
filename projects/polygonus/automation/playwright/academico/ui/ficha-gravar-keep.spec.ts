/**
 * DIAGNÓSTICO — Grava 1 aluno na amostra e NÃO exclui.
 *
 * Objetivo: confirmar se o Playwright está gravando no CQ (:8443)
 * ou na amostra "produção" (mesmo host sem porta).
 *
 * Rodar:
 *   cd projects/polygonus/automation/playwright
 *   npm run test:ficha:gravar-keep
 *
 * Depois do teste:
 * 1. Anote a URL final impressa no log (deve ter :8443 se for CQ).
 * 2. Na gestão CQ (:8443) busque o nome impresso (prefixo QA Desk KEEP).
 * 3. Na gestão sem porta (produção/amostra pública) busque o MESMO nome.
 *    - Só no :8443 → ok, destino certo.
 *    - Nos dois ou só sem porta → vazamento / URL errada.
 */
import { test, expect } from "@playwright/test";
import path from "node:path";
import {
  GESTAO_URL,
  loadPlaywrightDotEnv,
} from "../../shared/gestao-auth";
import { buildAlunoCompleto } from "../fixtures/massa";
import {
  gravarAluno,
  preencherDadosPessoa,
  preencherContatos,
} from "./preencher-aluno";
import { abrirSessaoFicha, loginEAbrirNovoAluno } from "./ficha-session";

loadPlaywrightDotEnv(path.join(__dirname, "..", ".."));

test.use({ storageState: { cookies: [], origins: [] } });

function analisarHost(url: string) {
  try {
    const u = new URL(url);
    const porta = u.port || (u.protocol === "https:" ? "443" : "80");
    const isCq = u.port === "8443" || url.includes(":8443");
    return { host: u.host, porta, isCq, origin: u.origin };
  } catch {
    return { host: "?", porta: "?", isCq: false, origin: url };
  }
}

test("DIAG · Gravar aluno KEEP (sem excluir) — destino amostra", async () => {
  test.setTimeout(360_000);

  const meta = analisarHost(GESTAO_URL);
  console.log("========== DESTINO CONFIGURADO ==========");
  console.log("[keep] PLAYWRIGHT_GESTAO_URL =", GESTAO_URL);
  console.log("[keep] host =", meta.host, "| porta =", meta.porta);
  console.log(
    "[keep] parece CQ (:8443)?",
    meta.isCq ? "SIM" : "NÃO ← confira o .env!",
  );
  console.log("=========================================");

  const { context, page } = await abrirSessaoFicha();

  try {
    const { status } = await loginEAbrirNovoAluno(page);
    expect(status).toBe(200);

    const afterLogin = analisarHost(page.url());
    console.log("[keep] URL após login =", page.url());
    console.log(
      "[keep] sessão no CQ?",
      afterLogin.isCq ? "SIM" : "NÃO ← possível problema",
    );

    await expect(
      page.getByPlaceholder("Nome completo", { exact: true }),
    ).toBeVisible({ timeout: 45_000 });

    const dados = buildAlunoCompleto(`keep-${Date.now()}`);
    // Nome bem identificável na busca
    dados.nome = `QA Desk KEEP ${Date.now()}`.slice(0, 70);
    console.log("[keep] vai gravar aluno =", dados.nome);
    console.log("[keep] CPF =", dados.cpf);

    const { filled } = await preencherDadosPessoa(page, dados);
    expect(filled.includes("nome")).toBe(true);
    await preencherContatos(page, dados);

    await gravarAluno(page);

    const finalUrl = page.url();
    const afterSave = analisarHost(finalUrl);
    console.log("========== RESULTADO GRAVAÇÃO ==========");
    console.log("[keep] URL final =", finalUrl);
    console.log(
      "[keep] gravou no CQ (:8443)?",
      afterSave.isCq ? "SIM" : "NÃO ← investigue redirect/baseURL",
    );
    console.log("[keep] nome para buscar =", dados.nome);
    console.log("[keep] CPF para buscar =", dados.cpf);
    console.log("");
    console.log("Checklist manual:");
    console.log(
      "  A) CQ → https://amostra.polygonus.com.br:8443/web/react/gestao",
    );
    console.log(
      "  B) Sem porta → https://amostra.polygonus.com.br/web/react/gestao",
    );
    console.log("  Busque o nome acima em A e em B.");
    console.log("  Aluno NÃO foi excluído (KEEP).");
    console.log("=========================================");

    expect(
      afterSave.isCq,
      `Esperava URL com :8443 após Gravar; veio ${finalUrl}`,
    ).toBe(true);
  } finally {
    await context.close();
  }
});
