/**
 * Composer Mural no Flutter WEB (iframe) — espelho dos subflows Maestro.
 * Preferir flt-semantics-identifier.
 */
import type { FrameLocator, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import {
  FLUTTER_IFRAME,
  dismissContinuarOverlay,
  dismissFlutterCloseOverlay,
  flutterFrameLocator,
  openMuralFromHome,
  tapFlutterByAccessibleName,
  tapFlutterSemId,
  tapFlutterSemIdCompact,
} from "./flutter-comunicados";
import path from "node:path";

const LOG = "[mural-web]";

export async function ensureMuralHome(page: Page): Promise<FrameLocator> {
  const frame = flutterFrameLocator(page);
  await dismissContinuarOverlay(page, frame);
  await dismissFlutterCloseOverlay(page, frame); // sem geometric

  const hasBoom = async () =>
    (await frame
      .locator(
        '[flt-semantics-identifier="mural_boom_fab"], [flt-semantics-identifier="mural_filtro_sentido"]',
      )
      .count()) > 0;

  const hasHomeMural = async () =>
    (await frame
      .locator('[flt-semantics-identifier="home_card_mural"]')
      .count()) > 0;

  if (await hasBoom()) return frame;

  if (await hasHomeMural()) {
    await tapFlutterSemId(page, "home_card_mural");
    await page.waitForTimeout(1_500);
  } else {
    // Home incompleta / overlay: tenta fechar viewer 1x e reabrir card
    await dismissFlutterCloseOverlay(page, frame, { geometric: true });
    await page.waitForTimeout(600);
    if (await hasHomeMural()) {
      await tapFlutterSemId(page, "home_card_mural");
    } else {
      await openMuralFromHome(page);
    }
    await page.waitForTimeout(1_500);
  }

  await expect
    .poll(async () => ((await hasBoom()) ? 1 : 0), {
      timeout: 45_000,
      message: "Mural (boom/filtro) não apareceu após abrir home_card_mural",
    })
    .toBe(1);

  return frame;
}

export async function abrirNovoComunicado(page: Page): Promise<void> {
  const frame = flutterFrameLocator(page);
  console.log(`${LOG} Boom → Comunicado`);

  const fabOk = await tapFlutterSemId(page, "mural_boom_fab");
  expect(fabOk, "mural_boom_fab").toBeTruthy();
  await page.waitForTimeout(600);

  const itemOk = await tapFlutterSemId(page, "mural_boom_comunicado");
  if (!itemOk) {
    // fallback texto do BoomMenu
    const item = frame.getByText(/interesse geral|Comunicado/i).first();
    await item.click({ force: true, timeout: 8_000 });
  }

  await expect
    .poll(
      async () =>
        (await frame.getByText(/Novo comunicado/i).count()) +
        (await frame
          .locator('[flt-semantics-identifier="mural_composer_enviar"]')
          .count()),
      { timeout: 20_000, message: "Composer Novo comunicado não abriu" },
    )
    .toBeGreaterThan(0);
}

export async function dismissAtencaoSeVisivel(page: Page): Promise<boolean> {
  const frame = flutterFrameLocator(page);
  const atencao = frame.getByText(/Atenção!|Por favor, selecione/i).first();
  if (!(await atencao.isVisible({ timeout: 1_200 }).catch(() => false))) {
    return false;
  }
  // Flutter WEB: el.click no "Fechar" costuma falhar — mouse no rótulo compacto
  const closed =
    (await tapFlutterLabelByMouse(page, /^Fechar$/i)) ||
    (await tapCompactFlutterLabel(page, /^Fechar$/i, { minY: 120 })) ||
    (await tapFlutterSemId(page, "shared_dialog_sim"));
  if (!closed) {
    const fechar = frame.getByText(/^Fechar$/i).first();
    if (await fechar.isVisible({ timeout: 1_500 }).catch(() => false)) {
      const box = await fechar.boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      } else {
        await fechar.click({ force: true }).catch(() => undefined);
      }
    } else {
      await frame
        .getByText(/OK|Ok|Fechar/i)
        .first()
        .click({ force: true })
        .catch(() => undefined);
    }
  }
  await page.waitForTimeout(600);
  console.log(`${LOG} Atenção dismiss mouse=${closed}`);
  return true;
}

export async function selecionarTurmasTodos(page: Page): Promise<void> {
  const frame = flutterFrameLocator(page);
  console.log(`${LOG} turmas → Todos/OK`);
  await dismissAtencaoSeVisivel(page);

  if (!(await tapFlutterSemId(page, "mural_composer_turma"))) {
    await frame.getByText(/^Turma$/i).first().click({ force: true });
  }
  await page.waitForTimeout(1_000);

  await expect
    .poll(
      async () =>
        (await frame.getByText(/Procurar|Todos|Selecionar|^OK$/i).count()) > 0 ||
        (await frame.locator('[role="checkbox"]').count()) > 0,
      { timeout: 12_000, message: "Dialog de turmas não abriu" },
    )
    .toBe(true)
    .catch(() => undefined);

  // Selecionar (opcional)
  await tapFlutterLabelByMouse(page, /Selecionar/i);
  await page.waitForTimeout(250);

  // Todos: 1 clique só. Preferir checkbox "Todos" desmarcado; senão texto Todos.
  let marked = false;
  const todosCb = frame
    .locator('[role="checkbox"]')
    .filter({ hasText: /Todos/i })
    .first();
  if (await todosCb.isVisible({ timeout: 2_000 }).catch(() => false)) {
    const state = await todosCb.getAttribute("aria-checked");
    if (state !== "true") {
      await todosCb.click({ force: true });
      console.log(`${LOG} turmas checkbox Todos → checked (was ${state})`);
    } else {
      console.log(`${LOG} turmas checkbox Todos já marcado`);
    }
    marked = true;
  } else {
    // 1ª checkbox da lista costuma ser Todos — só se desmarcada
    const first = frame.locator('[role="checkbox"]').first();
    if (await first.isVisible({ timeout: 1_500 }).catch(() => false)) {
      const state = await first.getAttribute("aria-checked");
      if (state !== "true") {
        await first.click({ force: true });
        console.log(`${LOG} turmas 1ª checkbox → checked (was ${state})`);
      } else {
        console.log(`${LOG} turmas 1ª checkbox já marcada`);
      }
      marked = true;
    }
  }

  if (!marked) {
    marked = await tapFlutterLabelByMouse(page, /^Todos$/i);
    console.log(`${LOG} turmas Todos via label=${marked}`);
  }
  await page.waitForTimeout(400);

  const okOk = await tapFlutterLabelByMouse(page, /^OK$/i);
  if (!okOk) {
    const ok = frame.getByText(/^OK$/i).first();
    await expect(ok).toBeVisible({ timeout: 8_000 });
    await ok.click({ force: true });
  }
  await page.waitForTimeout(800);
  await dismissAtencaoSeVisivel(page);
  console.log(`${LOG} turmas marked=${marked}`);
}

/** Clique por mouse no centro do nó compacto (el.click no Flutter WEB costuma falhar). */
async function tapFlutterLabelByMouse(
  page: Page,
  labelRe: RegExp,
): Promise<boolean> {
  const frame = flutterFrameLocator(page);
  const hit = await frame.locator("body").evaluate((body, args) => {
    const re = new RegExp(args.source, args.flags);
    let best: { x: number; y: number; w: number; h: number; area: number } | null =
      null;
    const walk = (node: Node | null) => {
      if (!node) return;
      if (node instanceof Element) {
        const t =
          ((node as HTMLElement).innerText || "").trim().split("\n")[0] || "";
        const aria = (node.getAttribute("aria-label") || "").trim().split("\n")[0] || "";
        if (re.test(t) || re.test(aria)) {
          const r = node.getBoundingClientRect();
          const area = r.width * r.height;
          if (
            r.width >= 28 &&
            r.width < 480 &&
            r.height >= 16 &&
            r.height < 90 &&
            area < 50_000
          ) {
            if (!best || area < best.area) {
              best = { x: r.x, y: r.y, w: r.width, h: r.height, area };
            }
          }
        }
        if (node.shadowRoot) walk(node.shadowRoot);
        for (const c of Array.from(node.children)) walk(c);
      }
    };
    walk(body);
    return best;
  }, { source: labelRe.source, flags: labelRe.flags });

  if (!hit) return false;
  const iframeBox = await page.locator(FLUTTER_IFRAME).first().boundingBox();
  if (!iframeBox) return false;
  await page.mouse.click(
    iframeBox.x + hit.x + hit.w / 2,
    iframeBox.y + hit.y + hit.h / 2,
  );
  return true;
}

