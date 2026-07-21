/**
 * FILTRO-02 / FILTRO-09 — seed web: ajusta DN do colaborador "Aniversariante"
 * para o dia/mês do teste (ano preservado). Usuário dedicado — sem reverter.
 *
 * Formulario de Colaboradores fica em **iframe**.
 * Login gestão: PHJESUS / poly1000 → unidade → Continuar
 * Menu: Geral → Pessoas → Colaboradores → busca no iframe → DN → Gravar
 */
import {
  test,
  expect,
  chromium,
  type Page,
  type Frame,
  type FrameLocator,
} from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

function loadDotEnv() {
  const candidates = [
    path.join(__dirname, "..", ".env"),
    path.join(__dirname, "..", "..", "maestro", "flows", ".env"),
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

loadDotEnv();

const GESTAO_URL =
  process.env.PLAYWRIGHT_GESTAO_URL?.trim() ||
  "https://amostra.polygonus.com.br/web/react/gestao";

const LOGIN =
  process.env.PLAYWRIGHT_LOGIN?.trim() ||
  process.env.LOGIN_PHJESUS?.trim() ||
  "PHJESUS";

const SENHA =
  process.env.PLAYWRIGHT_SENHA?.trim() ||
  process.env.SENHA?.trim() ||
  "poly1000";

const UNIDADE =
  process.env.PLAYWRIGHT_UNIDADE?.trim() || "Colégio de Demonstração";

const COLABORADOR =
  process.env.PLAYWRIGHT_ANIVERSARIANTE_NOME?.trim() || "Aniversariante";

const PROFILE_DIR =
  process.env.PLAYWRIGHT_CHROME_PROFILE?.trim() ||
  path.join(__dirname, "..", ".auth", "pw-aniversariante");

type Escopo = Page | Frame | FrameLocator;

function dataNascimentoAlvo(agora = new Date()): string {
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
    console.log(`[dn] login gestão como ${LOGIN}`);
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
    console.log(`[dn] unidade "${UNIDADE}" → Continuar`);
    const item = page.getByText(UNIDADE, { exact: true }).first();
    if (await item.isVisible().catch(() => false)) await item.click();
    await continuar.click({ timeout: 15_000 });
  }

  await geral.waitFor({ state: "visible", timeout: 60_000 });
}

/** Encontra o iframe (ou page) com o campo "Procurar por". */
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

  // frameLocator — tenta cada um
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

  // Frame API
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

  // Cross-origin: abrir src do iframe na aba
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
  // Há inputs text ocultos; a busca visível fica ao lado do combo Nome (CEdtTipProcura)
  return escopo
    .locator("#CEdtProcura, #CEdtValor, input[type='text']")
    .filter({ visible: true })
    .first();
}

test.use({ storageState: { cookies: [], origins: [] } });

test("ajustar DN Aniversariante (dia/mês do teste)", async () => {
  test.setTimeout(240_000);
  const dnAlvo = dataNascimentoAlvo();
  console.log(
    `[dn] alvo=${dnAlvo} url=${GESTAO_URL} login=${LOGIN} profile=${PROFILE_DIR}`,
  );

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

    // Menu lateral (fora do iframe)
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
    await busca.pressSequentially(COLABORADOR, { delay: 50 });
    await busca.press("Enter");
    console.log(`[dn] buscou "${COLABORADOR}" no iframe`);
    await page.waitForTimeout(1500);

    const nomeNaLista = escopo
      .getByRole("cell", { name: COLABORADOR })
      .or(escopo.getByText(COLABORADOR, { exact: true }))
      .first();
    await expect(nomeNaLista).toBeVisible({ timeout: 30_000 });
    await nomeNaLista.dblclick();

    // Lista não tem Gravar — se não abriu a ficha, usa Alterar
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

    // Ficha demora a montar (legado Acropoly) — 8s
    await page.waitForTimeout(8000);

    // Após abrir, a ficha pode estar no mesmo iframe ou num 2º (src vazio)
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

    // Gravar da ficha = #CBtnGravar (NÃO #CBtnGrvImage da foto)
    const gravar = ficha.locator("#CBtnGravar");
    await expect(gravar).toBeVisible({ timeout: 20_000 });
    console.log("[dn] ficha aberta — ajustando Data Nascimento (#CEdtDatNascimento)");

    const dnInput = ficha.locator("#CEdtDatNascimento");
    await expect(dnInput).toBeVisible({ timeout: 15_000 });
    await dnInput.scrollIntoViewIfNeeded();

    /** Digita DN com máscara + commit saindo para o campo Nome. */
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

    // Se já está no alvo, Acropoly não vê alteração → alerta
    // "Para efetuar alterações é necessário marcar um item da lista."
    // Força mudança intermediária e só depois aplica o alvo.
    if (antes.replace(/\D/g, "") === dnAlvo.replace(/\D/g, "")) {
      const pivot = "01012014"; // 01/01/2014
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
      // Garante que não é o da foto
      if (btn.id !== "CBtnGravar") {
        throw new Error(`Gravar errado: id=${btn.id}`);
      }
      if (typeof w.IgButtonClick === "function") w.IgButtonClick(btn);
      else btn.click();
    });
    await page.waitForTimeout(1500);

    // Alerta típico se gravou sem alteração detectada
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
  } finally {
    await context.close();
  }
});
