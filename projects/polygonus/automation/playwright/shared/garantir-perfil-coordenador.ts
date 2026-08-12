/**
 * Garante função COORDENADOR no Flutter (espelho Maestro garantir_perfil_coordenador).
 * Sem isso, envios de Professor caem em Pendentes — não em Enviadas.
 */
import type { Page } from "@playwright/test";
import {
  flutterFrameLocator,
  tapFlutterByAccessibleName,
  tapFlutterSemId,
} from "./flutter-comunicados";

const LOG = "[perfil-web]";

export async function garantirPerfilCoordenador(page: Page): Promise<void> {
  const frame = flutterFrameLocator(page);
  console.log(`${LOG} garantindo COORDENADOR`);

  // Se já estamos no Mural, volta à home
  if (
    (await frame
      .locator('[flt-semantics-identifier="mural_boom_fab"]')
      .count()) > 0
  ) {
    await page.keyboard.press("Escape").catch(() => undefined);
    // Back no app bar Flutter
    const back = frame.getByText(/^Back$/i).first();
    if (await back.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await back.click({ force: true });
      await page.waitForTimeout(800);
    } else {
      // seta voltar ~canto superior esquerdo do iframe
      const box = await page
        .locator(
          'iframe[title="Flutter"], iframe[src*="flutter"]',
        )
        .first()
        .boundingBox();
      if (box) await page.mouse.click(box.x + 28, box.y + 28);
      await page.waitForTimeout(800);
    }
  }

  // Abrir menu usuário → Perfil
  if (!(await tapFlutterSemId(page, "home_menu_usuario"))) {
    await tapFlutterByAccessibleName(page, /Pedro Jesus|^Pedro$/i);
  }
  await page.waitForTimeout(700);

  if (!(await tapFlutterSemId(page, "home_menu_perfil"))) {
    if (!(await tapFlutterByAccessibleName(page, /^Perfil$/i))) {
      await frame.getByText(/^Perfil$/i).first().click({ force: true });
    }
  }
  await page.waitForTimeout(1_200);

  // Já COORDENADOR no chip? (não clicar — só inspecionar)
  const chipCoord = await frame.locator("body").evaluate(() => {
    const re = /COORDENADOR/i;
    let found = false;
    const walk = (node: Node | null) => {
      if (!node || found) return;
      if (node instanceof Element) {
        const t = ((node as HTMLElement).innerText || "").trim().split("\n")[0] || "";
        const aria = node.getAttribute("aria-label") || "";
        if (re.test(t) || re.test(aria)) {
          const r = node.getBoundingClientRect();
          if (r.width > 40 && r.width < 400 && r.height < 80 && r.y < 400) {
            found = true;
          }
        }
        if (node.shadowRoot) walk(node.shadowRoot);
        for (const c of Array.from(node.children)) walk(c);
      }
    };
    walk(document.body);
    return found;
  });

  if (chipCoord) {
    console.log(`${LOG} já COORDENADOR — voltando`);
    await voltarParaHomeFlutter(page);
    return;
  }

  console.log(`${LOG} trocando função → COORDENADOR`);
  if (!(await tapFlutterSemId(page, "perfil_dropdown_funcao"))) {
    // chip de outro perfil
    await tapFlutterByAccessibleName(
      page,
      /^(PROFESSORES|SUPORTE|SECRETARIA|RESPONSAVEIS)$/i,
    );
  }
  await page.waitForTimeout(800);

  if (!(await tapFlutterByAccessibleName(page, /^COORDENADOR$/i))) {
    await frame.getByText(/^COORDENADOR$/i).first().click({ force: true, timeout: 10_000 });
  }
  await page.waitForTimeout(800);
  await voltarParaHomeFlutter(page);
  console.log(`${LOG} COORDENADOR ok`);
}

async function voltarParaHomeFlutter(page: Page): Promise<void> {
  const frame = flutterFrameLocator(page);
  for (let i = 0; i < 3; i++) {
    if (
      (await frame
        .locator('[flt-semantics-identifier="home_card_mural"]')
        .count()) > 0
    ) {
      return;
    }
    await page.keyboard.press("Escape").catch(() => undefined);
    const box = await page
      .locator('iframe[title="Flutter"], iframe[src*="flutter"]')
      .first()
      .boundingBox();
    if (box) await page.mouse.click(box.x + 28, box.y + 28);
    await page.waitForTimeout(700);
  }
}