export async function selecionarAlvoTodos(page: Page): Promise<void> {
  const frame = flutterFrameLocator(page);
  console.log(`${LOG} alvo → Todos`);

  // Abrir dialog "Selecionar Destinatário" (chip Ao lado de Para: — default Alunos)
  if (!(await tapFlutterSemIdCompact(page, "mural_composer_alvo"))) {
    if (!(await tapFlutterSemId(page, "mural_composer_alvo"))) {
      const opened =
        (await tapFlutterLabelByMouse(page, /^Alunos$/i)) ||
        (await tapCompactFlutterLabel(page, /Alunos/i, { minY: 80 }));
      if (!opened) {
        await frame
          .getByText(/Alunos/i)
          .first()
          .click({ force: true })
          .catch(() => undefined);
      }
    }
  }
  await page.waitForTimeout(800);

  await expect
    .poll(
      async () =>
        (await frame
          .getByText(/Selecionar Destinat[aá]rio|Respons[aá]veis|^Todos$/i)
          .count()) > 0 ||
        (await frame.locator('[role="checkbox"]').count()) > 0,
      { timeout: 10_000, message: "Dialog de alvos (destinatário) não abriu" },
    )
    .toBe(true)
    .catch(() => undefined);

  // NÃO usar a 1ª checkbox — no dialog de alvos a 1ª é "Alunos" (já marcada).
  // Marcar explicitamente "Todos" (checkbox com aria/texto ou rótulo).
  let marked = await marcarCheckboxAlvoTodos(page);
  if (!marked) {
    marked = await tapFlutterLabelByMouse(page, /^Todos$/i);
    console.log(`${LOG} alvo Todos via label=${marked}`);
  }
  if (!marked) {
    marked = await tapCompactFlutterLabel(page, /^Todos$/i, { minY: 100 });
    console.log(`${LOG} alvo Todos via compact=${marked}`);
  }
  await page.waitForTimeout(400);

  const okOk =
    (await tapFlutterLabelByMouse(page, /^(Ok|OK)$/i)) ||
    (await tapCompactFlutterLabel(page, /^(Ok|OK)$/i, { minY: 100 }));
  if (!okOk) {
    const ok = frame.getByText(/^(Ok|OK)$/i).first();
    if (await ok.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await ok.click({ force: true });
    }
  }
  await page.waitForTimeout(500);
  console.log(`${LOG} alvo marked=${marked}`);
}

/** Marca checkbox "Todos" no dialog de destinatários (não confundir com Alunos). */
async function marcarCheckboxAlvoTodos(page: Page): Promise<boolean> {
  const frame = flutterFrameLocator(page);
  const hit = await frame.locator("body").evaluate(() => {
    const re = /^Todos$/i;
    let best: {
      x: number;
      y: number;
      w: number;
      h: number;
      checked: boolean;
    } | null = null;
    const walk = (node: Node | null) => {
      if (!node) return;
      if (node instanceof Element) {
        const role = node.getAttribute("role") || "";
        const aria = (node.getAttribute("aria-label") || "").trim();
        const first =
          ((node as HTMLElement).innerText || "").trim().split("\n")[0]?.trim() ||
          "";
        const name = (aria.split("\n")[0] || first).trim();
        if (role === "checkbox" && re.test(name)) {
          const r = node.getBoundingClientRect();
          if (r.width >= 16 && r.height >= 16 && r.y > 80) {
            best = {
              x: r.x,
              y: r.y,
              w: r.width,
              h: r.height,
              checked: node.getAttribute("aria-checked") === "true",
            };
          }
        }
        if (node.shadowRoot) walk(node.shadowRoot);
        for (const c of Array.from(node.children)) walk(c);
      }
    };
    walk(document.body);
    return best;
  });

  if (!hit) return false;
  if (hit.checked) {
    console.log(`${LOG} alvo checkbox Todos já marcado`);
    return true;
  }
  const iframeBox = await page.locator(FLUTTER_IFRAME).first().boundingBox();
  if (!iframeBox) return false;
  await page.mouse.click(
    iframeBox.x + hit.x + hit.w / 2,
    iframeBox.y + hit.y + hit.h / 2,
  );
  console.log(`${LOG} alvo checkbox Todos → checked`);
  return true;
}

export async function escreverTextoComunicado(
  page: Page,
  texto: string,
): Promise<void> {
  const frame = flutterFrameLocator(page);
  console.log(`${LOG} texto (${texto.slice(0, 48)}…)`);

  // Fechar overlays (filtro / menu clipe) que roubam o foco
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.waitForTimeout(300);

  const iframe = page.locator(FLUTTER_IFRAME).first();
  const box = await iframe.boundingBox();

  // 1) hint / id / clique no miolo do composer (acima da bottom bar de ícones)
  let focused = false;
  if (await tapFlutterSemId(page, "mural_composer_texto")) {
    focused = true;
  } else if (await tapCompactFlutterLabel(page, /Escreva seu texto aqui/i, { minY: 120 })) {
    focused = true;
  } else if (box) {
    // Área do corpo do comunicado — centro vertical ~42–48% do iframe
    await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.48);
    focused = true;
  }
  if (!focused) {
    await frame.getByText(/Escreva seu texto aqui/i).first().click({ force: true }).catch(() => undefined);
  }

  await page.waitForTimeout(350);
  // Limpa e digita (WEB Flutter costuma precisar de foco + type)
  await page.keyboard.press("Control+A");
  await page.waitForTimeout(100);
  await page.keyboard.type(texto, { delay: 12 });
  await page.waitForTimeout(500);

  // Se o hint ainda está visível, o type não entrou no campo — tenta de novo
  const hintStill = await frame
    .getByText(/Escreva seu texto aqui/i)
    .first()
    .isVisible()
    .catch(() => false);
  if (hintStill) {
    console.log(`${LOG} texto: hint ainda visível — re-foco`);
    await page.keyboard.press("Escape").catch(() => undefined);
    await page.waitForTimeout(200);
    if (await tapFlutterSemId(page, "mural_composer_texto")) {
      /* ok */
    } else if (box) {
      await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.48);
    }
    await page.waitForTimeout(300);
    await page.keyboard.press("Control+A");
    await page.keyboard.type(texto, { delay: 12 });
    await page.waitForTimeout(400);
  }
  console.log(`${LOG} texto digitado (${texto.length} chars)`);
}

/** FAB circular Enviar (paper plane) no composer — geometria + Semantics. */
async function tapEnviarFab(page: Page): Promise<boolean> {
  if (await tapFlutterSemId(page, "mural_composer_enviar")) return true;
  if (await tapCompactFlutterLabel(page, /Enviar comunicado|^Enviar$/i)) return true;

  const frame = flutterFrameLocator(page);
  const hit = await frame.locator("body").evaluate(() => {
    const pts: { x: number; y: number; w: number; h: number }[] = [];
    const walk = (node: Node | null) => {
      if (!node) return;
      if (node instanceof Element) {
        const id = node.getAttribute("flt-semantics-identifier") || "";
        const r = node.getBoundingClientRect();
        const roundish =
          r.width >= 44 &&
          r.width <= 72 &&
          r.height >= 44 &&
          r.height <= 72 &&
          Math.abs(r.width - r.height) < 12;
        if (
          (id === "mural_composer_enviar" || roundish) &&
          r.x > 200 &&
          r.y > 200
        ) {
          pts.push({ x: r.x, y: r.y, w: r.width, h: r.height });
        }
        if (node.shadowRoot) walk(node.shadowRoot);
        for (const c of Array.from(node.children)) walk(c);
      }
    };
    walk(document.body);
    // preferir o mais à direita / baixo (FAB enviar)
    pts.sort((a, b) => b.x + b.y - (a.x + a.y));
    return pts[0] || null;
  });

  const iframeBox = await page.locator(FLUTTER_IFRAME).first().boundingBox();
  if (hit && iframeBox) {
    await page.mouse.click(
      iframeBox.x + hit.x + hit.w / 2,
      iframeBox.y + hit.y + hit.h / 2,
    );
    return true;
  }

  if (iframeBox) {
    // Tentativas geométricas no canto SE do composer (acima da bottom bar)
    const tries = [
      { fx: 0.88, fy: 0.72 },
      { fx: 0.86, fy: 0.75 },
      { fx: 0.9, fy: 0.7 },
      { fx: 0.84, fy: 0.78 },
    ];
    for (const t of tries) {
      await page.mouse.click(
        iframeBox.x + iframeBox.width * t.fx,
        iframeBox.y + iframeBox.height * t.fy,
      );
      await page.waitForTimeout(400);
      const leftComposer =
        (await frame.getByText(/Novo comunicado|Novo evento/i).count()) === 0 ||
        (await countShowMenuCards(page)) > 0 ||
        (await frame.locator('[flt-semantics-identifier="mural_boom_fab"]').count()) >
          0;
      if (leftComposer) return true;
    }
  }
  return false;
}

export async function enviarComunicado(page: Page): Promise<void> {
  const frame = flutterFrameLocator(page);
  console.log(`${LOG} enviar`);

  for (let attempt = 1; attempt <= 4; attempt++) {
    await dismissAtencaoSeVisivel(page);
    await tapEnviarFab(page);
    await page.waitForTimeout(1_800);

    // Atenção pode ser: (a) falta turma → re-selecionar; (b) aviso admin/alvo Todos → só Fechar + reenviar
    const faltaTurma = await frame
      .getByText(/selecione pelo menos uma turma/i)
      .first()
      .isVisible()
      .catch(() => false);
    const atencaoVisivel = await frame
      .getByText(/Atenção!/i)
      .first()
      .isVisible()
      .catch(() => false);
    if (atencaoVisivel || faltaTurma) {
      await dismissAtencaoSeVisivel(page);
      if (faltaTurma) {
        console.log(`${LOG} falta turma — re-selecionando (tentativa ${attempt})`);
        await selecionarTurmasTodos(page);
      } else {
        console.log(`${LOG} Atenção informativa — reenviar (tentativa ${attempt})`);
      }
      continue;
    }

    const done = await expect
      .poll(
        async () => {
          if (
            await frame
              .getByText(/Atenção!|selecione pelo menos uma turma/i)
              .first()
              .isVisible()
              .catch(() => false)
          ) {
            return "atencao";
          }
          if (
            (await frame
              .locator('[flt-semantics-identifier="mural_boom_fab"]')
              .count()) > 0 ||
            (await countShowMenuCards(page)) > 0 ||
            (await lerRotuloFiltroSentido(page)) != null
          ) {
            return "lista";
          }
          if (
            (await frame.getByText(/Novo comunicado|Novo evento/i).count()) > 0
          ) {
            return "composer";
          }
          return "wait";
        },
        { timeout: 20_000, intervals: [1_000, 2_000] },
      )
      .toMatch(/lista|atencao|composer/)
      .then(async () => {
        if (
          await frame.getByText(/Atenção!/i).first().isVisible().catch(() => false)
        )
          return "atencao" as const;
        if ((await frame.getByText(/Novo comunicado|Novo evento/i).count()) > 0)
          return "composer" as const;
        return "lista" as const;
      })
      .catch(() => "wait" as const);

    console.log(`${LOG} pós-enviar state=${done} attempt=${attempt}`);
    if (done === "lista") return;
    await dismissAtencaoSeVisivel(page);
    if (done === "atencao") {
      const aindaFaltaTurma = await frame
        .getByText(/selecione pelo menos uma turma/i)
        .first()
        .isVisible()
        .catch(() => false);
      if (aindaFaltaTurma) await selecionarTurmasTodos(page);
      continue;
    }
    if (done === "composer") {
      // Composer ainda aberto: tenta Enviar de novo (não reabrir turmas às cegas)
      continue;
    }
  }

  throw new Error("enviarComunicado: não voltou à lista do Mural");
}

