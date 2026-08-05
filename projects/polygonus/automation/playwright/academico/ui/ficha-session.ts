/**
 * Sessão compartilhada: login amostra CQ + abrir Novo aluno.
 */
import { chromium, type BrowserContext, type Page } from "@playwright/test";
import path from "node:path";
import {
  GESTAO_URL,
  capturarVersaoGestaoLogin,
  fichaNovoAlunoUrl,
  loginGestaoSePreciso,
  passarCloudflareSePreciso,
} from "../../shared/gestao-auth";

export const FICHA_NOVO_URL = fichaNovoAlunoUrl();

export const PROFILE_DIR =
  process.env.PLAYWRIGHT_CHROME_PROFILE_FICHA?.trim() ||
  path.join(__dirname, "..", "..", ".auth", "pw-ficha");

export const HEADED = process.env.PLAYWRIGHT_HEADED !== "0";

export async function abrirSessaoFicha(): Promise<{
  context: BrowserContext;
  page: Page;
}> {
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: "chrome",
    headless: !HEADED,
    locale: "pt-BR",
    viewport: { width: 1400, height: 900 },
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const page = context.pages()[0] || (await context.newPage());
  return { context, page };
}

export async function loginEAbrirNovoAluno(
  page: Page,
  opts?: { waitContexto?: boolean },
) {
  const waitContexto = opts?.waitContexto !== false;

  await page.goto(GESTAO_URL, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await passarCloudflareSePreciso(page, "[ficha]");
  await capturarVersaoGestaoLogin(page, {
    browser: page.context().browser(),
    logPrefix: "[ficha]",
  });
  await loginGestaoSePreciso(page, "[ficha]");
  console.log("[ficha] logado — abrindo Novo aluno…");

  const esperaContexto = waitContexto
    ? page.waitForResponse(
        (r) =>
          r.url().includes("/academico/aluno/contexto") &&
          r.request().method() === "GET",
        { timeout: 60_000 },
      )
    : null;

  await page.goto(FICHA_NOVO_URL, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });

  if (esperaContexto) {
    const res = await esperaContexto;
    const status = res.status();
    const body = await res.json();
    console.log("[ficha] contexto status =", status);
    return { status, body };
  }
  return { status: 0, body: null };
}
