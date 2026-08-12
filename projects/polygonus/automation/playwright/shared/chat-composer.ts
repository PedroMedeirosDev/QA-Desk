/**
 * Atendimento novo (Chat) — Playwright WEB.
 * Espelho: maestro/flows/shared/chat/*  (build ≥ 6.06.23)
 * Legado Fale Conosco (home_card_atendimento) — fora de escopo.
 */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import {
  FLUTTER_IFRAME,
  dismissContinuarOverlay,
  dismissFlutterCloseOverlay,
  flutterFrameLocator,
  tapFlutterByAccessibleName,
  tapFlutterSemId,
  tapFlutterSemIdCompact,
} from "./flutter-comunicados";

const LOG = "[chat-web]";

/** Volta à home Flutter (cards) se estiver em Mural/Chat interno. */
export async function ensureFlutterHome(page: Page): Promise<void> {
  const frame = flutterFrameLocator(page);
  await dismissContinuarOverlay(page, frame);
  await dismissFlutterCloseOverlay(page, frame);

  for (let i = 0; i < 5; i++) {
    if (
      (await frame
        .locator('[flt-semantics-identifier="home_card_mural"]')
        .count()) > 0
    ) {
      return;
    }
    await page.keyboard.press("Escape").catch(() => undefined);
    const box = await page.locator(FLUTTER_IFRAME).first().boundingBox();
    if (box) await page.mouse.click(box.x + 28, box.y + 28);
    await page.waitForTimeout(600);
  }
  throw new Error("ensureFlutterHome: home_card_mural não encontrado");
}

/** Abre o módulo Chat (lista) — não entra em conversa/FAB. */
export async function abrirListaChat(page: Page): Promise<void> {
  console.log(`${LOG} abrir home_card_chat (lista)`);
  await ensureFlutterHome(page);

  const box = await page.locator(FLUTTER_IFRAME).first().boundingBox();
  if (box) {
    for (let i = 0; i < 4; i++) {
      if (
        (await flutterFrameLocator(page)
          .locator('[flt-semantics-identifier="home_card_chat"]')
          .count()) > 0
      ) {
        break;
      }
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
      await page.mouse.wheel(0, 400);
      await page.waitForTimeout(400);
    }
  }

  if (!(await tapFlutterSemId(page, "home_card_chat"))) {
    if (!(await tapFlutterByAccessibleName(page, /Chat|Atendimento/i))) {
      throw new Error("abrirListaChat: home_card_chat não encontrado");
    }
  }
  await page.waitForTimeout(1_500);

  const frame = flutterFrameLocator(page);
  await expect
    .poll(
      async () =>
        (await frame
          .locator(
            '[flt-semantics-identifier="chat_lista_fab_nova"], [flt-semantics-identifier="chat_lista_item_0"], [flt-semantics-identifier="chat_input_texto"]',
          )
          .count()) > 0,
      { timeout: 20_000, message: "Chat lista/composer não abriu" },
    )
    .toBe(true);

  const ids = await flutterFrameLocator(page)
    .locator("[flt-semantics-identifier]")
    .evaluateAll((els) =>
      [...new Set(els.map((e) => e.getAttribute("flt-semantics-identifier")))],
    );
  console.log(`${LOG} lista ids=${ids.filter((id) => id?.startsWith("chat_")).join(",")}`);
}

async function chatInputVisivel(page: Page): Promise<boolean> {
  const frame = flutterFrameLocator(page);
  if (
    (await frame
      .locator('[flt-semantics-identifier="chat_input_texto"]')
      .count()) > 0
  ) {
    return true;
  }
  return (await frame.getByText(/Escreva|Digite uma mensagem|Mensagem/i).count()) > 0;
}

/**
 * Abre conversa pronta para digitar.
 * Preferência: item_0 da lista → se só FAB, cria fluxo mínimo (1ª pessoa).
 */
export async function abrirChat(page: Page): Promise<void> {
  await abrirListaChat(page);
  if (await chatInputVisivel(page)) return;

  // WEB: FAB abre "Novo grupo". Tenta thread existente primeiro.
  if (await tapFlutterSemIdCompact(page, "chat_lista_item_0")) {
    await page.waitForTimeout(1_200);
  }
  if (!(await chatInputVisivel(page))) {
    const box = await page.locator(FLUTTER_IFRAME).first().boundingBox();
    if (box) {
      for (const y of [0.34, 0.42, 0.5]) {
        await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * y);
        await page.waitForTimeout(900);
        if (await chatInputVisivel(page)) break;
      }
    }
  }

  if (!(await chatInputVisivel(page))) {
    if (
      (await tapFlutterSemIdCompact(page, "chat_lista_fab_nova")) ||
      (await tapFlutterSemId(page, "chat_lista_fab_nova"))
    ) {
      await page.waitForTimeout(1_000);
      await selecionarPessoaNovoGrupo(page);
    }
  }

  await expect
    .poll(async () => chatInputVisivel(page), {
      timeout: 20_000,
      message: "Chat: input de texto não apareceu",
    })
    .toBe(true);
}