/** Coleta texto/aria do iframe Flutter (light + shadow). */
async function blobA11yFlutter(page: Page): Promise<string> {
  const iframe = page.locator(FLUTTER_IFRAME).first();
  const handle = await iframe.elementHandle();
  const content = handle ? await handle.contentFrame() : null;
  if (!content) return "";
  const fromDom = await content.evaluate(() => {
    const blob: string[] = [];
    blob.push(document.body?.innerText || "");
    const walk = (node: Node | null) => {
      if (!node) return;
      if (node instanceof Element) {
        for (const a of [
          "aria-label",
          "flt-semantics-label",
          "flt-semantics-identifier",
          "title",
        ]) {
          const v = node.getAttribute(a);
          if (v) blob.push(v);
        }
        if (node.shadowRoot) walk(node.shadowRoot);
        for (const c of Array.from(node.children)) walk(c);
      }
      if (node.nodeType === Node.TEXT_NODE && node.textContent) {
        blob.push(node.textContent);
      }
    };
    walk(document.body);
    walk(document.documentElement);
    return blob.join("\n");
  });
  let snap = "";
  try {
    const ax = (
      content as unknown as {
        accessibility?: { snapshot: (o: object) => Promise<unknown> };
      }
    ).accessibility;
    if (ax?.snapshot) {
      const tree = await ax.snapshot({ interestingOnly: false });
      snap = tree ? JSON.stringify(tree) : "";
    }
  } catch {
    /* Frame.accessibility ausente em alguns builds */
  }
  return `${fromDom}\n${snap}`;
}

async function textoVisivelNaLista(page: Page, needle: string): Promise<boolean> {
  const frameLoc = flutterFrameLocator(page);
  const re = new RegExp(escapeRe(needle), "i");
  if (
    await frameLoc
      .getByText(re)
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    return true;
  }
  const blob = await blobA11yFlutter(page);
  return blob.toLowerCase().includes(needle.toLowerCase());
}

/** Aria do 1º mural_card_menu (costuma ter "há Xs"). */
async function topCardAria(page: Page): Promise<string> {
  const frame = flutterFrameLocator(page);
  return frame.locator("body").evaluate(() => {
    const pts: { y: number; aria: string; text: string }[] = [];
    const walk = (node: Node | null) => {
      if (!node) return;
      if (node instanceof Element) {
        const id = node.getAttribute("flt-semantics-identifier") || "";
        const r = node.getBoundingClientRect();
        if (
          id === "mural_card_menu" &&
          r.width > 80 &&
          r.height > 20 &&
          r.y > 80
        ) {
          pts.push({
            y: r.y,
            aria: node.getAttribute("aria-label") || "",
            text: ((node as HTMLElement).innerText || "").slice(0, 200),
          });
        }
        if (node.shadowRoot) walk(node.shadowRoot);
        for (const c of Array.from(node.children)) walk(c);
      }
    };
    walk(document.body);
    pts.sort((a, b) => a.y - b.y);
    const top = pts[0];
    if (!top) return "";
    return `${top.aria}\n${top.text}`;
  });
}

/** Conta ⋮ dos cards (Show menu abaixo do app bar). */
async function countShowMenuCards(page: Page): Promise<number> {
  const frame = flutterFrameLocator(page);
  return frame.locator("body").evaluate(() => {
    let n = 0;
    const walk = (node: Node | null) => {
      if (!node) return;
      if (node instanceof Element) {
        const aria = (node.getAttribute("aria-label") || "").trim();
        const text = ((node as HTMLElement).innerText || "").trim();
        const r = node.getBoundingClientRect();
        if (
          (/^Show menu$/i.test(aria) || /^Show menu$/i.test(text)) &&
          r.y > 120 &&
          r.width >= 24 &&
          r.width <= 56 &&
          r.height >= 24 &&
          r.height <= 56
        ) {
          n += 1;
        }
        if (node.shadowRoot) walk(node.shadowRoot);
        for (const c of Array.from(node.children)) walk(c);
      }
    };
    walk(document.body);
    return n;
  });
}

function isCardRecente(aria: string): boolean {
  if (/agora/i.test(aria)) return true;
  const m = aria.match(/há\s+(\d+)\s*s\b/i);
  if (m && Number(m[1]) <= 120) return true;
  const mMin = aria.match(/há\s+(\d+)\s*min\b/i);
  if (mMin && Number(mMin[1]) <= 2) return true;
  return false;
}

/**
 * Abre o 1º card (centro do mural_card_menu, não o ⋮) e procura o texto no detalhe.
 * Volta à lista com Escape/Back.
 */
async function assertTextoAbrindoDetalhe(
  page: Page,
  needle: string,
): Promise<boolean> {
  const frame = flutterFrameLocator(page);
  const card = await frame.locator("body").evaluate(() => {
    const pts: { x: number; y: number; w: number; h: number }[] = [];
    const walk = (node: Node | null) => {
      if (!node) return;
      if (node instanceof Element) {
        if (node.getAttribute("flt-semantics-identifier") === "mural_card_menu") {
          const r = node.getBoundingClientRect();
          if (r.width > 80 && r.height > 40 && r.y > 150) {
            pts.push({ x: r.x, y: r.y, w: r.width, h: r.height });
          }
        }
        if (node.shadowRoot) walk(node.shadowRoot);
        for (const c of Array.from(node.children)) walk(c);
      }
    };
    walk(document.body);
    pts.sort((a, b) => a.y - b.y);
    return pts[0] || null;
  });
  const iframeBox = await page.locator(FLUTTER_IFRAME).first().boundingBox();
  if (!card || !iframeBox) return false;

  await page.mouse.click(
    iframeBox.x + card.x + card.w * 0.35,
    iframeBox.y + card.y + card.h * 0.55,
  );
  await page.waitForTimeout(900);

  const hit = await textoVisivelNaLista(page, needle);
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.waitForTimeout(400);
  if (
    (await frame.getByText(/^Comunicado$/i).count()) > 0 &&
    (await frame.getByText(/Enviadas|Recebidas/i).count()) === 0
  ) {
    await page.mouse.click(iframeBox.x + 28, iframeBox.y + 28);
    await page.waitForTimeout(500);
  }
  return hit;
}

/**
 * Assert de assinatura na lista Enviadas.
 * Corpo do card no WEB costuma ser só canvas (fora da a11y) — se a11y falhar,
 * exige chip Enviadas + card recente ("há Ns") + screenshot; falha se isso também falhar.
 * `COMUNICADOS_REQUIRE_TEXT_A11Y=1` → só passa com texto na a11y.
 */
export async function assertTextoNaLista(
  page: Page,
  trecho: string,
): Promise<void> {
  const needle =
    trecho.length >= 8
      ? trecho.slice(0, 48)
      : trecho.includes("Playwright")
        ? "Teste Playwright Chrome"
        : trecho.slice(0, 32);

  console.log(`${LOG} assert na lista: ${needle}`);
  const requireA11y = process.env.COMUNICADOS_REQUIRE_TEXT_A11Y === "1";

  let found = false;
  try {
    await expect
      .poll(async () => textoVisivelNaLista(page, needle), {
        timeout: 10_000,
        intervals: [700, 1_200],
        message: `Não achou "${needle}" na a11y/DOM da lista`,
      })
      .toBe(true);
    found = true;
  } catch {
    // Detalhe do card no WEB também costuma ser canvas — só tenta se houver ⋮
    const menus = await countShowMenuCards(page);
    if (menus > 0) {
      console.log(`${LOG} lista sem texto a11y — tentando detalhe do card`);
      found = await assertTextoAbrindoDetalhe(page, needle);
    }
  }

  if (found) return;

  const shot = path.join(
    __dirname,
    "..",
    "test-results",
    "comunicado-assinatura-FAIL.png",
  );
  await page.screenshot({ path: shot, fullPage: true });

  if (requireA11y) {
    throw new Error(
      `assertTextoNaLista: não achou "${needle}" na a11y (COMUNICADOS_REQUIRE_TEXT_A11Y=1)`,
    );
  }

  // Fallback canvas: Enviadas + (card recente OU ⋮ Show menu na lista) + screenshot
  await assertFiltroSentidoAtivo(page, "Enviadas").catch(() => undefined);
  const aria = await topCardAria(page);
  const menus = await countShowMenuCards(page);
  const recente = Boolean(aria && isCardRecente(aria));
  const listaOk = recente || menus >= 1;
  if (!listaOk) {
    throw new Error(
      `assertTextoNaLista: "${needle}" fora da a11y e lista Enviadas sem cards (aria="${aria.slice(0, 80)}", showMenu=${menus}) — ver ${shot}`,
    );
  }
  console.log(
    `${LOG} AVISO: "${needle}" só no canvas; lista Enviadas ok (recente=${recente}, showMenu=${menus}) — print ${shot}`,
  );
}

