/**
 * Login na amostra CQ (Chrome headed + perfil persistente).
 * Usado pelos specs Acadêmico / Mural seed.
 */
import type { Browser, Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

export function loadPlaywrightDotEnv(fromDir: string) {
  const candidates = [
    path.join(fromDir, ".env"),
    path.join(fromDir, "..", ".env"),
    path.join(fromDir, "..", "..", ".env"),
    path.join(fromDir, "..", "maestro", "flows", ".env"),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[m[1]] === undefined) process.env[m[1]] = val;
    }
  }
}

export const GESTAO_URL =
  process.env.PLAYWRIGHT_GESTAO_URL?.trim() ||
  "https://amostra.polygonus.com.br:8443/web/react/gestao";

/** Lidos na hora da chamada (permite setar LOGIN_PHJESUS no .env antes do login). */
export function resolveGestaoLogin(): string {
  return (
    process.env.PLAYWRIGHT_LOGIN?.trim() ||
    process.env.LOGIN_PHJESUS?.trim() ||
    process.env.LOGIN_SUPPETER?.trim() ||
    "SUPPETER"
  );
}

export function resolveGestaoSenha(): string {
  return (
    process.env.PLAYWRIGHT_SENHA?.trim() ||
    process.env.SENHA?.trim() ||
    "poly1000"
  );
}

export function resolveGestaoUnidade(): string {
  return process.env.PLAYWRIGHT_UNIDADE?.trim() || "Colégio Demonstração";
}

/** @deprecated use resolveGestaoLogin() — valor no import pode estar stale */
export const LOGIN = resolveGestaoLogin();
/** @deprecated use resolveGestaoSenha() */
export const SENHA = resolveGestaoSenha();
/** @deprecated use resolveGestaoUnidade() */
export const UNIDADE = resolveGestaoUnidade();

/** Marcador parseado pelo Desk → campo `build` dos CTs WEB. */
export const WEB_BUILD_MARKER = "[qa-desk] web-build:";

/** basePath Next = /web/react → ficha em /web/react/academico/alunos/novo */
export function fichaNovoAlunoUrl(gestaoUrl = GESTAO_URL): string {
  return gestaoUrl.replace(/\/gestao\/?$/, "/academico/alunos/novo");
}

export function gestaoLoginUrl(gestaoUrl = GESTAO_URL): string {
  const base = gestaoUrl.replace(/\/+$/, "");
  if (/\/gestao\/login$/i.test(base)) return base;
  if (/\/gestao$/i.test(base)) return `${base}/login`;
  return `${base}/gestao/login`;
}

export function menuGeral(page: Page) {
  return page.getByRole("button", { name: "Geral" }).first();
}

/**
 * Lê Front/Back(/Legado) do rodapé da tela de login da amostra CQ.
 * Ex.: "Front: 05/08/26, 00:23 · Back: 05/08/26, 00:23"
 */
export function parseVersaoRodapeLogin(text: string): string | undefined {
  const front = text.match(/Front:\s*(\d{2}\/\d{2}\/\d{2},\s*\d{2}:\d{2})/i);
  const back = text.match(/Back:\s*(\d{2}\/\d{2}\/\d{2},\s*\d{2}:\d{2})/i);
  const legado = text.match(/Legado:\s*(\d{2}\/\d{2}\/\d{2},\s*\d{2}:\d{2})/i);
  if (!front && !back && !legado) return undefined;
  const parts: string[] = [];
  if (front) parts.push(`Front: ${front[1].replace(/\s+/g, " ")}`);
  if (back) parts.push(`Back: ${back[1].replace(/\s+/g, " ")}`);
  if (legado) parts.push(`Legado: ${legado[1].replace(/\s+/g, " ")}`);
  return parts.join(" · ");
}

export async function lerVersaoRodapeLogin(
  page: Page,
): Promise<string | undefined> {
  const body = await page.locator("body").innerText().catch(() => "");
  return parseVersaoRodapeLogin(body);
}

function logWebBuild(version: string, logPrefix: string) {
  console.log(`${WEB_BUILD_MARKER} ${version}`);
  console.log(`${logPrefix} versão login = ${version}`);
}

/**
 * Captura versão do rodapé (login amostra CQ) e imprime o marcador para o Desk.
 * Se a sessão já estiver autenticada, abre um browser limpo só para ler o login
 * (contexto persistente não expõe browser()).
 */
