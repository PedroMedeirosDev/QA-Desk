/**
 * Sessão CQ — gestão React no Amostra (:8443).
 * Login igual à Ficha; navega para as telas novas de Notas / Conteúdo / Frequência.
 */
import type { Page } from "@playwright/test";
import path from "node:path";
import {
  GESTAO_URL,
  academicoReactUrl,
  capturarVersaoGestaoLogin,
  loginGestaoSePreciso,
  passarCloudflareSePreciso,
} from "../../shared/gestao-auth";
import { abrirSessaoFicha } from "../ui/ficha-session";

export { abrirSessaoFicha as abrirSessaoCq };

export const CQ_URLS = {
  notasParciais: academicoReactUrl("notas-parciais"),
  conteudoQuadro: academicoReactUrl("conteudo"),
  conteudoPorTurma: academicoReactUrl("conteudo-por-turma"),
  planoDeAula: academicoReactUrl("plano-de-aula"),
  faltasQuadro: academicoReactUrl("faltas-diarias"),
  faltasPorTurma: academicoReactUrl("faltas-por-turma"),
} as const;

export async function loginCq(page: Page, log = "[cq]") {
  await page.goto(GESTAO_URL, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await passarCloudflareSePreciso(page, log);
  await capturarVersaoGestaoLogin(page, {
    browser: page.context().browser(),
    logPrefix: log,
  });
  await loginGestaoSePreciso(page, log);
  console.log(`${log} logado no Amostra CQ`);
}

export async function abrirTelaCq(
  page: Page,
  url: string,
  ancora: RegExp,
  log = "[cq]",
) {
  await loginCq(page, log);
  console.log(`${log} abrindo`, url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByText(ancora).first().waitFor({ timeout: 45_000 });
}

export const CQ_PROFILE_NOTE = path.basename(
  process.env.PLAYWRIGHT_CHROME_PROFILE_FICHA?.trim() || "pw-ficha",
);