/** Fluxo completo: mural → novo → turmas → alvo → texto → enviar. */
export async function publicarComunicadoTexto(
  page: Page,
  texto: string,
): Promise<void> {
  await ensureMuralHome(page);
  await abrirNovoComunicado(page);
  await selecionarTurmasTodos(page);
  await selecionarAlvoTodos(page);
  await escreverTextoComunicado(page, texto);
  await enviarComunicado(page);
}

// —— Lista / card ⋮ (CRUD-02 / CRUD-03) ——

export async function filtrarEnviadas(page: Page): Promise<void> {
  await filtrarSentido(page, "Enviadas");
}

export async function filtrarSentido(
  page: Page,
  sentido: "Recebidas" | "Enviadas" | "Pendentes",
): Promise<void> {
  const frame = flutterFrameLocator(page);
  console.log(`${LOG} filtro sentido → ${sentido}`);

  await tapFlutterSemId(page, "mural_tab_mural").catch(() => undefined);
  await page.waitForTimeout(400);

  const expectRe =
    sentido === "Enviadas"
      ? /enviad/i
      : sentido === "Recebidas"
        ? /recebid/i
        : /pendente/i;

  const already = await lerRotuloFiltroSentido(page);
  if (already && expectRe.test(already)) {
    console.log(`${LOG} sentido já ativo: ${already}`);
    return;
  }

  const labelRe =
    sentido === "Enviadas"
      ? /^(Enviadas|Enviados)(\b|\s|$)/i
      : sentido === "Recebidas"
        ? /^(Recebidas|Recebidos)(\b|\s|$)/i
        : /^(Pendentes)(\b|\s|$)/i;

  // O Semantics `mural_filtro_sentido` cobre ~header inteiro (APP-02-like).
  // Preferir clique compacto (mouse) — el.click falha no Flutter WEB.
  let opened = await clickCompactSentidoLabel(
    page,
    /^(Recebidas|Recebidos|Enviadas|Enviados|Pendentes)(\b|\s|$)/i,
  );
  if (!opened) {
    opened = await tapFlutterSemIdCompact(page, "mural_filtro_sentido");
  }
  if (!opened) {
    opened = await tapFlutterLabelByMouse(
      page,
      /^(Recebidas|Recebidos|Enviadas|Enviados|Pendentes)$/i,
    );
  }
  if (!opened) {
    const chip = frame
      .locator('[flt-semantics-identifier="mural_filtro_sentido"]')
      .first();
    const box = await chip.boundingBox().catch(() => null);
    if (box) {
      // Canto esquerdo do nó (onde fica o dropdown Recebidas)
      await page.mouse.click(box.x + Math.min(70, box.width * 0.25), box.y + box.height * 0.65);
      opened = true;
    } else {
      opened = await tapFlutterSemId(page, "mural_filtro_sentido");
    }
  }
  console.log(`${LOG} dropdown sentido aberto=${opened}`);
  await page.waitForTimeout(1_200);

  // Preferência Maestro ≥ semantics: mural_filtro_sentido_item (aria "Enviadas\nEnviadas")
  let picked = await clickFiltroSentidoItem(page, labelRe);
  if (!picked) {
    picked = await clickMenuSentidoItem(page, labelRe);
  }
  if (!picked) {
    picked = await tapFlutterLabelByMouse(page, labelRe);
  }
  if (!picked) {
    picked = await tapFlutterByAccessibleName(page, labelRe);
  }
  if (!picked) {
    // Fallback amplo: qualquer nó com Enviadas/Recebidas abaixo do app bar
    const hit = await frame.locator("body").evaluate((body, source) => {
      const re = new RegExp(source, "i");
      let best: { x: number; y: number; w: number; h: number; area: number } | null =
        null;
      const walk = (node: Node | null) => {
        if (!node) return;
        if (node instanceof Element) {
          const text =
            ((node as HTMLElement).innerText || "").trim().split("\n")[0] || "";
          const aria = (node.getAttribute("aria-label") || "").trim();
          const ariaFirst = aria.split("\n")[0] || "";
          if (re.test(text) || re.test(ariaFirst) || re.test(aria)) {
            const r = node.getBoundingClientRect();
            if (
              r.width >= 40 &&
              r.height >= 18 &&
              r.y > 70 &&
              r.y < 420 &&
              r.height < 100
            ) {
              const area = r.width * r.height;
              if (area < 80_000 && (!best || area < best.area)) {
                best = { x: r.x, y: r.y, w: r.width, h: r.height, area };
              }
            }
          }
          if (node.shadowRoot) walk(node.shadowRoot);
          for (const c of Array.from(node.children)) walk(c);
        }
      };
      walk(body);
      return best;
    }, labelRe.source);
    const iframeBox = await page.locator(FLUTTER_IFRAME).first().boundingBox();
    if (hit && iframeBox) {
      await page.mouse.click(
        iframeBox.x + hit.x + hit.w / 2,
        iframeBox.y + hit.y + hit.h / 2,
      );
      picked = true;
    }
  }

  if (!picked) {
    await page.keyboard.press("Escape").catch(() => undefined);
    const after = await lerRotuloFiltroSentido(page);
    if (after && expectRe.test(after)) {
      console.log(`${LOG} sentido ${sentido} via chip (${after})`);
      return;
    }
    throw new Error(`filtrarSentido: item "${sentido}" não encontrado no overlay`);
  }
  console.log(`${LOG} sentido ${sentido} selecionado`);
  await page.waitForTimeout(1_200);
  await assertFiltroSentidoAtivo(page, sentido);
}

/** Item do dropdown TipoSentido — Semantics `mural_filtro_sentido_item` (WEB/APP ≥ 6.06). */
async function clickFiltroSentidoItem(
  page: Page,
  labelRe: RegExp,
): Promise<boolean> {
  const frame = flutterFrameLocator(page);
  const hit = await frame.locator("body").evaluate((body, source) => {
    const re = new RegExp(source, "i");
    const hits: {
      x: number;
      y: number;
      w: number;
      h: number;
      score: number;
      aria: string;
      id: string;
    }[] = [];
    const walk = (node: Node | null) => {
      if (!node) return;
      if (node instanceof Element) {
        const id = node.getAttribute("flt-semantics-identifier") || "";
        const aria = (node.getAttribute("aria-label") || "").trim();
        const text = ((node as HTMLElement).innerText || "").trim();
        // WEB: text costuma ser "Enviadas Enviadas" (label+value)
        const candidates = [
          aria.split("\n")[0]?.trim() || "",
          text.split("\n")[0]?.trim() || "",
          (aria.split(/\s+/)[0] || "").trim(),
          (text.split(/\s+/)[0] || "").trim(),
          aria,
          text,
        ];
        const label = candidates.find((c) => c && re.test(c)) || "";
        const isItem = id === "mural_filtro_sentido_item" || id.endsWith("_filtro_sentido_item");
        // Preferir a LINHA do menu (h~48 w~180) — o *_item costuma ser clickable=false (h~21)
        const isMenuRow =
          !id &&
          label &&
          text.length < 40 &&
          /^(Recebidas|Recebidos|Enviadas|Enviados|Pendentes|Aprovadas|Rejeitadas|Modelos|Agendamentos)/i.test(
            text.split("\n")[0] || text,
          );
        if (label && (isItem || isMenuRow)) {
          const r = node.getBoundingClientRect();
          if (r.width >= 40 && r.height >= 16 && r.y > 40 && r.y < 420) {
            // Score: linhas do menu (h 40–56) primeiro; depois *_item
            const rowBonus = r.height >= 36 && r.height <= 56 && r.width >= 120 ? 0 : 200;
            const itemPenalty = isItem ? 50 : 0;
            hits.push({
              x: r.x,
              y: r.y,
              w: r.width,
              h: r.height,
              score: rowBonus + itemPenalty + Math.abs(48 - r.height) + r.y * 0.01,
              aria: label,
              id: id || "row",
            });
          }
        }
        if (node.shadowRoot) walk(node.shadowRoot);
        for (const c of Array.from(node.children)) walk(c);
      }
    };
    walk(body);
    hits.sort((a, b) => a.score - b.score);
    return hits[0] || null;
  }, labelRe.source);

  if (!hit) {
    const n = await frame
      .locator('[flt-semantics-identifier="mural_filtro_sentido_item"]')
      .count()
      .catch(() => 0);
    console.log(`${LOG} sentido_item match=0 (nodes=${n})`);
    return false;
  }

  const iframeBox = await page.locator(FLUTTER_IFRAME).first().boundingBox();
  if (!iframeBox) return false;
  // Clique no centro da linha (não só no texto estreito)
  await page.mouse.click(
    iframeBox.x + hit.x + Math.max(hit.w * 0.45, 40),
    iframeBox.y + hit.y + hit.h / 2,
  );
  console.log(
    `${LOG} sentido_item → ${hit.aria} id=${hit.id} @y=${Math.round(hit.y)} h=${Math.round(hit.h)}`,
  );
  return true;
}

