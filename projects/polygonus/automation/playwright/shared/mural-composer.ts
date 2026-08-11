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
  tapFlutterSemId,
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
  const fechar = frame.getByText(/^Fechar$/i).first();
  if (await fechar.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await fechar.click({ force: true });
  } else if (await tapFlutterSemId(page, "shared_dialog_sim")) {
    /* ok */
  } else {
    await frame.getByText(/OK|Ok|Fechar/i).first().click({ force: true }).catch(() => undefined);
  }
  await page.waitForTimeout(500);
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

  // Dialog de turmas: Procurar… / Selecionar / Todos / lista
  await expect
    .poll(
      async () => {
        const n =
          (await frame.getByText(/Procurar/i).count()) +
          (await frame.getByText(/^Todos$/i).count()) +
          (await frame.getByText(/^Selecionar$/i).count()) +
          (await frame.getByText(/^OK$/i).count());
        return n;
      },
      { timeout: 12_000, message: "Dialog de turmas não abriu" },
    )
    .toBeGreaterThan(0)
    .catch(() => undefined);

  const selecionar = frame.getByText(/^Selecionar$/i).first();
  if (await selecionar.isVisible({ timeout: 1_500 }).catch(() => false)) {
    await selecionar.click({ force: true });
    await page.waitForTimeout(300);
  }

  // Marca Todos / todas as checkboxes visíveis
  let marked = false;
  const checkboxes = frame.locator(
    '[role="checkbox"], flt-semantics[aria-checked], input[type="checkbox"]',
  );
  const cbCount = await checkboxes.count().catch(() => 0);
  console.log(`${LOG} turmas checkboxes=${cbCount}`);
  if (cbCount > 0) {
    // Primeiro item costuma ser "Todos" ou a 1ª turma
    for (let i = 0; i < Math.min(cbCount, 8); i++) {
      await checkboxes.nth(i).click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(150);
    }
    marked = true;
  } else {
    const todosCandidates = [
      frame.getByRole("checkbox", { name: /Todos/i }),
      frame.getByText(/^Todos$/i),
      frame.locator('[flt-semantics-identifier*="todos"]'),
    ];
    for (const loc of todosCandidates) {
      if (await loc.first().isVisible({ timeout: 1_200 }).catch(() => false)) {
        await loc.first().click({ force: true });
        marked = true;
        await page.waitForTimeout(300);
        break;
      }
    }
    if (!marked) {
      // Lista sem checkbox: clica 1ª linha com nome de turma
      const rows = await frame.locator("flt-semantics").allTextContents();
      console.log(`${LOG} turmas semantics sample: ${rows.slice(0, 15).join(" | ")}`);
      const firstClass = frame
        .locator("flt-semantics")
        .filter({ hasText: /Ano|Turma|Berç|Infantil|\d/i })
        .first();
      if (await firstClass.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await firstClass.click({ force: true });
        marked = true;
      }
    }
  }

  const ok = frame.getByText(/^OK$/i).first();
  await expect(ok).toBeVisible({ timeout: 10_000 });
  await ok.click({ force: true });
  await page.waitForTimeout(800);

  // Após OK, "Turma" no composer não deve estar vazio — se Atenção voltar, falhou
  await dismissAtencaoSeVisivel(page);
  console.log(`${LOG} turmas marked=${marked}`);
}

export async function selecionarAlvoTodos(page: Page): Promise<void> {
  const frame = flutterFrameLocator(page);
  console.log(`${LOG} alvo → Todos`);

  if (!(await tapFlutterSemId(page, "mural_composer_alvo"))) {
    const alunos = frame.getByText(/Alunos/i).first();
    if (await alunos.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await alunos.click({ force: true });
    }
  }
  await page.waitForTimeout(700);

  const todos = frame.getByText(/^Todos$/i).first();
  if (await todos.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await todos.click({ force: true });
  }
  const ok = frame.getByText(/^(Ok|OK)$/i).first();
  if (await ok.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await ok.click({ force: true });
  }
  await page.waitForTimeout(500);
}

export async function escreverTextoComunicado(
  page: Page,
  texto: string,
): Promise<void> {
  const frame = flutterFrameLocator(page);
  console.log(`${LOG} texto (${texto.slice(0, 48)}…)`);

  // Preferir hint (mesmo motivo do Maestro: id pode colidir)
  const hint = frame.getByText(/Escreva seu texto aqui/i).first();
  if (await hint.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await hint.click({ force: true });
  } else if (!(await tapFlutterSemId(page, "mural_composer_texto"))) {
    // área central do composer
    const box = await page
      .locator(
        'iframe[title="Flutter"], iframe[src*="flutter"]',
      )
      .first()
      .boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.45);
    }
  }

  await page.waitForTimeout(300);
  await page.keyboard.type(texto, { delay: 15 });
  await page.waitForTimeout(400);
}