export async function capturarVersaoGestaoLogin(
  page: Page,
  opts?: { browser?: Browser | null; logPrefix?: string },
): Promise<string | undefined> {
  const logPrefix = opts?.logPrefix ?? "[amostra-cq]";

  let version = await lerVersaoRodapeLogin(page);
  if (version) {
    logWebBuild(version, logPrefix);
    return version;
  }

  const existingBrowser = opts?.browser ?? page.context().browser();
  let ownedBrowser: Browser | undefined;
  let tmp;

  try {
    if (existingBrowser) {
      tmp = await existingBrowser.newContext({
        locale: "pt-BR",
        viewport: { width: 1200, height: 800 },
      });
    } else {
      const { chromium } = await import("@playwright/test");
      ownedBrowser = await chromium.launch({
        channel: "chrome",
        headless: process.env.PLAYWRIGHT_HEADED === "0",
      });
      tmp = await ownedBrowser.newContext({
        locale: "pt-BR",
        viewport: { width: 1200, height: 800 },
      });
    }

    const loginPage = await tmp.newPage();
    await loginPage.goto(gestaoLoginUrl(), {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await passarCloudflareSePreciso(loginPage, logPrefix);
    await loginPage
      .getByText(/Front:|Back:|Legado:/i)
      .first()
      .waitFor({ state: "visible", timeout: 15_000 })
      .catch(() => undefined);
    version = await lerVersaoRodapeLogin(loginPage);
    if (version) logWebBuild(version, logPrefix);
    return version;
  } catch (err) {
    console.log(
      `${logPrefix} não capturou versão do login:`,
      err instanceof Error ? err.message : err,
    );
    return undefined;
  } finally {
    await tmp?.close().catch(() => undefined);
    await ownedBrowser?.close().catch(() => undefined);
  }
}

export async function passarCloudflareSePreciso(
  page: Page,
  logPrefix = "[amostra-cq]",
) {
  const desafio = page.getByText(/verifica|Confirme que|Ray ID|Cloudflare/i);
  if (!(await desafio.first().isVisible().catch(() => false))) return;

  console.log(
    `${logPrefix} Cloudflare — marque “Confirme que é humano” (até 2 min)…`,
  );
  try {
    await page
      .frameLocator('iframe[src*="challenges.cloudflare.com"]')
      .first()
      .locator("body")
      .click({ timeout: 5_000 });
  } catch {
    /* usuário */
  }

  await page
    .getByText(/Geral|Entrar|ENTRAR|Login|E-mail|Senha|Continuar|Front:/i)
    .first()
    .waitFor({ state: "visible", timeout: 120_000 });
}

export async function loginGestaoSePreciso(
  page: Page,
  logPrefix = "[amostra-cq]",
) {
  const geral = menuGeral(page);
  if (await geral.isVisible().catch(() => false)) return;

  const senhaInput = page.locator('input[type="password"]').first();
  const continuar = page
    .getByRole("button", { name: /^Continuar$/i })
    .or(page.getByText("Continuar", { exact: true }))
    .first();

  if (!(await senhaInput.isVisible().catch(() => false))) {
    await Promise.race([
      geral.waitFor({ state: "visible", timeout: 45_000 }),
      senhaInput.waitFor({ state: "visible", timeout: 45_000 }),
      continuar.waitFor({ state: "visible", timeout: 45_000 }),
    ]).catch(() => undefined);
  }

  if (await geral.isVisible().catch(() => false)) return;

  if (await senhaInput.isVisible().catch(() => false)) {
    await page
      .getByText(/Front:/i)
      .first()
      .waitFor({ state: "visible", timeout: 8_000 })
      .catch(() => undefined);
    const onLogin = await lerVersaoRodapeLogin(page);
    if (onLogin) logWebBuild(onLogin, logPrefix);

    console.log(`${logPrefix} login amostra CQ como ${resolveGestaoLogin()}`);
    const userInput = page
      .locator(
        'input[type="text"], input[type="email"], input[name*="login" i], input[name*="user" i], input[placeholder*="Login" i], input[placeholder*="mail" i]',
      )
      .first();
    await userInput.fill(resolveGestaoLogin());
    await senhaInput.fill(resolveGestaoSenha());
    const entrar = page.getByRole("button", { name: /entrar|login|acessar/i });
    if (await entrar.count()) await entrar.first().click();
    else await senhaInput.press("Enter");
  }

  const unidadeHeading = page.getByText(/Selecione sua unidade/i);
  await Promise.race([
    geral.waitFor({ state: "visible", timeout: 45_000 }),
    continuar.waitFor({ state: "visible", timeout: 45_000 }),
    unidadeHeading.waitFor({ state: "visible", timeout: 45_000 }),
  ]).catch(() => undefined);

  if (await geral.isVisible().catch(() => false)) return;

  if (
    (await continuar.isVisible().catch(() => false)) ||
    (await unidadeHeading.isVisible().catch(() => false))
  ) {
    console.log(`${logPrefix} unidade "${resolveGestaoUnidade()}" → Continuar`);
    const unidade = resolveGestaoUnidade();
    const itemExact = page.getByText(unidade, { exact: true }).first();
    const itemFuzzy = page.getByText(/Col[eé]gio\s+(de\s+)?Demonstra/i).first();
    if (await itemExact.isVisible().catch(() => false)) await itemExact.click();
    else if (await itemFuzzy.isVisible().catch(() => false)) {
      const label = (await itemFuzzy.textContent())?.trim() || unidade;
      console.log(`${logPrefix} unidade via fuzzy: "${label}"`);
      await itemFuzzy.click();
    } else {
      throw new Error(
        `${logPrefix} unidade "${unidade}" não encontrada na tela Selecione sua unidade`,
      );
    }
    await continuar.click({ timeout: 15_000 });
  }

  await geral.waitFor({ state: "visible", timeout: 60_000 });
}