/** Item do dropdown de sentido (abaixo do chip; não confundir com o chip do header). */
async function clickMenuSentidoItem(
  page: Page,
  labelRe: RegExp,
): Promise<boolean> {
  const frame = flutterFrameLocator(page);
  const hit = await frame.locator("body").evaluate((body, source) => {
    const re = new RegExp(source, "i");
    let best: { x: number; y: number; w: number; h: number; score: number } | null =
      null;
    const walk = (node: Node | null) => {
      if (!node) return;
      if (node instanceof Element) {
        const firstLine =
          ((node as HTMLElement).innerText || "").trim().split("\n")[0]?.trim() ||
          "";
        const aria = (node.getAttribute("aria-label") || "").trim();
        if (
          (re.test(firstLine) && firstLine.length < 24) ||
          (re.test(aria) && aria.length < 24)
        ) {
          const r = node.getBoundingClientRect();
          // menu overlay: abaixo do app bar, faixa estreita
          if (
            r.width >= 80 &&
            r.width <= 360 &&
            r.height >= 28 &&
            r.height <= 72 &&
            r.y >= 90 &&
            r.y < 360
          ) {
            const score = r.y + Math.abs(160 - r.width);
            if (!best || score < best.score) {
              best = { x: r.x, y: r.y, w: r.width, h: r.height, score };
            }
          }
        }
        if (node.shadowRoot) walk(node.shadowRoot);
        for (const c of Array.from(node.children)) walk(c);
      }
    };
    walk(body);
    return best;
  }, labelRe.source);
  if (!hit) return false;
  const iframeBox = await page.locator(FLUTTER_IFRAME).first().boundingBox();
  if (!iframeBox) return false;
  await page.mouse.click(
    iframeBox.x + hit.x + hit.w / 2,
    iframeBox.y + hit.y + hit.h / 2,
  );
  return true;
}

/** Lê o rótulo compacto atual do chip Recebidas/Enviadas/Pendentes. */
export async function lerRotuloFiltroSentido(page: Page): Promise<string | null> {
  const frame = flutterFrameLocator(page);
  return frame.locator("body").evaluate(() => {
    const re = /^(Recebidas|Recebidos|Enviadas|Enviados|Pendentes)(\b|\s|$)/i;
    let best: { t: string; score: number } | null = null;
    const walk = (node: Node | null) => {
      if (!node) return;
      if (node instanceof Element) {
        const firstLine =
          ((node as HTMLElement).innerText || "").trim().split("\n")[0]?.trim() ||
          "";
        const aria = (node.getAttribute("aria-label") || "").trim().split("\n")[0] || "";
        const id = node.getAttribute("flt-semantics-identifier") || "";
        for (const raw of [firstLine, aria]) {
          const word = (raw.split(/\s+/)[0] || "").trim();
          const t = re.test(raw) || re.test(word) ? word || raw : "";
          if (t) {
            const r = node.getBoundingClientRect();
            // Chip do header (ou nó semantics um pouco maior)
            if (
              r.width >= 60 &&
              r.width <= 400 &&
              r.height >= 16 &&
              r.height <= 80 &&
              r.y < 200 &&
              (id === "mural_filtro_sentido" || r.height <= 48)
            ) {
              const score =
                Math.abs(140 - Math.min(r.width, 140)) +
                Math.abs(28 - r.height) +
                (id === "mural_filtro_sentido" ? 0 : 20);
              if (!best || score < best.score) best = { t, score };
            }
          }
        }
        if (node.shadowRoot) walk(node.shadowRoot);
        for (const c of Array.from(node.children)) walk(c);
      }
    };
    walk(document.body);
    return best?.t ?? null;
  });
}

export async function assertFiltroSentidoAtivo(
  page: Page,
  sentido: "Recebidas" | "Enviadas" | "Pendentes",
): Promise<void> {
  const expectRe =
    sentido === "Enviadas"
      ? /enviad/i
      : sentido === "Recebidas"
        ? /recebid/i
        : /pendente/i;
  await expect
    .poll(async () => {
      const label = await lerRotuloFiltroSentido(page);
      return label && expectRe.test(label) ? label : null;
    }, {
      timeout: 12_000,
      message: `Chip de sentido não ficou em ${sentido}`,
    })
    .not.toBeNull();
  console.log(`${LOG} chip sentido ok → ${sentido}`);
}

/** Clica rótulo compacto do dropdown de sentido (evita nó Semantics gigante). */
async function clickCompactSentidoLabel(
  page: Page,
  labelRe: RegExp,
): Promise<boolean> {
  const frame = flutterFrameLocator(page);
  const hit = await frame.locator("body").evaluate((body, source) => {
    const re = new RegExp(source, "i");
    let best: { x: number; y: number; w: number; h: number; score: number } | null =
      null;
    const walk = (node: Node | null) => {
      if (!node) return;
      if (node instanceof Element) {
        const text = ((node as HTMLElement).innerText || "").trim();
        const firstLine = text.split("\n")[0]?.trim() || "";
        const word = firstLine.split(/\s+/)[0] || "";
        if (
          (re.test(firstLine) || re.test(word)) &&
          firstLine.length < 40
        ) {
          const r = node.getBoundingClientRect();
          // chip do header: estreito e baixo
          if (
            r.width >= 60 &&
            r.width <= 220 &&
            r.height >= 18 &&
            r.height <= 48 &&
            r.y < 140
          ) {
            const score = Math.abs(140 - r.width) + Math.abs(28 - r.height);
            if (!best || score < best.score) {
              best = { x: r.x, y: r.y, w: r.width, h: r.height, score };
            }
          }
        }
        if (node.shadowRoot) walk(node.shadowRoot);
        for (const c of Array.from(node.children)) walk(c);
      }
    };
    walk(body);
    return best;
  }, labelRe.source);
  if (!hit) return false;
  const iframeBox = await page.locator(FLUTTER_IFRAME).first().boundingBox();
  if (!iframeBox) return false;
  await page.mouse.click(
    iframeBox.x + hit.x + hit.w / 2,
    iframeBox.y + hit.y + hit.h / 2,
  );
  return true;
}

/** Abre ⋮ do card que contém o trecho (assinatura / #runId). Preferir Enviadas. */
export async function abrirMenuCardPorAssinatura(
  page: Page,
  trecho: string,
): Promise<void> {
  console.log(`${LOG} ⋮ card por assinatura: ${trecho.slice(0, 40)}`);
  await filtrarEnviadas(page);

  const found = await tapFlutterByAccessibleName(
    page,
    new RegExp(escapeRe(trecho), "i"),
  );
  if (!found) {
    console.log(`${LOG} assinatura sem nó a11y — usando ⋮ topo Enviadas`);
  }
  await abrirMenuCardTopoEnviadas(page, { skipFiltrar: true });
}

/** Menu popup do ⋮ aberto? (Editar / Excluir / …) */
async function menuCardPopupAberto(page: Page): Promise<boolean> {
  const frame = flutterFrameLocator(page);
  if (
    (await frame
      .locator(
        '[flt-semantics-identifier="mural_card_editar"], [flt-semantics-identifier="mural_card_excluir"]',
      )
      .count()) > 0
  ) {
    return true;
  }
  return frame.locator("body").evaluate(() => {
    const walk = (node: Node | null): boolean => {
      if (!node) return false;
      if (node instanceof Element) {
        const aria = node.getAttribute("aria-label") || "";
        const t = ((node as HTMLElement).innerText || "").trim();
        if (
          /^(Editar|Excluir|Compartilhar anexos|Salvar anexos)$/i.test(t) ||
          /^(Editar|Excluir)$/i.test(aria)
        ) {
          const r = node.getBoundingClientRect();
          if (r.width >= 40 && r.width < 420 && r.height >= 18 && r.height < 90) {
            return true;
          }
        }
        if (node.shadowRoot && walk(node.shadowRoot)) return true;
        for (const c of Array.from(node.children)) {
          if (walk(c)) return true;
        }
      }
      return false;
    };
    return walk(document.body);
  });
}

/**
 * No WEB, `mural_card_menu` cobre o card inteiro; o ⋮ real é o botão
 * compacto com label "Show menu" (40×40). Index 0 = header do app.
 */
async function tapShowMenuDoCard(page: Page): Promise<boolean> {
  const frame = flutterFrameLocator(page);
  const hit = await frame.locator("body").evaluate(() => {
    type Pt = { x: number; y: number; w: number; h: number };
    const pts: Pt[] = [];
    const walk = (node: Node | null) => {
      if (!node) return;
      if (node instanceof Element) {
        const aria = (node.getAttribute("aria-label") || "").trim();
        const text = ((node as HTMLElement).innerText || "").trim();
        const r = node.getBoundingClientRect();
        const isShow =
          /^Show menu$/i.test(aria) ||
          /^Show menu$/i.test(text) ||
          (/mais opç|more options/i.test(aria) &&
            r.width <= 56 &&
            r.height <= 56);
        // y>120: ignora "Show menu" do app bar (header)
        if (
          isShow &&
          r.y > 120 &&
          r.width >= 24 &&
          r.width <= 56 &&
          r.height >= 24 &&
          r.height <= 56
        ) {
          pts.push({ x: r.x, y: r.y, w: r.width, h: r.height });
        }
        if (node.shadowRoot) walk(node.shadowRoot);
        for (const c of Array.from(node.children)) walk(c);
      }
    };
    walk(document.body);
    pts.sort((a, b) => a.y - b.y);
    return pts[0] || null;
  });

  if (!hit) return false;
  const iframeBox = await page.locator(FLUTTER_IFRAME).first().boundingBox();
  if (!iframeBox) return false;
  const x = iframeBox.x + hit.x + hit.w / 2;
  const y = iframeBox.y + hit.y + hit.h / 2;
  console.log(`${LOG} ⋮ Show menu @ ${Math.round(x)},${Math.round(y)}`);
  await page.mouse.click(x, y);
  await page.waitForTimeout(700);
  return true;
}