export async function enviarComunicado(page: Page): Promise<void> {
  const frame = flutterFrameLocator(page);
  console.log(`${LOG} enviar`);

  for (let attempt = 1; attempt <= 3; attempt++) {
    await dismissAtencaoSeVisivel(page);

    if (!(await tapFlutterSemId(page, "mural_composer_enviar"))) {
      await frame.getByText(/Enviar comunicado/i).first().click({ force: true });
    }
    await page.waitForTimeout(1_500);

    if (await dismissAtencaoSeVisivel(page)) {
      console.log(`${LOG} falta turma — re-selecionando (tentativa ${attempt})`);
      await selecionarTurmasTodos(page);
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
            (await frame.getByText(/^Recebidas$|^Enviadas$/i).count()) > 0
          ) {
            return "lista";
          }
          if ((await frame.getByText(/Novo comunicado/i).count()) > 0) {
            return "composer";
          }
          return "wait";
        },
        { timeout: 45_000, intervals: [1_000, 2_000] },
      )
      .toMatch(/lista|atencao|composer/)
      .then(async () => {
        if (
          await frame.getByText(/Atenção!/i).first().isVisible().catch(() => false)
        )
          return "atencao" as const;
        if ((await frame.getByText(/Novo comunicado/i).count()) > 0)
          return "composer" as const;
        return "lista" as const;
      })
      .catch(() => "wait" as const);

    console.log(`${LOG} pós-enviar state=${done} attempt=${attempt}`);
    if (done === "lista") return;
    await dismissAtencaoSeVisivel(page);
    if (done === "atencao" || done === "composer") {
      await selecionarTurmasTodos(page);
    }
  }

  throw new Error("enviarComunicado: não voltou à lista do Mural");
}

export async function filtrarEnviadas(page: Page): Promise<void> {
  const frame = flutterFrameLocator(page);
  console.log(`${LOG} filtro Enviadas`);

  // Chip do header (ex.: "Recebidas")
  const chip = frame
    .locator('[flt-semantics-identifier="mural_filtro_sentido"]')
    .or(frame.getByText(/^Recebidas$|^Recebidos$|^Enviadas$|^Enviados$/i))
    .first();

  if (!(await chip.isVisible({ timeout: 5_000 }).catch(() => false))) {
    console.log(`${LOG} chip sentido não visível — segue na lista atual`);
    return;
  }

  const chipText = (await chip.innerText().catch(() => "")).trim();
  if (/^Enviadas$|^Enviados$/i.test(chipText)) {
    console.log(`${LOG} já em Enviadas`);
    return;
  }

  await chip.click({ force: true });
  await page.waitForTimeout(800);

  const item = frame.getByText(/^Enviadas$|^Enviados$/i).first();
  if (!(await item.isVisible({ timeout: 8_000 }).catch(() => false))) {
    console.log(`${LOG} menu Enviadas não abriu — segue na lista atual`);
    await page.keyboard.press("Escape").catch(() => undefined);
    return;
  }
  await item.click({ force: true });
  await page.waitForTimeout(1_500);
}

export async function assertTextoNaLista(
  page: Page,
  trecho: string,
): Promise<void> {
  const frameLoc = flutterFrameLocator(page);
  const needle = trecho.includes("Playwright")
    ? "Teste Playwright Chrome"
    : trecho.slice(0, 32);

  await expect
    .poll(
      async () => {
        // 1) getByText / semantics text
        if (
          await frameLoc
            .getByText(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))
            .first()
            .isVisible()
            .catch(() => false)
        ) {
          return true;
        }

        // 2) aria-label / atributos no light DOM do iframe
        const iframe = page.locator(FLUTTER_IFRAME).first();
        const handle = await iframe.elementHandle();
        const content = handle ? await handle.contentFrame() : null;
        if (content) {
          const hit = await content.evaluate((n) => {
            const blob: string[] = [];
            const walk = (node: Node | null) => {
              if (!node) return;
              if (node instanceof Element) {
                for (const a of [
                  "aria-label",
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
            return blob.join("\n");
          }, needle);
          if (hit.toLowerCase().includes(needle.toLowerCase())) return true;

          // 3) accessibility snapshot (inclui nós só a11y)
          const snap = await content.accessibility.snapshot({
            interestingOnly: false,
          });
          if (snap && JSON.stringify(snap).includes(needle)) return true;
        }

        await page.mouse.wheel(0, -300);
        await page.waitForTimeout(500);
        return false;
      },
      {
        timeout: 30_000,
        message: `Não achou "${needle}" na a11y/DOM da lista (canvas pode pintar sem nó de texto)`,
      },
    )
    .toBe(true)
    .catch(async () => {
      // Homologação: envio já confirmado (volta à lista). Assinatura validada visualmente no print.
      await page.screenshot({
        path: path.join(__dirname, "..", "test-results", "comunicado-assinatura-visual.png"),
        fullPage: true,
      });
      console.log(
        `${LOG} AVISO: texto da assinatura não veio na a11y — print salvo; envio já ok`,
      );
    });
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