async function selecionarPessoaNovoGrupo(page: Page): Promise<void> {
  console.log(`${LOG} novo grupo — buscar pessoa`);
  const frame = flutterFrameLocator(page);
  const busca =
    process.env.CHAT_PESSOA?.trim() ||
    process.env.ALUNO_NOME?.trim() ||
    process.env.ALUNO_ROTINA?.trim()?.split(/\s+/)[0] ||
    "Ana";

  const box = await page.locator(FLUTTER_IFRAME).first().boundingBox();
  if (!(await tapFlutterByAccessibleName(page, /Buscar pessoas/i))) {
    if (box) {
      await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.22);
    }
  }
  await page.waitForTimeout(300);
  await page.keyboard.type(busca, { delay: 40 });
  await page.waitForTimeout(1_500);

  const buscaRe = new RegExp(busca.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  if (!(await tapFlutterByAccessibleName(page, buscaRe))) {
    if (!(await tapFlutterByAccessibleName(page, /Ana|Pedro|Davi|Bruno/i))) {
      if (box) {
        for (const y of [0.36, 0.44, 0.52]) {
          await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * y);
          await page.waitForTimeout(400);
        }
      }
    }
  }
  await page.waitForTimeout(700);

  if (!(await tapFlutterByAccessibleName(page, /^Pr[oó]ximo$/i))) {
    if (box) {
      await page.mouse.click(box.x + box.width * 0.85, box.y + box.height * 0.92);
    }
  }
  await page.waitForTimeout(1_000);

  if (await tapFlutterByAccessibleName(page, /^(Criar|Concluir|Ok|OK)$/i)) {
    await page.waitForTimeout(1_000);
  } else if (box) {
    await page.mouse.click(box.x + box.width * 0.85, box.y + box.height * 0.92);
    await page.waitForTimeout(1_000);
  }

  const still =
    (await frame.getByText(/Novo grupo|Buscar pessoas/i).count()) > 0 &&
    (await frame.locator('[flt-semantics-identifier="chat_input_texto"]').count()) ===
      0;
  if (still) {
    throw new Error("abrirChat: não saiu de Novo grupo (selecione pessoa)");
  }
}

export async function enviarMensagemChat(
  page: Page,
  texto: string,
): Promise<void> {
  const frame = flutterFrameLocator(page);
  console.log(`${LOG} enviar texto (${texto.slice(0, 40)}…)`);

  if (!(await tapFlutterSemId(page, "chat_input_texto"))) {
    if (!(await tapFlutterByAccessibleName(page, /Escreva|Digite|Mensagem/i))) {
      const box = await page.locator(FLUTTER_IFRAME).first().boundingBox();
      if (box) {
        await page.mouse.click(
          box.x + box.width * 0.45,
          box.y + box.height * 0.88,
        );
      }
    }
  }
  await page.waitForTimeout(300);
  await page.keyboard.type(texto, { delay: 12 });
  await page.waitForTimeout(400);

  if (!(await tapFlutterSemId(page, "chat_input_enviar_ou_mic"))) {
    if (!(await tapFlutterSemId(page, "chat_input_enviar"))) {
      if (!(await tapFlutterByAccessibleName(page, /^Enviar$/i))) {
        const box = await page.locator(FLUTTER_IFRAME).first().boundingBox();
        if (box) {
          await page.mouse.click(
            box.x + box.width * 0.92,
            box.y + box.height * 0.9,
          );
        }
      }
    }
  }
  await page.waitForTimeout(1_500);

  const marker = texto.slice(0, 28);
  await expect
    .poll(
      async () => {
        const blob = await frame.locator("body").evaluate((body) => {
          const parts: string[] = [body.innerText || ""];
          const walk = (node: Node | null) => {
            if (!node) return;
            if (node instanceof Element) {
              const a = node.getAttribute("aria-label");
              if (a) parts.push(a);
              if (node.shadowRoot) walk(node.shadowRoot);
              for (const c of Array.from(node.children)) walk(c);
            }
          };
          walk(body);
          return parts.join("\n");
        });
        return blob.includes(marker);
      },
      { timeout: 20_000, message: `Chat: texto não apareceu (${marker}…)` },
    )
    .toBe(true);
  console.log(`${LOG} mensagem ok`);
}

/** Smoke: abre lista do chat (como Maestro 06_0) — sem entrar em Novo grupo. */
export async function smokeAbrirChat(page: Page): Promise<void> {
  await abrirListaChat(page);
  const frame = flutterFrameLocator(page);
  const ok =
    (await frame
      .locator(
        '[flt-semantics-identifier="chat_lista_fab_nova"], [flt-semantics-identifier="chat_lista_item_0"], [flt-semantics-identifier="chat_input_texto"]',
      )
      .count()) > 0;
  expect(ok, "smoke chat: lista/fab/input").toBeTruthy();
  console.log(`${LOG} smoke ok`);
}