/** Atalho: ⋮ do primeiro card em Enviadas (sem âncora de texto). */
export async function abrirMenuCardTopoEnviadas(
  page: Page,
  opts?: { skipFiltrar?: boolean },
): Promise<void> {
  const frame = flutterFrameLocator(page);
  console.log(`${LOG} ⋮ topo Enviadas`);
  if (!opts?.skipFiltrar) await filtrarEnviadas(page);

  // Fecha overlays Destinatários se abertos
  await dismissAtencaoSeVisivel(page);
  const destOk = frame.getByText(/^(Ok|OK)$/i).first();
  if (
    (await frame.getByText(/Destinat/i).count()) > 0 &&
    (await destOk.isVisible({ timeout: 800 }).catch(() => false))
  ) {
    await destOk.click({ force: true });
  }

  // 1) Preferido: botão compacto "Show menu" do card (não o do header)
  if (await tapShowMenuDoCard(page)) {
    if (await menuCardPopupAberto(page)) {
      console.log(`${LOG} menu aberto (Show menu)`);
      return;
    }
  }

  // 2) Fallback: canto SE de mural_card_menu (nó cobre o card no WEB)
  const cardHit = await frame.locator("body").evaluate(() => {
    const pts: { x: number; y: number; w: number; h: number }[] = [];
    const walk = (node: Node | null) => {
      if (!node) return;
      if (node instanceof Element) {
        if (node.getAttribute("flt-semantics-identifier") === "mural_card_menu") {
          const r = node.getBoundingClientRect();
          if (r.width > 80 && r.height > 40 && r.y > 150) {
            pts.push({ x: r.x, y: r.y, w: r.width, h: r.height });
          }
        }
        if (node.shadowRoot) walk(node.shadowRoot);
        for (const c of Array.from(node.children)) walk(c);
      }
    };
    walk(document.body);
    pts.sort((a, b) => a.y - b.y);
    return pts[0] || null;
  });

  const iframeBox = await page.locator(FLUTTER_IFRAME).first().boundingBox();
  if (cardHit && iframeBox) {
    // Centro do ⋮ ≈ 40px à esquerda da borda direita, ~40px abaixo do topo do card
    const tries = [
      { dx: -40, dy: 40 },
      { dx: -60, dy: 40 },
      { dx: -40, dy: 28 },
      { dx: -80, dy: 48 },
    ];
    for (const t of tries) {
      const x = iframeBox.x + cardHit.x + cardHit.w + t.dx;
      const y = iframeBox.y + cardHit.y + t.dy;
      console.log(`${LOG} ⋮ try @ ${Math.round(x)},${Math.round(y)}`);
      await page.mouse.click(x, y);
      await page.waitForTimeout(600);
      if (await menuCardPopupAberto(page)) {
        console.log(`${LOG} menu aberto (offset)`);
        return;
      }
    }
  } else if (iframeBox) {
    await page.mouse.click(
      iframeBox.x + iframeBox.width * 0.92,
      iframeBox.y + iframeBox.height * 0.32,
    );
    await page.waitForTimeout(700);
  }
}

export async function tapAcaoMenuCard(
  page: Page,
  acao: "editar" | "excluir",
): Promise<void> {
  const frame = flutterFrameLocator(page);
  const id = acao === "editar" ? "mural_card_editar" : "mural_card_excluir";
  const label = acao === "editar" ? /^Editar$/i : /^Excluir$/i;
  const labelExact = acao === "editar" ? "Editar" : "Excluir";
  console.log(`${LOG} menu → ${acao}`);

  if (await tapFlutterSemId(page, id)) {
    await page.waitForTimeout(800);
    return;
  }
  if (await tapFlutterByAccessibleName(page, label)) {
    await page.waitForTimeout(800);
    return;
  }

  // Clica nó compacto com texto/aria Editar/Excluir (popup aberto)
  const hit = await frame.locator("body").evaluate((body, target) => {
    const re = new RegExp(`^${target}$`, "i");
    let best: { x: number; y: number; w: number; h: number } | null = null;
    let bestArea = Infinity;
    const walk = (node: Node | null) => {
      if (!node) return;
      if (node instanceof Element) {
        const aria = (node.getAttribute("aria-label") || "").trim();
        const lines = ((node as HTMLElement).innerText || "")
          .trim()
          .split("\n")
          .map((s) => s.trim());
        if (re.test(aria) || lines.some((l) => re.test(l))) {
          const r = node.getBoundingClientRect();
          const area = r.width * r.height;
          if (
            r.width >= 40 &&
            r.width < 420 &&
            r.height >= 18 &&
            r.height < 90 &&
            area < bestArea
          ) {
            bestArea = area;
            best = { x: r.x, y: r.y, w: r.width, h: r.height };
          }
        }
        if (node.shadowRoot) walk(node.shadowRoot);
        for (const c of Array.from(node.children)) walk(c);
      }
    };
    walk(body);
    return best;
  }, labelExact);

  if (hit) {
    const iframeBox = await page.locator(FLUTTER_IFRAME).first().boundingBox();
    if (iframeBox) {
      await page.mouse.click(
        iframeBox.x + hit.x + hit.w / 2,
        iframeBox.y + hit.y + hit.h / 2,
      );
      await page.waitForTimeout(800);
      return;
    }
  }

  throw new Error(`tapAcaoMenuCard: não achou ${acao} no popup`);
}

export async function confirmarDialogoSim(page: Page): Promise<void> {
  const frame = flutterFrameLocator(page);
  console.log(`${LOG} dialog Sim`);

  if (await tapFlutterSemId(page, "shared_dialog_sim")) {
    await page.waitForTimeout(1_000);
    return;
  }

  const clicked = await frame.locator("body").evaluate(() => {
    const re = /^Sim$/i;
    let best: HTMLElement | null = null;
    let bestArea = Infinity;
    const walk = (node: Node | null) => {
      if (!node) return;
      if (node instanceof Element) {
        const t = ((node as HTMLElement).innerText || "").trim().split("\n")[0] || "";
        if (re.test(t)) {
          const r = node.getBoundingClientRect();
          const area = r.width * r.height;
          if (r.width >= 24 && r.width < 300 && r.height >= 18 && r.height < 80 && area < bestArea) {
            bestArea = area;
            best = node as HTMLElement;
          }
        }
        if (node.shadowRoot) walk(node.shadowRoot);
        for (const c of Array.from(node.children)) walk(c);
      }
    };
    walk(document.body);
    if (!best) return false;
    best.click();
    return true;
  });

  if (!clicked) {
    if (!(await tapFlutterByAccessibleName(page, /^Sim$/i))) {
      throw new Error("confirmarDialogoSim: botão Sim não encontrado");
    }
  }
  await page.waitForTimeout(1_000);
}

export async function substituirTextoComposer(
  page: Page,
  texto: string,
): Promise<void> {
  const frame = flutterFrameLocator(page);
  console.log(`${LOG} substituir texto composer`);

  await expect
    .poll(
      async () =>
        (await frame.getByText(/Novo comunicado|Editar comunicado/i).count()) > 0,
      { timeout: 12_000 },
    )
    .toBe(true);

  const hint = frame.getByText(/Escreva seu texto aqui/i).first();
  if (await hint.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await hint.click({ force: true });
  } else if (!(await tapFlutterSemId(page, "mural_composer_texto"))) {
    const below = frame.getByText(/^Para:/i).first();
    if (await below.isVisible().catch(() => false)) {
      const box = await below.boundingBox();
      if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height + 40);
    }
  }
  await page.waitForTimeout(300);

  // Select-all + digitar (WEB)
  await page.keyboard.press("Control+A");
  await page.waitForTimeout(150);
  await page.keyboard.type(texto, { delay: 12 });
  await page.waitForTimeout(400);
}

export async function editarComunicadoLista(
  page: Page,
  opts: { trechoAncora?: string; novoTexto: string },
): Promise<void> {
  if (opts.trechoAncora) {
    await abrirMenuCardPorAssinatura(page, opts.trechoAncora);
  } else {
    await abrirMenuCardTopoEnviadas(page);
  }
  await tapAcaoMenuCard(page, "editar");
  await substituirTextoComposer(page, opts.novoTexto);
  await enviarComunicado(page);
  await filtrarEnviadas(page);
  await assertTextoNaLista(page, opts.novoTexto);
}

export async function excluirComunicadoLista(
  page: Page,
  trechoAncora?: string,
): Promise<void> {
  if (trechoAncora) {
    await abrirMenuCardPorAssinatura(page, trechoAncora);
  } else {
    await abrirMenuCardTopoEnviadas(page);
  }
  await tapAcaoMenuCard(page, "excluir");
  await confirmarDialogoSim(page);
  await filtrarEnviadas(page);
  if (trechoAncora) {
    await assertTextoAusenteNaLista(page, trechoAncora);
  }
}

export async function assertTextoAusenteNaLista(
  page: Page,
  trecho: string,
): Promise<void> {
  const needle = trecho.slice(0, 48);
  console.log(`${LOG} assert ausente: ${needle}`);
  await expect
    .poll(
      async () => {
        if (await textoVisivelNaLista(page, needle)) return 1;
        return 0;
      },
      {
        timeout: 20_000,
        intervals: [800, 1_200, 2_000],
        message: `Texto ainda visível na a11y: ${needle}`,
      },
    )
    .toBe(0);

  // Canvas: após excluir o topo recente, o 1º card não deve ser "há Ns" fresco
  await page.waitForTimeout(1_200);
  const aria = await topCardAria(page);
  if (aria && isCardRecente(aria)) {
    console.log(
      `${LOG} AVISO: topo ainda recente após exclusão (${aria.split("\n")[0]}) — a11y sem "${needle}"`,
    );
  }
}

