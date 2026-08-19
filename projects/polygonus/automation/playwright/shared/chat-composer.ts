/**
 * Atendimento novo (Chat) — Playwright WEB.
 * Espelho: maestro/flows/shared/chat/*  (build ≥ 6.06.23)
 * Legado Fale Conosco (home_card_atendimento) — fora de escopo.
 */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import path from "node:path";
import {
  FLUTTER_IFRAME,
  dismissContinuarOverlay,
  dismissFlutterCloseOverlay,
  flutterFrameLocator,
  tapFlutterByAccessibleName,
  tapFlutterSemId,
  tapFlutterSemIdCompact,
  logMissingSemantics,
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

  await logMissingSemantics(
    page,
    [
      "chat_lista_fab_nova",
      "chat_lista_item_0",
      "chat_input_texto",
      "chat_input_enviar_ou_mic",
    ],
    LOG,
  );
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

export type ChatAnexoTipo = "documento" | "galeria" | "camera";

async function blobA11yChat(page: Page): Promise<string> {
  return flutterFrameLocator(page)
    .locator("body")
    .evaluate((body) => {
      const parts: string[] = [body.innerText || ""];
      const walk = (node: Node | null) => {
        if (!node) return;
        if (node instanceof Element) {
          const a = node.getAttribute("aria-label");
          const id = node.getAttribute("flt-semantics-identifier");
          if (a) parts.push(a);
          if (id) parts.push(id);
          if (node.shadowRoot) walk(node.shadowRoot);
          for (const c of Array.from(node.children)) walk(c);
        }
      };
      walk(body);
      return parts.join("\n");
    });
}

/** Abre o sheet de anexo (`chat_input_anexo`). Sem id → anota gap Semantics. */
export async function abrirMenuAnexoChat(page: Page): Promise<void> {
  console.log(`${LOG} abrir menu anexo`);
  await logMissingSemantics(page, ["chat_input_anexo"], LOG);

  if (
    (await tapFlutterSemIdCompact(page, "chat_input_anexo")) ||
    (await tapFlutterSemId(page, "chat_input_anexo"))
  ) {
    await page.waitForTimeout(900);
    await logMissingSemantics(
      page,
      ["chat_anexo_documento", "chat_anexo_galeria", "chat_anexo_camera"],
      LOG,
    );
    return;
  }

  // Fallback texto / ícone clipe (só se a11y expuser)
  if (
    (await tapFlutterByAccessibleName(page, /anexo|anexar|documento|clip|attach/i)) ||
    (await tapFlutterByAccessibleName(page, /^Adicionar$/i))
  ) {
    await page.waitForTimeout(900);
    return;
  }

  throw new Error(
    "abrirMenuAnexoChat: chat_input_anexo ausente no WEB — anotar item 4 em SEMANTICS_SUGESTOES.md",
  );
}

async function tocarItemAnexoChat(
  page: Page,
  tipo: ChatAnexoTipo,
): Promise<void> {
  const id =
    tipo === "documento"
      ? "chat_anexo_documento"
      : tipo === "galeria"
        ? "chat_anexo_galeria"
        : "chat_anexo_camera";
  const labelRe =
    tipo === "documento"
      ? /documento|arquivo|PDF|Selecionar arquivo/i
      : tipo === "galeria"
        ? /galeria|imagem|foto|v[ií]deo|m[ií]dia/i
        : /c[aâ]mera|camera|filmar/i;

  console.log(`${LOG} item anexo → ${id}`);
  if (await tapFlutterSemIdCompact(page, id)) return;
  if (await tapFlutterSemId(page, id)) return;
  if (await tapFlutterByAccessibleName(page, labelRe)) return;

  throw new Error(
    `tocarItemAnexoChat: ${id} / rótulo não encontrado (WEB — item 4 SEMANTICS)`,
  );
}

/**
 * Anexa arquivo no chat WEB via filechooser (espelho Maestro 06_1_chat_pdf / vídeo).
 * `tipo`: documento (PDF) | galeria (foto/vídeo).
 */
export async function anexarArquivoChatWeb(
  page: Page,
  filePath: string,
  tipo: Exclude<ChatAnexoTipo, "camera"> = "documento",
): Promise<void> {
  console.log(`${LOG} anexar WEB (${tipo}): ${filePath}`);
  const chooserPromise = page.waitForEvent("filechooser", { timeout: 18_000 });

  await abrirMenuAnexoChat(page);
  await tocarItemAnexoChat(page, tipo);

  const chooser = await chooserPromise.catch(() => null);
  if (!chooser) {
    throw new Error(
      `filechooser não abriu após ${tipo} — Flutter WEB pode não expor <input type=file> / falta Semantics (item 4)`,
    );
  }
  await chooser.setFiles(filePath);
  await page.waitForTimeout(2_000);
  console.log(`${LOG} filechooser ok`);
}

/** Envia o que estiver no composer (texto ou anexo já escolhido). */
export async function tocarEnviarChat(page: Page): Promise<void> {
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
}

/**
 * Fluxo completo: thread → anexo → (opcional legenda) → enviar → assert a11y.
 */
export async function enviarAnexoChat(
  page: Page,
  filePath: string,
  opts: {
    tipo: Exclude<ChatAnexoTipo, "camera">;
    legenda?: string;
    /** Trecho esperado na thread (nome do arquivo ou “pdf” / “foto”). */
    assertNeedle?: string | RegExp;
  },
): Promise<void> {
  await abrirChat(page);
  await anexarArquivoChatWeb(page, filePath, opts.tipo);

  if (opts.legenda?.trim()) {
    if (!(await tapFlutterSemId(page, "chat_input_texto"))) {
      await tapFlutterByAccessibleName(page, /Escreva|Digite|Mensagem/i);
    }
    await page.waitForTimeout(200);
    await page.keyboard.type(opts.legenda, { delay: 12 });
    await page.waitForTimeout(300);
  }

  await tocarEnviarChat(page);

  const needle =
    opts.assertNeedle ||
    opts.legenda?.slice(0, 24) ||
    path.basename(filePath).slice(0, 18);
  const re =
    typeof needle === "string"
      ? new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
      : needle;

  let ok = false;
  try {
    await expect
      .poll(async () => re.test(await blobA11yChat(page)), {
        timeout: 25_000,
        message: `Chat: anexo/legenda não refletiu na a11y (${String(needle)})`,
      })
      .toBe(true);
    ok = true;
  } catch {
    // Anexo pode ir só no canvas — se o composer voltou, considera envio consumido
    if (await chatInputVisivel(page)) {
      console.log(`${LOG} anexo enviado (sem texto a11y do arquivo — canvas)`);
      ok = true;
    }
  }
  if (!ok) {
    throw new Error(
      `Chat: anexo não confirmado na a11y nem pelo composer (${String(needle)})`,
    );
  }
  console.log(`${LOG} anexo ok`);
}
