/**
 * Aprendizado — API da Ficha Acadêmica (amostra)
 *
 * Diferença do Desk (`npm run test:api`):
 * - Desk = API mock local, sem login real
 * - Aqui = amostra real + cookies de sessão + Cloudflare
 *
 * Ideia didática: a própria tela React chama GET /academico/aluno/contexto
 * ao abrir "Novo aluno". Nós só ESPERAMOS essa resposta e validamos o JSON
 * (mesmo raciocínio do Newman: status + asserts no body).
 *
 * Rodar (headed — se aparecer Cloudflare, marque o captcha):
 *   cd projects/polygonus/automation/playwright
 *   npm run test:ficha-contexto
 */
import { test, expect, chromium, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

function loadDotEnv() {
  const file = path.join(__dirname, "..", "..", ".env");
  if (!fs.existsSync(file)) return;
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

loadDotEnv();

const GESTAO_URL =
  process.env.PLAYWRIGHT_GESTAO_URL?.trim() ||
  "https://amostra.polygonus.com.br:8443/web/react/gestao";

/** basePath Next = /web/react → ficha em /web/react/academico/alunos/novo */
const FICHA_NOVO_URL = GESTAO_URL.replace(/\/gestao\/?$/, "/academico/alunos/novo");

const LOGIN =
  process.env.PLAYWRIGHT_LOGIN?.trim() ||
  process.env.LOGIN_SUPPETER?.trim() ||
  "SUPPETER";

const SENHA =
  process.env.PLAYWRIGHT_SENHA?.trim() ||
  process.env.SENHA?.trim() ||
  "poly1000";

const UNIDADE =
  process.env.PLAYWRIGHT_UNIDADE?.trim() || "Colégio Demonstração";

const PROFILE_DIR =
  process.env.PLAYWRIGHT_CHROME_PROFILE_FICHA?.trim() ||
  path.join(__dirname, "..", "..", ".auth", "pw-ficha-api");

function menuGeral(page: Page) {
  return page.getByRole("button", { name: "Geral" }).first();
}

async function passarCloudflareSePreciso(page: Page) {
  const desafio = page.getByText(/verifica|Confirme que|Ray ID|Cloudflare/i);
  if (!(await desafio.first().isVisible().catch(() => false))) return;

  console.log(
    "[ficha-api] Cloudflare — marque “Confirme que é humano” (até 2 min)…",
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
    .getByText(/Geral|Entrar|ENTRAR|Login|E-mail|Senha|Continuar/i)
    .first()
    .waitFor({ state: "visible", timeout: 120_000 });
}

async function loginGestaoSePreciso(page: Page) {
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
    console.log(`[ficha-api] login amostra CQ como ${LOGIN}`);
    const userInput = page
      .locator(
        'input[type="text"], input[type="email"], input[name*="login" i], input[name*="user" i], input[placeholder*="Login" i], input[placeholder*="mail" i]',
      )
      .first();
    await userInput.fill(LOGIN);
    await senhaInput.fill(SENHA);
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
    console.log(`[ficha-api] unidade "${UNIDADE}" → Continuar`);
    const itemExact = page.getByText(UNIDADE, { exact: true }).first();
    const itemFuzzy = page.getByText(/Col[eé]gio\s+(de\s+)?Demonstra/i).first();
    if (await itemExact.isVisible().catch(() => false)) await itemExact.click();
    else if (await itemFuzzy.isVisible().catch(() => false)) await itemFuzzy.click();
    else {
      throw new Error(
        `[ficha-api] unidade "${UNIDADE}" não encontrada na tela Selecione sua unidade`,
      );
    }
    await continuar.click({ timeout: 15_000 });
  }

  await geral.waitFor({ state: "visible", timeout: 60_000 });
}

test.use({ storageState: { cookies: [], origins: [] } });

test("Ficha: GET /academico/aluno/contexto (interceptado da tela)", async () => {
  test.setTimeout(240_000);

  console.log("[ficha-api] amostra CQ =", GESTAO_URL);
  console.log("[ficha-api] novo aluno =", FICHA_NOVO_URL);

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: "chrome",
    headless: false,
    locale: "pt-BR",
    viewport: { width: 1400, height: 900 },
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const page = context.pages()[0] || (await context.newPage());

  try {
    await page.goto(GESTAO_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await passarCloudflareSePreciso(page);
    await loginGestaoSePreciso(page);
    console.log("[ficha-api] logado — abrindo Novo aluno e escutando a API…");

    // Mesma ideia do Newman: request → status → asserts no JSON.
    // Diferença: quem dispara o GET é a tela React; nós só validamos.
    const esperaContexto = page.waitForResponse(
      (r) =>
        r.url().includes("/academico/aluno/contexto") &&
        r.request().method() === "GET",
      { timeout: 60_000 },
    );

    await page.goto(FICHA_NOVO_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    const res = await esperaContexto;
    const status = res.status();
    const body = await res.json();

    console.log("[ficha-api] URL =", res.url());
    console.log("[ficha-api] status =", status);
    console.log("[ficha-api] body =", JSON.stringify(body, null, 2));

    expect(status, "contexto deve responder 200").toBe(200);
    // Shape estável (polygonus-go ContextoFichaDTO)
    expect(body).toEqual(
      expect.objectContaining({
        ufEntidade: expect.any(String),
        mostrarRa: expect.any(Boolean),
        podeVerSitFin: expect.any(Boolean),
        deficiencias: expect.any(Array),
        classificacoes: expect.any(Array),
      }),
    );

    console.log(
      `[ficha-api] ok — UF=${body.ufEntidade} mostrarRa=${body.mostrarRa} podeVerSitFin=${body.podeVerSitFin}`,
    );
  } finally {
    await context.close();
  }
});
