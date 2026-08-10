/**
 * Abre o app Flutter web via gestão: Comunicação → Comunicados.
 */
import type { Frame, Page } from "@playwright/test";

const LOG = "[comunicados-web]";

const FLUTTER_IFRAME =
  'iframe[title="Flutter"], iframe[src*="/acropoly/web/flutter/"], iframe[src*="/web/flutter/"], iframe[src*="flutter"]';

async function clickDom(locator: ReturnType<Page["locator"]>) {
  await locator.first().evaluate((el: HTMLElement) => el.click());
}

export function flutterFrameLocator(page: Page) {
  return page.frameLocator(FLUTTER_IFRAME);
}

/** Expande Comunicação (se fechado) e clica Comunicados. */
export async function abrirComunicadosNaGestao(page: Page) {
  await page
    .getByRole("button", { name: /^Geral$/i })
    .first()
    .waitFor({ state: "visible", timeout: 45_000 });

  // Atalho: busca no menu (evita expandir árvore / overlays)
  const search = page.getByPlaceholder(/Pesquisar no menu/i).first();
  if (await search.isVisible().catch(() => false)) {
    console.log(`${LOG} buscando Comunicados no menu…`);
    await search.fill("Comunicados");
    await page.waitForTimeout(400);
  }

  let comunicados = page.getByRole("button", { name: /^Comunicados$/i }).first();
  if (!(await comunicados.isVisible().catch(() => false))) {
    const comunicacao = page
      .getByRole("button", { name: /^Comunica(?:ção|cao)$/i })
      .first();
    await comunicacao.waitFor({ state: "visible", timeout: 30_000 });
    console.log(`${LOG} expandindo Comunicação…`);
    await clickDom(comunicacao);
    await page.waitForTimeout(400);
    comunicados = page.getByRole("button", { name: /^Comunicados$/i }).first();
    await comunicados.waitFor({ state: "visible", timeout: 15_000 });
  }

  console.log(`${LOG} abrindo Comunicados…`);
  const mobileUrl = page
    .waitForResponse(
      (r) =>
        r.url().includes("/auth/mobile_url") && r.request().method() === "GET",
      { timeout: 60_000 },
    )
    .catch(() => null);

  await clickDom(comunicados);
  const resp = await mobileUrl;
  if (resp) console.log(`${LOG} mobile_url status=${resp.status()}`);

  const iframe = page.locator(FLUTTER_IFRAME).first();
  await iframe.waitFor({ state: "attached", timeout: 90_000 });
  const src = (await iframe.getAttribute("src")) || "";
  console.log(`${LOG} iframe Flutter anexado src=${src.slice(0, 120)}`);
  await page.waitForTimeout(2_500);
}

/**
 * Tenta achar tile MURAL (ou home) no Flutter web.
 * Retorna "a11y" | "text" | "none".
 */
export async function probeHomeFlutter(
  page: Page,
): Promise<{ mode: "a11y" | "text" | "none"; detail: string }> {
  const frameEl = page.locator(FLUTTER_IFRAME).first();
  const handle = await frameEl.elementHandle();
  const frame: Frame | null = handle ? await handle.contentFrame() : null;
  if (!frame) {
    return { mode: "none", detail: "iframe sem contentFrame" };
  }

  // Aguarda engine
  await frame.waitForTimeout(4_000);

  const semantics = frame.locator(
    "flt-semantics, [flt-semantics-identifier], [aria-label]",
  );
  const semCount = await semantics.count().catch(() => 0);

  const byRole = frame.getByRole("button", { name: /MURAL/i });
  if (await byRole.first().isVisible({ timeout: 8_000 }).catch(() => false)) {
    return { mode: "a11y", detail: `role button MURAL (semantics~${semCount})` };
  }

  const byLabel = frame.getByLabel(/MURAL/i);
  if (await byLabel.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
    return { mode: "a11y", detail: `label MURAL (semantics~${semCount})` };
  }

  const byText = frame.getByText(/MURAL/i);
  if (await byText.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
    return { mode: "text", detail: `texto MURAL (semantics~${semCount})` };
  }

  const bodyText = await frame.locator("body").innerText().catch(() => "");
  const snap = bodyText.slice(0, 200).replace(/\s+/g, " ");
  const canvases = await frame.locator("canvas, flt-glass-pane, flutter-view").count().catch(() => 0);
  return {
    mode: "none",
    detail: `sem MURAL no DOM (semantics=${semCount}; canvases/flt=${canvases}; body="${snap}")`,
  };
}

/** Clica um menu da home Flutter por nome (se a11y permitir). */
export async function tapMenuFlutterSeVisivel(
  page: Page,
  nome: RegExp,
): Promise<boolean> {
  const app = flutterFrameLocator(page);
  const tile = app
    .getByRole("button", { name: nome })
    .or(app.getByLabel(nome))
    .or(app.getByText(nome))
    .first();
  if (!(await tile.isVisible({ timeout: 5_000 }).catch(() => false))) {
    return false;
  }
  await tile.click();
  await page.waitForTimeout(1_500);
  return true;
}