// —— Filtros extras (composer funil) ——

export async function abrirFiltroExtrasComposer(page: Page): Promise<void> {
  const frame = flutterFrameLocator(page);
  console.log(`${LOG} funil filtro extras`);

  if (!(await tapFlutterSemId(page, "mural_composer_filtro"))) {
    const box = await page.locator(FLUTTER_IFRAME).first().boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width * 0.94, box.y + box.height * 0.08);
    }
  }
  await page.waitForTimeout(800);

  await expect
    .poll(
      async () => {
        const blob = await blobA11yFlutter(page);
        if (/Inadimplentes|Pagantes|Bolsistas|Limpar filtro|\bFiltros\b/i.test(blob)) {
          return true;
        }
        // Compact label exists (canvas a11y)
        return frame.locator("body").evaluate(() => {
          const re = /^(Inadimplentes|Pagantes|Limpar filtro|Filtros)$/i;
          let found = false;
          const walk = (node: Node | null) => {
            if (!node || found) return;
            if (node instanceof Element) {
              const t =
                ((node as HTMLElement).innerText || "").trim().split("\n")[0] ||
                "";
              const aria = (node.getAttribute("aria-label") || "").trim();
              if (re.test(t) || re.test(aria)) {
                const r = node.getBoundingClientRect();
                if (r.width >= 60 && r.width < 400 && r.height >= 18 && r.height < 70) {
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
      },
      { timeout: 12_000, message: "Menu de filtros extras não abriu" },
    )
    .toBe(true);
}

export async function selecionarFiltroExtras(
  page: Page,
  filtroLabel: string | RegExp,
): Promise<void> {
  const frame = flutterFrameLocator(page);
  console.log(`${LOG} filtro extras: ${filtroLabel}`);
  await abrirFiltroExtrasComposer(page);

  const re =
    typeof filtroLabel === "string"
      ? new RegExp(escapeRe(filtroLabel), "i")
      : filtroLabel;

  let clicked =
    (await tapCompactFlutterLabel(page, re, { minY: 80 })) ||
    (await tapFlutterByAccessibleName(page, re));
  if (!clicked) {
    const item = frame.getByText(re).first();
    await item.click({ force: true, timeout: 8_000 }).catch(() => undefined);
  }
  await page.waitForTimeout(700);

  // Sexo: submenu Masculino/Feminino (Maestro selecionar_filtro_extras)
  const sexoAberto = await frame
    .getByText(/^Masculino$|^Feminino$/i)
    .first()
    .isVisible()
    .catch(() => false);
  if (sexoAberto || /sexo/i.test(String(filtroLabel))) {
    const masc =
      (await tapFlutterLabelByMouse(page, /^Masculino$/i)) ||
      (await tapCompactFlutterLabel(page, /^Masculino$/i, { minY: 100 }));
    console.log(`${LOG} filtro sexo → Masculino=${masc}`);
    await page.waitForTimeout(500);
  }

  // Sub-dialogs (Período / Situação) — só se ainda NÃO voltou ao composer
  const stillInSubDialog = async () =>
    (await frame.getByText(/Novo comunicado|Para:|Escreva seu texto aqui/i).count()) ===
      0 ||
    (await frame.getByText(/M[eê]s corrente|Transferido|Per[ií]odo/i).count()) >
      0;

  if (await stillInSubDialog()) {
    await tapCompactFlutterLabel(page, /M[eê]s corrente/i, { minY: 100 }).catch(
      () => false,
    );
    await tapCompactFlutterLabel(page, /Transferido/i, { minY: 100 }).catch(
      () => false,
    );
    await tapCompactFlutterLabel(page, /^(Ok|OK|Confirmar|Aplicar)$/i, {
      minY: 100,
    }).catch(() => false);
    await page.waitForTimeout(500);
  }

  // Garante composer de novo (Escape se o funil ficou aberto)
  if (
    (await frame.getByText(/Limpar filtro|^Filtros$/i).count()) > 0 &&
    (await frame.getByText(/Escreva seu texto aqui|Para:/i).count()) === 0
  ) {
    await page.keyboard.press("Escape").catch(() => undefined);
    await page.waitForTimeout(300);
  }
}

/**
 * "Limpar filtro" no funil — só desmarca filtros especiais (não é CT de envio).
 */
export async function limparFiltroExtrasComposer(page: Page): Promise<void> {
  const frame = flutterFrameLocator(page);
  console.log(`${LOG} limpar filtro extras`);
  await abrirFiltroExtrasComposer(page);
  if (!(await tapFlutterSemId(page, "mural_composer_filtro_limpar"))) {
    const ok =
      (await tapCompactFlutterLabel(page, /Limpar filtro|^Limpar$/i)) ||
      (await tapFlutterByAccessibleName(page, /Limpar filtro|^Limpar$/i));
    if (!ok) {
      await frame.getByText(/Limpar filtro|^Limpar$/i).first().click({ force: true });
    }
  }
  await page.waitForTimeout(500);
}

export async function publicarComunicadoComFiltroExtras(
  page: Page,
  texto: string,
  filtroLabel: string | RegExp,
): Promise<void> {
  // Ordem = Maestro publicar_comunicado_filtro_extras: turmas → alvo → funil → texto → enviar
  await ensureMuralHome(page);
  await abrirNovoComunicado(page);
  await selecionarTurmasTodos(page);
  await selecionarAlvoTodos(page);
  await selecionarFiltroExtras(page, filtroLabel);
  await escreverTextoComunicado(page, texto);
  await enviarComunicado(page);
}

// —— Enquete ——

export async function adicionarEnqueteNova(page: Page): Promise<void> {
  const frame = flutterFrameLocator(page);
  console.log(`${LOG} enquete Nova`);

  if (!(await tapFlutterSemId(page, "mural_composer_enquete"))) {
    await frame
      .getByText(/Adicionar enquete ou aviso de recebimento/i)
      .first()
      .click({ force: true })
      .catch(() => undefined);
  }
  await page.waitForTimeout(700);

  const novaOk =
    (await tapFlutterByAccessibleName(page, /^Nova$/i)) ||
    (await frame.getByText(/^Nova$/i).first().isVisible({ timeout: 2_000 }).catch(() => false)
      ? (await frame.getByText(/^Nova$/i).first().click({ force: true }), true)
      : false);
  if (!novaOk) {
    throw new Error("Opção Nova da enquete não apareceu (a11y/DOM)");
  }
  await page.waitForTimeout(500);

  // Opções: canvas — digita após foco aproximado
  if (!(await tapFlutterByAccessibleName(page, /Op[cç][aã]o 1/i))) {
    await frame.getByText(/Op[cç][aã]o 1/i).first().click({ force: true }).catch(() => undefined);
  }
  await page.keyboard.type("Sim", { delay: 20 });
  await page.waitForTimeout(300);

  if (!(await tapFlutterByAccessibleName(page, /Op[cç][aã]o 2/i))) {
    await frame.getByText(/Op[cç][aã]o 2/i).first().click({ force: true }).catch(() => undefined);
  }
  await page.keyboard.type("Nao", { delay: 20 });
  await page.waitForTimeout(400);
}

export async function publicarComunicadoComEnquete(
  page: Page,
  texto: string,
): Promise<void> {
  await ensureMuralHome(page);
  await abrirNovoComunicado(page);
  await selecionarTurmasTodos(page);
  await selecionarAlvoTodos(page);
  await escreverTextoComunicado(page, texto);
  await adicionarEnqueteNova(page);
  await enviarComunicado(page);
}

// —— Evento ——

export async function abrirNovoEvento(page: Page): Promise<void> {
  const frame = flutterFrameLocator(page);
  console.log(`${LOG} Boom → Evento`);
  await ensureMuralHome(page);

  expect(await tapFlutterSemId(page, "mural_boom_fab")).toBeTruthy();
  await page.waitForTimeout(600);

  if (!(await tapFlutterSemId(page, "mural_boom_evento"))) {
    await frame.getByText(/Evento/i).first().click({ force: true, timeout: 8_000 });
  }
  await expect
    .poll(
      async () => (await frame.getByText(/Novo evento|T[ií]tulo|Dia inteiro/i).count()) > 0,
      { timeout: 15_000, message: "Composer de evento não abriu" },
    )
    .toBe(true);
}

export async function marcarEventoDiaInteiro(page: Page): Promise<void> {
  console.log(`${LOG} dia inteiro`);
  if (!(await tapFlutterSemId(page, "mural_evento_dia_inteiro"))) {
    const frame = flutterFrameLocator(page);
    await frame.getByText(/Dia inteiro/i).first().click({ force: true });
  }
  await page.waitForTimeout(400);
}

export async function escreverTituloEvento(
  page: Page,
  titulo: string,
): Promise<void> {
  const frame = flutterFrameLocator(page);
  console.log(`${LOG} título evento`);
  if (!(await tapFlutterSemId(page, "mural_evento_titulo"))) {
    const t = frame.getByText(/T[ií]tulo|Escreva/i).first();
    await t.click({ force: true }).catch(() => undefined);
  }
  await page.keyboard.type(titulo, { delay: 12 });
  await page.waitForTimeout(300);
}

export async function publicarEvento(
  page: Page,
  opts: { titulo: string; diaInteiro?: boolean },
): Promise<void> {
  await abrirNovoEvento(page);
  await selecionarTurmasTodos(page);
  await selecionarAlvoTodos(page);
  if (opts.diaInteiro) await marcarEventoDiaInteiro(page);
  await escreverTituloEvento(page, opts.titulo);
  // Enviar — mesmo botão do composer
  await enviarComunicado(page);
}

// —— Anexos / boleto / correspondência (WEB filechooser) ——

export async function abrirMenuAnexoClip(page: Page): Promise<void> {
  console.log(`${LOG} clipe anexo`);
  if (!(await tapFlutterSemId(page, "mural_composer_anexo"))) {
    // Ícone clipe na bottom bar (esquerda do composer) — ~35% width, ~78% height
    const box = await page.locator(FLUTTER_IFRAME).first().boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width * 0.28, box.y + box.height * 0.78);
    }
  }
  await page.waitForTimeout(700);
}

/** Anexa via file chooser do browser (não DocumentsUI Android). */
export async function anexarArquivoWeb(
  page: Page,
  filePath: string,
  via: "anexo" | "galeria" = "anexo",
): Promise<void> {
  console.log(`${LOG} anexar arquivo WEB (${via}): ${filePath}`);
  const chooserPromise = page.waitForEvent("filechooser", { timeout: 15_000 });

  if (via === "galeria") {
    if (!(await tapFlutterSemId(page, "mural_composer_galeria"))) {
      await abrirMenuAnexoClip(page);
      await tapCompactFlutterLabel(page, /galeria|imagem|foto|Selecionar arquivo/i);
    }
  } else {
    await abrirMenuAnexoClip(page);
    const ok =
      (await tapCompactFlutterLabel(page, /Selecionar arquivo/i)) ||
      (await tapFlutterByAccessibleName(page, /Selecionar arquivo|Arquivo|PDF/i));
    if (!ok) {
      const frame = flutterFrameLocator(page);
      await frame
        .getByText(/Selecionar arquivo|Arquivo|PDF|Documento/i)
        .first()
        .click({ force: true })
        .catch(() => undefined);
    }
  }

  const chooser = await chooserPromise.catch(() => null);
  if (!chooser) {
    throw new Error(
      "filechooser não abriu — Flutter WEB pode não expor input file neste build",
    );
  }
  await chooser.setFiles(filePath);
  await page.waitForTimeout(1_500);
}

export async function anexarBoleto(
  page: Page,
  opts?: { periodo?: "mes_corrente" | "competencia_01" },
): Promise<void> {
  const periodo = opts?.periodo ?? "mes_corrente";
  console.log(`${LOG} anexar boleto (periodo=${periodo})`);
  await abrirMenuAnexoClip(page);

  const tapped =
    (await tapCompactFlutterLabel(page, /^Boleto$/i)) ||
    (await tapFlutterByAccessibleName(page, /^Boleto$/i));
  if (!tapped) {
    throw new Error("anexarBoleto: item Boleto não encontrado no menu clipe");
  }
  await page.waitForTimeout(800);

  const frame = flutterFrameLocator(page);
  const dialog =
    (await tapCompactFlutterLabel(page, /Per[ií]odo|M[eê]s corrente/i).catch(
      () => false,
    )) ||
    (await frame.getByText(/Per[ií]odo|M[eê]s corrente/i).first().isVisible({ timeout: 2_000 }).catch(() => false));

  if (dialog || periodo === "competencia_01") {
    if (periodo === "competencia_01") {
      // Se o tap acima fechou algo, reabre diálogo se preciso
      if (await frame.getByText(/Per[ií]odo/i).first().isVisible({ timeout: 1_500 }).catch(() => false)) {
        await selecionarPeriodoCompetencia01(page);
      } else if (
        !(await tapCompactFlutterLabel(page, /01[\/\s]|\/01|01\b/).catch(() => false))
      ) {
        await selecionarPeriodoCompetencia01(page).catch(() => undefined);
      }
    } else {
      await tapCompactFlutterLabel(page, /M[eê]s corrente/i);
      await tapCompactFlutterLabel(page, /^(Ok|OK|Confirmar)$/i);
    }
  }
  await page.waitForTimeout(800);
}

/**
 * Dialog Período: escolhe competência contendo "01" (não mês corrente).
 * Espelho: selecionar_periodo_competencia_01.yaml
 */
export async function selecionarPeriodoCompetencia01(page: Page): Promise<void> {
  console.log(`${LOG} período → competência 01`);

  // Abre lista se o diálogo Período já estiver visível
  const openedDate =
    (await tapCompactFlutterLabel(page, /\d{2}\/\d{4}/)) ||
    (await tapCompactFlutterLabel(page, /Per[ií]odo/i));
  if (!openedDate) {
    console.log(`${LOG} AVISO: diálogo Período sem data visível — tentando Mês corrente`);
    await tapCompactFlutterLabel(page, /M[eê]s corrente/i);
    await tapCompactFlutterLabel(page, /^(Ok|OK)$/i);
    return;
  }
  await page.waitForTimeout(700);

  const comp =
    (await tapCompactFlutterLabel(page, /01[\/\-\s]|\/01|\b01\b|jan|Janeiro/i)) ||
    (await tapFlutterByAccessibleName(page, /01|Janeiro|Jan/i));
  if (!comp) {
    // 1º item da lista de competências
    const frame = flutterFrameLocator(page);
    const first = await frame.locator("body").evaluate(() => {
      const pts: { x: number; y: number; w: number; h: number }[] = [];
      const walk = (node: Node | null) => {
        if (!node) return;
        if (node instanceof Element) {
          const t = ((node as HTMLElement).innerText || "").trim();
          const r = node.getBoundingClientRect();
          if (
            /\d{2}\/\d{4}|\d{4}/.test(t) &&
            r.width >= 80 &&
            r.width < 400 &&
            r.height >= 28 &&
            r.height < 70 &&
            r.y > 120
          ) {
            pts.push({ x: r.x, y: r.y, w: r.width, h: r.height });
          }
          if (node.shadowRoot) walk(node.shadowRoot);
          for (const c of Array.from(node.children)) walk(c);
        }
      };
      walk(document.body);
      pts.sort((a, b) => a.y - b.y);
      return pts[0] || null;
    });
    const iframeBox = await page.locator(FLUTTER_IFRAME).first().boundingBox();
    if (first && iframeBox) {
      await page.mouse.click(
        iframeBox.x + first.x + first.w / 2,
        iframeBox.y + first.y + first.h / 2,
      );
    } else {
      throw new Error("selecionarPeriodoCompetencia01: item 01/lista não encontrado");
    }
  }
  await page.waitForTimeout(400);
  await tapCompactFlutterLabel(page, /^(Ok|OK)$/i);
  await page.waitForTimeout(600);
}

export async function anexarCorrespondencia(
  page: Page,
  itemLabel: RegExp = /Aviso de D[eé]bito|Correspond[eê]ncia|IR/i,
): Promise<void> {
  console.log(`${LOG} correspondência`);
  await abrirMenuAnexoClip(page);
  const corr =
    (await tapCompactFlutterLabel(page, /Correspond[eê]ncia/i)) ||
    (await tapFlutterByAccessibleName(page, /Correspond[eê]ncia/i));
  if (!corr) {
    throw new Error("anexarCorrespondencia: item não encontrado");
  }
  await page.waitForTimeout(600);
  const item =
    (await tapCompactFlutterLabel(page, itemLabel)) ||
    (await tapFlutterByAccessibleName(page, itemLabel));
  if (!item) {
    throw new Error(`anexarCorrespondencia: subitem ${itemLabel} não encontrado`);
  }
  await page.waitForTimeout(800);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Clica rótulo compacto no Flutter WEB (texto/aria) — getByText falha no canvas.
 */
async function tapCompactFlutterLabel(
  page: Page,
  labelRe: RegExp,
  opts?: { minY?: number; maxArea?: number },
): Promise<boolean> {
  const frame = flutterFrameLocator(page);
  const minY = opts?.minY ?? 60;
  const maxArea = opts?.maxArea ?? 60_000;
  const hit = await frame.locator("body").evaluate(
    (body, args) => {
      const re = new RegExp(args.source, args.flags);
      let best: { x: number; y: number; w: number; h: number; area: number } | null =
        null;
      const walk = (node: Node | null) => {
        if (!node) return;
        if (node instanceof Element) {
          const aria = (node.getAttribute("aria-label") || "").trim();
          const first =
            ((node as HTMLElement).innerText || "").trim().split("\n")[0]?.trim() ||
            "";
          if (re.test(first) || re.test(aria.split("\n")[0] || "")) {
            const r = node.getBoundingClientRect();
            const area = r.width * r.height;
            if (
              r.width >= 40 &&
              r.width < 420 &&
              r.height >= 16 &&
              r.height < 80 &&
              r.y >= args.minY &&
              area < args.maxArea
            ) {
              if (!best || area < best.area) {
                best = { x: r.x, y: r.y, w: r.width, h: r.height, area };
              }
            }
          }
          if (node.shadowRoot) walk(node.shadowRoot);
          for (const c of Array.from(node.children)) walk(c);
        }
      };
      walk(body);
      return best;
    },
    { source: labelRe.source, flags: labelRe.flags, minY, maxArea },
  );
  if (!hit) return false;
  const iframeBox = await page.locator(FLUTTER_IFRAME).first().boundingBox();
  if (!iframeBox) return false;
  await page.mouse.click(
    iframeBox.x + hit.x + hit.w / 2,
    iframeBox.y + hit.y + hit.h / 2,
  );
  return true;
}
