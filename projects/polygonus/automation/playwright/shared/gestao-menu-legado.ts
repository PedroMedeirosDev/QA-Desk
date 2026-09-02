/**
 * Navegação na gestão React → telas Delphi (iframe acropolymodule / acropoly).
 * Não usar page.goto(/academico/...) — isso força a versão React.
 */
import type { FrameLocator, Page } from "@playwright/test";

export const LEGACY_IFRAME_SEL =
  'iframe[src*="acropolymodule"], iframe[src*="/acropoly/"]';

/** Força preferência de versão clássica no espelho local do menu. */
export async function forcarVersaoClassicaMenu(
  page: Page,
  codMenuItem: string,
  logPrefix = "[legado]",
) {
  const chavePref = `menu.versao.${codMenuItem}`;
  const alterou = await page.evaluate((prefKey) => {
    let mudou = false;
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (!storageKey?.startsWith("gestao_prefs:")) continue;
      try {
        const prefs = JSON.parse(
          localStorage.getItem(storageKey) || "{}",
        ) as Record<string, string>;
        if (prefs[prefKey] === "C") continue;
        prefs[prefKey] = "C";
        localStorage.setItem(storageKey, JSON.stringify(prefs));
        mudou = true;
      } catch {
        /* ignora chave inválida */
      }
    }
    return mudou;
  }, chavePref);
  if (alterou) {
    console.log(`${logPrefix} versão clássica forçada (${chavePref})`);
  }
}

/** Expande a sidebar se estiver no modo ícones (campo de busca fica oculto). */
export async function expandirMenuSeRecolhido(page: Page, logPrefix: string) {
  const expandir = page.getByRole("button", { name: /^Expandir menu$/i });
  if (await expandir.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await expandir.click();
    console.log(`${logPrefix} menu expandido`);
    await page.waitForTimeout(400);
  }
}

/** Abre folhas pelo caminho no nav (ex.: Acadêmico → Alunos → Histórico Escolar). */
export async function navegarCaminhoMenu(
  page: Page,
  caminho: string[],
  logPrefix: string,
) {
  await expandirMenuSeRecolhido(page, logPrefix);
  const nav = page.locator("nav");
  for (const label of caminho) {
    const re = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
    const btn = nav.getByRole("button", { name: re }).first();
    await btn.waitFor({ state: "visible", timeout: 20_000 });
    await btn.evaluate((el: HTMLElement) => el.click());
    console.log(`${logPrefix} menu caminho → ${label}`);
    await page.waitForTimeout(450);
  }
}

async function pesquisarNoMenu(page: Page, termoMenu: string, log: string) {
  await expandirMenuSeRecolhido(page, log);
  const search = page.getByLabel(/Pesquisar no menu/i).first();
  await search.waitFor({ state: "attached", timeout: 15_000 });
  if (!(await search.isVisible().catch(() => false))) {
    return false;
  }
  await search.fill("");
  await search.fill(termoMenu);
  await page.waitForTimeout(500);
  return true;
}

/** Pesquisa no menu lateral e abre a folha — espera iframe Delphi. */
export async function abrirTelaLegadoNoMenu(
  page: Page,
  termoMenu: string,
  opts?: {
    codMenuVersaoClassica?: string;
    caminho?: string[];
    log?: string;
  },
): Promise<FrameLocator> {
  const log = opts?.log ?? "[legado]";

  if (opts?.codMenuVersaoClassica) {
    await forcarVersaoClassicaMenu(page, opts.codMenuVersaoClassica, log);
  }

  await page
    .getByRole("button", { name: /^Geral$/i })
    .first()
    .waitFor({ state: "visible", timeout: 45_000 });

  const buscou = await pesquisarNoMenu(page, termoMenu, log);
  if (buscou) {
    const re = new RegExp(
      termoMenu.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );
    const item = page.getByRole("button", { name: re }).first();
    if (await item.isVisible({ timeout: 8_000 }).catch(() => false)) {
      console.log(`${log} menu busca → ${termoMenu}`);
      await item.evaluate((el: HTMLElement) => el.click());
    } else if (opts?.caminho?.length) {
      await navegarCaminhoMenu(page, opts.caminho, log);
    } else {
      throw new Error(`${log} item "${termoMenu}" não apareceu na busca do menu`);
    }
  } else if (opts?.caminho?.length) {
    await navegarCaminhoMenu(page, opts.caminho, log);
  } else {
    throw new Error(`${log} campo "Pesquisar no menu" indisponível — informe opts.caminho`);
  }

  const iframe = page.locator(LEGACY_IFRAME_SEL).first();
  await iframe.waitFor({ state: "attached", timeout: 90_000 });
  const src = (await iframe.getAttribute("src")) || "";
  console.log(`${log} iframe legado src=${src.slice(0, 160)}`);

  if (/\/academico\/historico-escolar/i.test(page.url())) {
    throw new Error(
      `${log} abriu rota React (${page.url()}) — confira preferência versão clássica do menu`,
    );
  }

  await page.waitForTimeout(2_000);
  return page.frameLocator(LEGACY_IFRAME_SEL).first();
}

function campoBuscaLegado(escopo: FrameLocator) {
  return escopo
    .locator("#CEdtProcura, #CEdtValor, input[type='text']")
    .filter({ visible: true })
    .first();
}

/** Procura texto no grid legado (Procurar por + Enter) e abre o registro. */
export async function buscarRegistroNoLegado(
  page: Page,
  frame: FrameLocator,
  texto: string,
  logPrefix: string,
) {
  const termo =
    process.env.PLAYWRIGHT_ALUNO_BUSCA?.trim() ||
    (texto.length > 24 ? texto.slice(0, 24) : texto);
  const re = new RegExp(texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

  await frame
    .getByText(/Procurar por|Procurar/i)
    .first()
    .waitFor({ state: "visible", timeout: 30_000 })
    .catch(() => undefined);

  const busca = campoBuscaLegado(frame);
  await busca.waitFor({ state: "visible", timeout: 20_000 });
  await busca.click();
  await busca.fill("");
  await busca.pressSequentially(termo, { delay: 45 });
  await busca.press("Enter");
  console.log(`${logPrefix} legado buscou "${termo}"`);
  await page.waitForTimeout(1_500);

  const linha = frame
    .getByRole("cell", { name: re })
    .or(frame.getByText(re))
    .first();
  await linha.waitFor({ state: "visible", timeout: 45_000 });
  await linha.dblclick().catch(() => linha.click());
  console.log(`${logPrefix} registro aberto: ${texto}`);
}
