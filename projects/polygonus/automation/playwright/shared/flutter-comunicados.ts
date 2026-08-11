/**
 * Flutter web via gestão: Comunicação → Comunicados.
 * Preferir [flt-semantics-identifier] no iframe; fallback texto/clique geométrico.
 */
import type { FrameLocator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

const LOG = "[comunicados-web]";

export const FLUTTER_IFRAME =
  'iframe[title="Flutter"], iframe[src*="/acropoly/web/flutter/"], iframe[src*="/web/flutter/"], iframe[src*="flutter"]';

async function clickDom(locator: ReturnType<Page["locator"]>) {
  await locator.first().evaluate((el: HTMLElement) => el.click());
}

export function flutterFrameLocator(page: Page): FrameLocator {
  return page.frameLocator(FLUTTER_IFRAME);
}

/** Expande Comunicação (se fechado) e clica Comunicados. */
export async function abrirComunicadosNaGestao(page: Page) {
  await page
    .getByRole("button", { name: /^Geral$/i })
    .first()
    .waitFor({ state: "visible", timeout: 45_000 });

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

/** Deep search flt-semantics-identifier (incl. shadow DOM). */
async function collectSemanticsIds(frame: FrameLocator): Promise<string[]> {
  return frame.locator("body").evaluate((body) => {
    const out: string[] = [];
    const walk = (node: Node | null | undefined) => {
      if (!node) return;
      if (node instanceof Element) {
        const id = node.getAttribute("flt-semantics-identifier");
        if (id) out.push(id);
        if (node.shadowRoot) walk(node.shadowRoot);
        for (const child of Array.from(node.children)) walk(child);
      }
    };
    walk(body);
    const doc = body.ownerDocument;
    if (doc?.documentElement) walk(doc.documentElement);
    return [...new Set(out)];
  });
}

/** Fecha modal "Continuar" (notificações) — só com texto/role visível (sem clique cego). */
export async function dismissContinuarOverlay(
  page: Page,
  frame?: FrameLocator,
): Promise<void> {
  const app = frame ?? flutterFrameLocator(page);
  const candidates = [
    app.getByRole("button", { name: /continuar/i }),
    app.getByText(/^Continuar$/i),
    page.getByRole("button", { name: /continuar/i }),
    page.getByText(/^Continuar$/i),
  ];
  for (const loc of candidates) {
    if (await loc.first().isVisible({ timeout: 1_200 }).catch(() => false)) {
      await loc.first().click({ force: true, timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(600);
      return;
    }
  }
}

/** Fecha overlay de comunicado / viewer (X) que tapa a home. */
export async function dismissFlutterCloseOverlay(
  page: Page,
  frame?: FrameLocator,
  opts?: { geometric?: boolean },
): Promise<void> {
  const app = frame ?? flutterFrameLocator(page);
  const closers = [
    app.locator('[flt-semantics-identifier*="fechar"]'),
    app.locator('[aria-label*="Fechar" i]'),
    app.getByRole("button", { name: /fechar|close/i }),
  ];
  for (const loc of closers) {
    if (await loc.first().isVisible({ timeout: 600 }).catch(() => false)) {
      await loc.first().click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(500);
      return;
    }
  }
  if (!opts?.geometric) return;
  // X do viewer costuma ficar no canto superior esquerdo do iframe
  const box = await page.locator(FLUTTER_IFRAME).first().boundingBox();
  if (box) {
    await page.mouse.click(box.x + 28, box.y + 28);
    await page.waitForTimeout(500);
  }
}

export async function tapFlutterSemId(
  page: Page,
  identifier: string,
): Promise<boolean> {
  const frame = flutterFrameLocator(page);
  const selectors = [
    `[flt-semantics-identifier="${identifier}"]`,
    `flt-semantics-host [flt-semantics-identifier="${identifier}"]`,
  ];
  for (const sel of selectors) {
    const loc = frame.locator(sel).first();
    if (await loc.isVisible({ timeout: 1_200 }).catch(() => false)) {
      await loc.click({ force: true, timeout: 8_000 });
      return true;
    }
  }
  return frame.locator("body").evaluate((body, id) => {
    const find = (node: Node | null | undefined): Element | null => {
      if (!node) return null;
      if (node instanceof Element) {
        if (node.getAttribute("flt-semantics-identifier") === id) return node;
        if (node.shadowRoot) {
          const inShadow = find(node.shadowRoot);
          if (inShadow) return inShadow;
        }
        for (const child of Array.from(node.children)) {
          const found = find(child);
          if (found) return found;
        }
      }
      return null;
    };
    const el = find(body) || find(body.ownerDocument?.documentElement);
    if (!el) return false;
    (el as HTMLElement).click();
    return true;
  }, identifier);
}

export async function openMuralFromHome(page: Page): Promise<void> {
  const frame = flutterFrameLocator(page);
  if (await tapFlutterSemId(page, "home_card_mural")) {
    await page.waitForTimeout(1_000);
    return;
  }
  const byText = frame.getByText(/^MURAL$/i).first();
  if (await byText.isVisible({ timeout: 2_500 }).catch(() => false)) {
    await byText.click({ force: true });
    await page.waitForTimeout(1_200);
    return;
  }
  const box = await page.locator(FLUTTER_IFRAME).first().boundingBox();
  if (box) {
    // 1º card da grade (MURAL) — canto superior esquerdo da área útil
    await page.mouse.click(box.x + box.width * 0.18, box.y + box.height * 0.42);
    await page.waitForTimeout(1_200);
  }
}

export type MuralProbe = {
  mode: "semantics" | "text" | "shell" | "none";
  detail: string;
  sampleIds: string[];
};

/**
 * Probe: espera flt-semantics-identifier no iframe (como no DevTools).
 * Não faz clique cego no centro (abria comunicado e zerava a home).
 */
export async function probeMuralFlutter(page: Page): Promise<MuralProbe> {
  const frame = flutterFrameLocator(page);
  await expect(page.locator(FLUTTER_IFRAME).first()).toBeAttached({
    timeout: 90_000,
  });

  await page.waitForTimeout(2_500);
  await dismissContinuarOverlay(page, frame);
  await dismissFlutterCloseOverlay(page, frame);

  let sampleIds: string[] = [];
  let triedGeometricClose = false;

  await expect
    .poll(
      async () => {
        await dismissContinuarOverlay(page, frame);
        const viaLocator = await frame
          .locator("[flt-semantics-identifier]")
          .count()
          .catch(() => 0);
        try {
          sampleIds = await collectSemanticsIds(frame);
        } catch {
          sampleIds = [];
        }
        if (viaLocator > 0) {
          sampleIds = await frame
            .locator("[flt-semantics-identifier]")
            .evaluateAll((els) =>
              els
                .map((el) => el.getAttribute("flt-semantics-identifier") || "")
                .filter(Boolean),
            )
            .catch(() => sampleIds);
        }
        if (sampleIds.length === 0 && !triedGeometricClose) {
          triedGeometricClose = true;
          await dismissFlutterCloseOverlay(page, frame, { geometric: true });
        }
        return sampleIds.length;
      },
      {
        timeout: 45_000,
        intervals: [1_000, 2_000, 3_000],
        message: "flt-semantics-identifier não apareceu no iframe Flutter",
      },
    )
    .toBeGreaterThan(0)
    .catch(() => undefined);

  if (sampleIds.length > 0) {
    const useful = sampleIds.some(
      (id) =>
        id.startsWith("mural_") ||
        id.startsWith("home_card_") ||
        id.startsWith("home_menu_"),
    );
    return {
      mode: "semantics",
      detail: `ids(${sampleIds.length})=${sampleIds.slice(0, 12).join(",")}${useful ? "" : " (sem home/mural)"}`,
      sampleIds,
    };
  }

  const byText = frame.getByText(/MURAL|COMUNICADO|Escrever|Selecionar aluno/i).first();
  if (await byText.isVisible({ timeout: 3_000 }).catch(() => false)) {
    return {
      mode: "text",
      detail: `texto visível (semantics=0)`,
      sampleIds,
    };
  }

  const hasShell =
    (await frame.locator("flutter-view, flt-glass-pane, canvas").count().catch(() => 0)) >
    0;
  const bodyLen = await frame
    .locator("body")
    .innerText()
    .then((t) => t.trim().length)
    .catch(() => 0);

  if (hasShell) {
    return {
      mode: "shell",
      detail: `Flutter canvas ok, sem a11y/texto (semantics=0; bodyLen=${bodyLen})`,
      sampleIds,
    };
  }

  return {
    mode: "none",
    detail: `iframe sem Flutter útil (semantics=0; bodyLen=${bodyLen})`,
    sampleIds,
  };
}

/** @deprecated alias — smoke antigo */
export async function probeHomeFlutter(page: Page) {
  const p = await probeMuralFlutter(page);
  return {
    mode: p.mode === "shell" ? ("none" as const) : p.mode === "semantics" ? ("a11y" as const) : p.mode,
    detail: p.detail,
  };
}

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

/**
 * Smoke action: filtro / FAB escrever no Mural.
 * Retorna o id tocado ou "fallback" / null.
 */
export async function tapMuralAcaoSmoke(page: Page): Promise<string | null> {
  const frame = flutterFrameLocator(page);
  await dismissContinuarOverlay(page, frame);
  await dismissFlutterCloseOverlay(page, frame);

  // Home → Mural se ainda não estiver no feed
  const idsHome = await collectSemanticsIds(frame).catch(() => [] as string[]);
  if (
    idsHome.some((id) => id.startsWith("home_card_") || id.startsWith("home_menu_")) &&
    !idsHome.some((id) => id.startsWith("mural_"))
  ) {
    await openMuralFromHome(page);
    await page.waitForTimeout(1_000);
  }

  const ids = [
    "mural_acao_escrever_comunicado",
    "mural_boom_fab",
    "mural_filtro_sentido",
    "home_card_mural",
  ];
  for (const id of ids) {
    if (await tapFlutterSemId(page, id)) return id;
  }

  const byText = frame.getByText(/Escrever|Novo comunicado|\+/i).first();
  if (await byText.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await byText.click({ force: true });
    return "text";
  }

  return null;
}
