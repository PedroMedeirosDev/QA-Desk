/**
 * Seed DN do colaborador "Aniversariante" (dia/mês do teste, ano preservado).
 * Usado por FILTRO-02 / FILTRO-09 — usuário dedicado, sem reverter.
 *
 * Gestão amostra CQ: SUPPETER → Geral → Pessoas → Colaboradores (iframe).
 * Escape: SKIP_ANIVERSARIANTE_DN=1
 */
import { expect, chromium, type Page, type Frame, type FrameLocator } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

type Escopo = Page | Frame | FrameLocator;

let seedFeitoNestaRun = false;

function loadDotEnv(playwrightRoot: string) {
  const candidates = [
    path.join(playwrightRoot, ".env"),
    path.join(playwrightRoot, "..", "maestro", "flows", ".env"),
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

export function dataNascimentoAlvo(agora = new Date()): string {
  const dia = String(agora.getDate()).padStart(2, "0");
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const ano = process.env.PLAYWRIGHT_ANIVERSARIANTE_ANO?.trim() || "2014";
  return `${dia}/${mes}/${ano}`;
}

function menuGeral(page: Page) {
  return page.getByRole("button", { name: "Geral" }).first();
}

async function passarCloudflareSePreciso(page: Page) {
  const desafio = page.getByText(/verifica|Confirme que|Ray ID|Cloudflare/i);
  if (!(await desafio.first().isVisible().catch(() => false))) return;

  console.log(
    "[dn] Cloudflare — marque “Confirme que é humano” na janela (até 2 min)…",
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

async function loginGestaoSePreciso(
  page: Page,
  login: string,
  senha: string,
  unidade: string,
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
    console.log(`[dn] login amostra CQ como ${login}`);
    const userInput = page
      .locator(
        'input[type="text"], input[type="email"], input[name*="login" i], input[name*="user" i], input[placeholder*="Login" i], input[placeholder*="mail" i]',
      )
      .first();
    await userInput.fill(login);
    await senhaInput.fill(senha);
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
    console.log(`[dn] unidade "${unidade}" → Continuar`);
    const itemExact = page.getByText(unidade, { exact: true }).first();
    const itemFuzzy = page.getByText(/Col[eé]gio\s+(de\s+)?Demonstra/i).first();
    if (await itemExact.isVisible().catch(() => false)) await itemExact.click();
    else if (await itemFuzzy.isVisible().catch(() => false)) await itemFuzzy.click();
    else {
      throw new Error(
        `[dn] unidade "${unidade}" não encontrada na tela Selecione sua unidade`,
      );
    }
    await continuar.click({ timeout: 15_000 });
  }

  await geral.waitFor({ state: "visible", timeout: 60_000 });
}

async function resolverEscopoBusca(page: Page): Promise<Escopo> {
  await page.waitForSelector("iframe", { state: "attached", timeout: 15_000 }).catch(() => null);

  const iframes = page.locator("iframe");
  const n = await iframes.count();
  const infos: string[] = [];
  for (let i = 0; i < n; i++) {
    const src = (await iframes.nth(i).getAttribute("src")) || "";
    const name = (await iframes.nth(i).getAttribute("name")) || "";
    const id = (await iframes.nth(i).getAttribute("id")) || "";
    infos.push(`[${i}] id=${id} name=${name} src=${src}`);
  }
  console.log(`[dn] iframes=${n} ${infos.join(" | ") || "(nenhum)"}`);

  for (let i = 0; i < n; i++) {
    const fl = page.frameLocator("iframe").nth(i);
    try {
      await fl
        .getByText(/Procurar por|Procurar/i)
        .first()
        .waitFor({ state: "visible", timeout: 5_000 });
      console.log(`[dn] escopo=frameLocator[${i}]`);
      return fl;
    } catch {
      /* next */
    }
  }

  for (const fr of page.frames()) {
    if (fr === page.mainFrame()) continue;
    try {
      await fr
        .getByText(/Procurar por|Procurar/i)
        .first()
        .waitFor({ state: "visible", timeout: 2_000 });
      console.log(`[dn] escopo=Frame ${fr.url()}`);
      return fr;
    } catch {
      /* next */
    }
  }

  for (let i = 0; i < n; i++) {
    const src = await iframes.nth(i).getAttribute("src");
    if (!src || src.startsWith("about:")) continue;
    try {
      const abs = new URL(src, page.url()).href;
      console.log(`[dn] fallback goto iframe src → ${abs}`);
      await page.goto(abs, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.getByText(/Procurar por|Procurar/i).first().waitFor({
        state: "visible",
        timeout: 15_000,
      });
      return page;
    } catch (e) {
      console.log(`[dn] goto falhou: ${e}`);
    }
  }

  if (await page.getByText(/Procurar por|Procurar/i).first().isVisible().catch(() => false)) {
    return page;
  }

  throw new Error(`Procurar por inacessível. iframes=${n} ${infos.join("; ")}`);
}

function campoBusca(escopo: Escopo) {
  return escopo
    .locator("#CEdtProcura, #CEdtValor, input[type='text']")
    .filter({ visible: true })
    .first();
}

export type AjustarDnOpts = {
  /** Força seed mesmo se já rodou nesta run do Node. */
  force?: boolean;
};

/**
 * Ajusta DN do colaborador Aniversariante para hoje (dia/mês).
 * Idempotente na mesma run do processo (FILTRO-02 + 09 compartilham o seed).
 */
export async function garantirDnAniversariante(
  playwrightRoot: string,
  opts?: AjustarDnOpts,
): Promise<string> {
  loadDotEnv(playwrightRoot);

  if (process.env.SKIP_ANIVERSARIANTE_DN === "1") {
    const dn = dataNascimentoAlvo();
    console.log(`[dn] SKIP_ANIVERSARIANTE_DN=1 — pulando seed (alvo seria ${dn})`);
    return dn;
  }

  if (seedFeitoNestaRun && !opts?.force) {
    const dn = dataNascimentoAlvo();
    console.log(`[dn] seed já feito nesta run — reutiliza (${dn})`);
    return dn;
  }

  const gestaoUrl =
    process.env.PLAYWRIGHT_DN_GESTAO_URL?.trim() ||
    process.env.PLAYWRIGHT_GESTAO_URL?.trim() ||
    "https://amostra.polygonus.com.br:8443/web/react/gestao";

  const login =
    process.env.PLAYWRIGHT_DN_LOGIN?.trim() ||
    process.env.LOGIN_SUPPETER?.trim() ||
    "SUPPETER";

  const senha =
    process.env.PLAYWRIGHT_DN_SENHA?.trim() ||
    process.env.SENHA?.trim() ||
    "poly1000";

  const unidade =
    process.env.PLAYWRIGHT_UNIDADE?.trim() || "Colégio Demonstração";

  const colaborador =
    process.env.PLAYWRIGHT_ANIVERSARIANTE_NOME?.trim() || "Aniversariante";

  const profileDir =
    process.env.PLAYWRIGHT_CHROME_PROFILE_ANIVERSARIANTE?.trim() ||
    path.join(playwrightRoot, ".auth", "pw-aniversariante");

  const dnAlvo = dataNascimentoAlvo();
  console.log(
    `[dn] alvo=${dnAlvo} url=${gestaoUrl} login=${login} profile=${profileDir}`,
  );

  const context = await chromium.launchPersistentContext(profileDir, {
    channel: "chrome",
    headless: process.env.PLAYWRIGHT_HEADED === "0",
    locale: "pt-BR",
    viewport: { width: 1400, height: 900 },
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const page = context.pages()[0] || (await context.newPage());

  try {
    await page.goto(gestaoUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await passarCloudflareSePreciso(page);
    await loginGestaoSePreciso(page, login, senha, unidade);

    const colabBtns = page.locator("nav").getByRole("button", { name: /^Colaboradores$/ });
    if (!(await colabBtns.first().isVisible().catch(() => false))) {
      await menuGeral(page).click({ timeout: 15_000 }).catch(() => undefined);
      const pessoas = page.locator("nav").getByRole("button", { name: /^Pessoas$/ }).first();
      if (await pessoas.isVisible().catch(() => false)) {
        await pessoas.evaluate((el: HTMLElement) => el.click());
        await page.waitForTimeout(400);
      }
    }

    const nColab = await colabBtns.count();
    for (let i = 0; i < Math.max(nColab, 1); i++) {
      await colabBtns.nth(i).evaluate((el: HTMLElement) => el.click());
      await page.waitForTimeout(1000);
      if ((await page.locator("iframe").count()) > 0) break;
    }

    const escopo = await resolverEscopoBusca(page);
    const busca = campoBusca(escopo);
    await expect(busca).toBeVisible({ timeout: 15_000 });
    await busca.click();
    await busca.fill("");
    await busca.pressSequentially(colaborador, { delay: 50 });
    await busca.press("Enter");
    console.log(`[dn] buscou "${colaborador}" no iframe`);
    await page.waitForTimeout(1500);

    const nomeNaLista = escopo
      .getByRole("cell", { name: colaborador })
      .or(escopo.getByText(colaborador, { exact: true }))
      .first();
    await expect(nomeNaLista).toBeVisible({ timeout: 30_000 });
    await nomeNaLista.dblclick();

    if (
      !(await escopo
        .getByRole("button", { name: /^Gravar$/i })
        .isVisible()
        .catch(() => false))
    ) {
      await nomeNaLista.click();
      const alterar = escopo.getByRole("button", { name: /^Alterar$/i });
      if (await alterar.isVisible().catch(() => false)) {
        await alterar.click();
      }
    }

    await page.waitForTimeout(8000);

    let ficha: Escopo = escopo;
    const nFrames = await page.locator("iframe").count();
    for (let i = 0; i < nFrames; i++) {
      const fl = page.frameLocator("iframe").nth(i);
      const temGravar = await fl.locator("#CBtnGravar").isVisible().catch(() => false);
      if (temGravar) {
        ficha = fl;
        console.log(`[dn] ficha no iframe[${i}]`);
        break;
      }
    }

    const gravar = ficha.locator("#CBtnGravar");
    await expect(gravar).toBeVisible({ timeout: 20_000 });
    console.log("[dn] ficha aberta — ajustando Data Nascimento (#CEdtDatNascimento)");

    const dnInput = ficha.locator("#CEdtDatNascimento");
    await expect(dnInput).toBeVisible({ timeout: 15_000 });
    await dnInput.scrollIntoViewIfNeeded();

    async function escreverDataNascimento(valor: string) {
      await dnInput.click();
      await dnInput.evaluate((el) => {
        const input = el as HTMLInputElement;
        const w = window as unknown as { IgEditFocus?: (e: HTMLElement) => void };
        w.IgEditFocus?.(input);
        input.select();
      });
      await page.keyboard.press("Control+A");
      await page.keyboard.press("Backspace");
      await page.keyboard.type(valor.replace(/\D/g, ""), { delay: 120 });
      await ficha.locator("#CEdtNomPessoa").click();
      await page.waitForTimeout(1500);
      return dnInput.inputValue();
    }

    const antes = await dnInput.inputValue();
    console.log(`[dn] Data Nascimento antes=${antes} → alvo=${dnAlvo}`);

    if (antes.replace(/\D/g, "") === dnAlvo.replace(/\D/g, "")) {
      const pivot = "01012014";
      console.log(`[dn] DN já era o alvo — pivot ${pivot} para sujar a ficha`);
      const pivotVal = await escreverDataNascimento(pivot);
      console.log(`[dn] pivot aplicado=${pivotVal}`);
    }

    let depois = await escreverDataNascimento(dnAlvo);
    console.log(`[dn] Data Nascimento após digitar=${depois}`);
    if (depois.replace(/\D/g, "") !== dnAlvo.replace(/\D/g, "")) {
      await dnInput.evaluate((el, value) => {
        const input = el as HTMLInputElement;
        const w = window as unknown as {
          IgEditFocus?: (e: HTMLElement) => void;
          IgEditBlur?: (e: HTMLElement) => void;
        };
        w.IgEditFocus?.(input);
        input.value = value;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        w.IgEditBlur?.(input);
      }, dnAlvo);
      await ficha.locator("#CEdtNomPessoa").click();
      await page.waitForTimeout(1000);
      depois = await dnInput.inputValue();
      console.log(`[dn] Data Nascimento fallback JS=${depois}`);
    }
    expect(depois.replace(/\D/g, "")).toBe(dnAlvo.replace(/\D/g, ""));
    console.log(
      `[dn] DN confirmada (${depois}) — 8s e só então #CBtnGravar (não foto)`,
    );

    await page.waitForTimeout(8000);
    console.log("[dn] clicando #CBtnGravar (último / ficha)…");
    await gravar.evaluate((el) => {
      const btn = el as HTMLButtonElement;
      const w = window as unknown as { IgButtonClick?: (e: HTMLElement) => void };
      if (btn.id !== "CBtnGravar") {
        throw new Error(`Gravar errado: id=${btn.id}`);
      }
      if (typeof w.IgButtonClick === "function") w.IgButtonClick(btn);
      else btn.click();
    });
    await page.waitForTimeout(1500);

    const atencao = ficha.getByText(/Para efetuar alterações é necessário marcar um item/i);
    if (await atencao.isVisible().catch(() => false)) {
      console.log("[dn] FALHA: alerta Atenção (Gravar sem alteração detectada)");
      await ficha.getByRole("button", { name: /^OK$/i }).click().catch(() => undefined);
      throw new Error(
        'Apareceu "Para efetuar alterações é necessário marcar um item da lista." — DN não foi considerada alterada antes do Gravar.',
      );
    }

    const aposGravar = await dnInput.inputValue().catch(() => "(sumiu)");
    console.log(`[dn] após Gravar, Data Nascimento=${aposGravar}`);
    console.log(`[dn] gravado ok`);
    seedFeitoNestaRun = true;
    return dnAlvo;
  } finally {
    await context.close();
  }
}
