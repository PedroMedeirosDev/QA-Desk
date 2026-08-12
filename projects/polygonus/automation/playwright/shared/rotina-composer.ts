/**
 * Rotina (aba dentro do Mural) — Playwright WEB.
 * Espelho: maestro/flows/shared/rotina/*  (build ≥ 6.06.23)
 */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import path from "node:path";
import {
  FLUTTER_IFRAME,
  flutterFrameLocator,
  tapFlutterByAccessibleName,
  tapFlutterSemId,
  tapFlutterSemIdCompact,
} from "./flutter-comunicados";
import { ensureMuralHome } from "./mural-composer";

const LOG = "[rotina-web]";

export type RotinaBoomId =
  | "rotina_boom_alimentacao"
  | "rotina_boom_soneca"
  | "rotina_boom_banheiro"
  | "rotina_boom_bilhete";

function normEnv(v: string | undefined): string {
  return (v || "").replace(/\s+/g, " ").trim().replace(/^["']|["']$/g, "");
}

export function resolveTurmaRotina(): string {
  return (
    normEnv(process.env.TURMA_ROTINA) ||
    normEnv(process.env.TURMA_TESTE) ||
    "Maternal II"
  );
}

export function resolveAlunoRotina(): string {
  return (
    normEnv(process.env.ALUNO_ROTINA) ||
    normEnv(process.env.ALUNO_TESTE) ||
    normEnv(process.env.ALUNO_NOME) ||
    "Davi"
  );
}

/** Home → Mural → aba Rotina → boom FAB visível. */
export async function ensureAbaRotina(page: Page): Promise<void> {
  console.log(`${LOG} aba Rotina`);
  await ensureMuralHome(page);

  if (!(await tapFlutterSemId(page, "mural_tab_rotina"))) {
    if (!(await tapFlutterByAccessibleName(page, /^Rotina$/i))) {
      await flutterFrameLocator(page)
        .getByText(/^Rotina$/i)
        .first()
        .click({ force: true });
    }
  }
  await page.waitForTimeout(800);

  await expect
    .poll(
      async () =>
        (await flutterFrameLocator(page)
          .locator('[flt-semantics-identifier="rotina_boom_fab"]')
          .count()) > 0,
      { timeout: 15_000, message: "rotina_boom_fab não apareceu" },
    )
    .toBe(true);
}

/** Hit em label Flutter: linhas de lista podem ser altas (~56–140). */
async function tapListLabel(
  page: Page,
  labelRe: RegExp,
  opts?: { maxH?: number; maxArea?: number; minY?: number; maxW?: number },
): Promise<boolean> {
  const frame = flutterFrameLocator(page);
  const maxH = opts?.maxH ?? 140;
  const maxArea = opts?.maxArea ?? 160_000;
  const minY = opts?.minY ?? 40;
  const maxW = opts?.maxW ?? 1_200;
  const hit = await frame.locator("body").evaluate(
    (body, args) => {
      const re = new RegExp(args.source, args.flags);
      let best: { x: number; y: number; w: number; h: number; area: number } | null =
        null;
      const walk = (node: Node | null) => {
        if (!node) return;
        if (node instanceof Element) {
          const t =
            ((node as HTMLElement).innerText || "").trim().split("\n")[0] || "";
          const aria =
            (node.getAttribute("aria-label") || "").trim().split("\n")[0] || "";
          if (re.test(t) || re.test(aria)) {
            const r = node.getBoundingClientRect();
            const area = r.width * r.height;
            if (
              r.width >= 40 &&
              r.width < args.maxW &&
              r.height >= 14 &&
              r.height < args.maxH &&
              area < args.maxArea &&
              r.y > args.minY
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
    {
      source: labelRe.source,
      flags: labelRe.flags,
      maxH,
      maxArea,
      minY,
      maxW,
    },
  );

  if (!hit) return false;
  const box = await page.locator(FLUTTER_IFRAME).first().boundingBox();
  if (!box) return false;
  await page.mouse.click(box.x + hit.x + hit.w / 2, box.y + hit.y + hit.h / 2);
  return true;
}

async function dismissAtenção(page: Page): Promise<void> {
  try {
    if (page.isClosed()) return;
    const frame = flutterFrameLocator(page);
    const blob = await frame
      .locator("body")
      .evaluate((body) => body.innerText || "");
    if (!/Atenção|informe pelo menos um aluno/i.test(blob)) return;
    console.log(`${LOG} dismiss Atenção`);
    if (!(await tapListLabel(page, /^Fechar$/i, { maxH: 60 }))) {
      await tapFlutterByAccessibleName(page, /^Fechar$/i);
    }
    await page.waitForTimeout(400);
  } catch {
    /* página fechou */
  }
}

/** Linha do picker (Turma/Aluno): texto ou aria, inclusive rows largas. */
async function tapLinhaPicker(page: Page, labelRe: RegExp): Promise<boolean> {
  const frame = flutterFrameLocator(page);
  const hit = await frame.locator("body").evaluate(
    (body, args) => {
      const re = new RegExp(args.source, args.flags);
      let best: {
        x: number;
        y: number;
        w: number;
        h: number;
        score: number;
      } | null = null;
      const walk = (node: Node | null) => {
        if (!node) return;
        if (node instanceof Element) {
          const t =
            ((node as HTMLElement).innerText || "").trim().split("\n")[0] || "";
          const aria =
            (node.getAttribute("aria-label") || "").trim().split("\n")[0] || "";
          if (re.test(t) || re.test(aria)) {
            const r = node.getBoundingClientRect();
            if (
              r.width >= 40 &&
              r.width < 1400 &&
              r.height >= 16 &&
              r.height < 280 &&
              r.y > 50 &&
              r.y < 900
            ) {
              // Preferir linha de lista (larga) em vez de texto minúsculo
              const score = r.width * Math.min(r.height, 56);
              if (!best || score > best.score) {
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
    },
    { source: labelRe.source, flags: labelRe.flags },
  );
  if (!hit) return false;
  const box = await page.locator(FLUTTER_IFRAME).first().boundingBox();
  if (!box) return false;
  await page.mouse.click(
    box.x + hit.x + Math.min(hit.w, 360) / 2,
    box.y + hit.y + hit.h / 2,
  );
  return true;
}

/** WEB: picker é Dialog com role=button largo (~1144px) — sem ids turma/aluno. */
async function tapDialogButton(
  page: Page,
  labelRe: RegExp,
): Promise<boolean> {
  return tapLinhaPicker(page, labelRe);
}

/**
 * Clica o campo do dropdown NA MESMA LINHA do rótulo (direita / chevron).
 * Não clica abaixo — isso abre o menu seguinte (Aluno → Termo).
 */
async function tapCampoDropdown(page: Page, labelRe: RegExp): Promise<boolean> {
  const frame = flutterFrameLocator(page);
  const hit = await frame.locator("body").evaluate(
    (body, args) => {
      const re = new RegExp(args.source, args.flags);
      let best: { x: number; y: number; w: number; h: number; area: number } | null =
        null;
      const walk = (node: Node | null) => {
        if (!node) return;
        if (node instanceof Element) {
          const t =
            ((node as HTMLElement).innerText || "").trim().split("\n")[0] || "";
          const aria =
            (node.getAttribute("aria-label") || "").trim().split("\n")[0] || "";
          if (re.test(t) || re.test(aria)) {
            const r = node.getBoundingClientRect();
            const area = r.width * r.height;
            if (
              r.width >= 24 &&
              r.width < 500 &&
              r.height >= 12 &&
              r.height < 70 &&
              area < 40_000 &&
              r.y > 40
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
    { source: labelRe.source, flags: labelRe.flags },
  );
  const box = await page.locator(FLUTTER_IFRAME).first().boundingBox();
  if (!box || !hit) return false;
  await page.mouse.click(
    box.x + Math.min(hit.x + hit.w + 90, box.width * 0.72),
    box.y + hit.y + hit.h / 2,
  );
  return true;
}

async function pickerAberto(page: Page): Promise<boolean> {
  const frame = flutterFrameLocator(page);
  const info = await frame.locator("body").evaluate((body) => {
    let buttons = 0;
    let dialog = false;
    const walk = (node: Node | null) => {
      if (!node) return;
      if (node instanceof Element) {
        const role = (node.getAttribute("role") || "").toLowerCase();
        const aria = (node.getAttribute("aria-label") || "").toLowerCase();
        if (role === "dialog" || aria === "dialog") dialog = true;
        if (role === "button") {
          const r = node.getBoundingClientRect();
          if (r.width > 200 && r.height >= 36 && r.height < 70) buttons += 1;
        }
        if (node.shadowRoot) walk(node.shadowRoot);
        for (const c of Array.from(node.children)) walk(c);
      }
    };
    walk(body);
    return { dialog, buttons, text: (body.innerText || "").slice(0, 200) };
  });
  if (
    (await frame
      .locator('[flt-semantics-identifier="rotina_composer_ok"]')
      .count()) > 0
  ) {
    return true;
  }
  if ((await frame.locator('[role="checkbox"]').count()) > 0) return true;
  const blob = await frame.locator("body").evaluate((b) => b.innerText || "");
  // Composer também tem botões largos (Comida/Água) — não usar contagem.
  if (/CANCELAR|LIMPAR FILTRO|Limpar filtro/i.test(blob)) return true;
  if (/\bOK\b|\bOk\b/.test(blob) && /Cancelar/i.test(blob)) return true;
  return info.dialog;
}

async function tentarEscolherVisivel(page: Page, texto: string): Promise<boolean> {
  const full = new RegExp(escapeRe(texto), "i");
  if (await tapLinhaPicker(page, full)) return true;
  if (await tapListLabel(page, full, { minY: 70, maxH: 130, maxArea: 250_000 })) {
    return true;
  }
  if (await tapFlutterByAccessibleName(page, full)) return true;
  return false;
}

async function contarCardsAluno(page: Page): Promise<number> {
  return flutterFrameLocator(page).locator("body").evaluate((body) => {
    let n = 0;
    const walk = (node: Node | null) => {
      if (!node) return;
      if (node instanceof Element) {
        const r = node.getBoundingClientRect();
        if (
          r.width >= 100 &&
          r.width <= 280 &&
          r.height >= 100 &&
          r.height <= 220 &&
          r.y > 120 &&
          r.y < 720
        ) {
          n += 1;
        }
        if (node.shadowRoot) walk(node.shadowRoot);
        for (const c of Array.from(node.children)) walk(c);
      }
    };
    walk(body);
    return n;
  });
}

/** Grid visível após a turma: cards e/ou Selecionar + OK. */
async function gridAlunosVisivel(page: Page): Promise<boolean> {
  const blob = await flutterFrameLocator(page)
    .locator("body")
    .evaluate((b) => b.innerText || "");
  if (/Selecionar/i.test(blob) && /\bOK\b|\bOk\b/i.test(blob)) return true;
  if (/Davi/i.test(blob) && /\bOK\b|\bOk\b/i.test(blob)) return true;
  return (await contarCardsAluno(page)) >= 1;
}

/**
 * Card do aluno no grid (foto + nome). Um aluno na turma = um card.
 * Clica o centro do quadrado — não assume posição (4º era cache).
 */
async function escolherAluno(page: Page, nome: string): Promise<boolean> {
  const re = new RegExp(escapeRe(nome), "i");
  const frame = flutterFrameLocator(page);

  const hit = await frame.locator("body").evaluate(
    (body, args) => {
      const rre = new RegExp(args.source, args.flags);
      type Box = { x: number; y: number; w: number; h: number; named: boolean };
      const cards: Box[] = [];
      const walk = (node: Node | null) => {
        if (!node) return;
        if (node instanceof Element) {
          const first =
            ((node as HTMLElement).innerText || "").trim().split("\n")[0] || "";
          const aria =
            (node.getAttribute("aria-label") || "").trim().split("\n")[0] || "";
          const r = node.getBoundingClientRect();
          const isCard =
            r.width >= 100 &&
            r.width <= 280 &&
            r.height >= 100 &&
            r.height <= 220 &&
            r.y > 120 &&
            r.y < 720;
          if (isCard) {
            const named = rre.test(first) || rre.test(aria);
            cards.push({ x: r.x, y: r.y, w: r.width, h: r.height, named });
          }
          if (node.shadowRoot) walk(node.shadowRoot);
          for (const c of Array.from(node.children)) walk(c);
        }
      };
      walk(body);
      const named = cards.filter((c) => c.named);
      if (named.length) return named[0];
      if (cards.length === 1) return cards[0];
      if (cards.length > 1) return cards[0];
      return null;
    },
    { source: re.source, flags: re.flags },
  );

  const box = await page.locator(FLUTTER_IFRAME).first().boundingBox();
  if (hit && box) {
    console.log(
      `${LOG} aluno card ${Math.round(hit.w)}x${Math.round(hit.h)} @${Math.round(hit.y)}`,
    );
    await page.mouse.click(
      box.x + hit.x + hit.w / 2,
      box.y + hit.y + hit.h / 2,
    );
    await page.waitForTimeout(400);
    return true;
  }

  if (
    await tapListLabel(page, re, { maxH: 200, maxW: 280, maxArea: 60_000 })
  ) {
    console.log(`${LOG} aluno via label "${nome}"`);
    return true;
  }
  return false;
}

/** Lista do picker (sem campo busca na turma). Scroll até achar o texto. */
async function escolherNaLista(page: Page, texto: string): Promise<boolean> {
  if (await tentarEscolherVisivel(page, texto)) return true;

  const token = texto.trim().split(/\s+/)[0];
  const box = await page.locator(FLUTTER_IFRAME).first().boundingBox();
  for (let i = 0; i < 12; i++) {
    if (box) {
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.55);
      await page.mouse.wheel(0, 280);
      await page.waitForTimeout(280);
    }
    if (await tentarEscolherVisivel(page, texto)) return true;
    if (token && token !== texto && (await tentarEscolherVisivel(page, token))) {
      return true;
    }
  }
  return false;
}

/** Chips do composer (Comida → Jantar). */
async function marcarOpcoes(page: Page, opcoes: string[]): Promise<void> {
  for (const op of opcoes) {
    console.log(`${LOG} opção → ${op}`);
    const slug = op
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, "_");
    const re = new RegExp(`^${escapeRe(op)}$`, "i");
    const box = await page.locator(FLUTTER_IFRAME).first().boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.55);
      await page.mouse.wheel(0, 180);
      await page.waitForTimeout(300);
    }
    const ok =
      (await tapFlutterSemId(page, `rotina_composer_opcao_${slug}`)) ||
      (await tapListLabel(page, re, { maxH: 120 })) ||
      (await tapFlutterByAccessibleName(page, re)) ||
      (await tapLinhaPicker(page, re));
    if (!ok) {
      const seen = await flutterFrameLocator(page)
        .locator("body")
        .evaluate((b) => (b.innerText || "").replace(/\s+/g, " ").slice(0, 300));
      console.log(`${LOG} WARN opção "${op}" não achada — ${seen}`);
      continue;
    }
    await page.waitForTimeout(900);
  }
}

async function tapPrimeiraLinhaLista(page: Page): Promise<boolean> {
  const frame = flutterFrameLocator(page);
  const cb = frame.locator('[role="checkbox"]').first();
  if (await cb.isVisible({ timeout: 1_200 }).catch(() => false)) {
    await cb.click({ force: true });
    return true;
  }
  const box = await page.locator(FLUTTER_IFRAME).first().boundingBox();
  if (!box) return false;
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.36);
  await page.waitForTimeout(300);
  return true;
}

async function confirmarOkPicker(page: Page): Promise<void> {
  if (await tapFlutterSemIdCompact(page, "rotina_composer_ok")) return;
  if (await tapFlutterSemId(page, "rotina_composer_ok")) return;
  if (await tapDialogButton(page, /^(OK|Ok)$/i)) return;
  await tapListLabel(page, /^(OK|Ok)$/i, { maxH: 60 });
}

export async function abrirTipoRotina(
  page: Page,
  boomId: RotinaBoomId,
  boomTexto?: RegExp,
): Promise<void> {
  await ensureAbaRotina(page);
  console.log(`${LOG} boom → ${boomId}`);

  if (
    !(await tapFlutterSemIdCompact(page, "rotina_boom_fab")) &&
    !(await tapFlutterSemId(page, "rotina_boom_fab"))
  ) {
    const box = await page.locator(FLUTTER_IFRAME).first().boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width * 0.9, box.y + box.height * 0.86);
    }
  }
  await page.waitForTimeout(800);

  if (
    !(await tapFlutterSemIdCompact(page, boomId)) &&
    !(await tapFlutterSemId(page, boomId))
  ) {
    const re = boomTexto || new RegExp(boomId.replace("rotina_boom_", ""), "i");
    if (!(await tapFlutterByAccessibleName(page, re))) {
      if (!(await tapListLabel(page, re))) {
        throw new Error(`abrirTipoRotina: ${boomId} não encontrado`);
      }
    }
  }
  await page.waitForTimeout(1_000);
  const ids = await flutterFrameLocator(page)
    .locator("[flt-semantics-identifier]")
    .evaluateAll((els) =>
      [...new Set(els.map((e) => e.getAttribute("flt-semantics-identifier")))],
    );
  console.log(
    `${LOG} composer ids=${ids.filter((id) => id?.startsWith("rotina_")).join(",")}`,
  );
}

async function abrirPickerCampo(
  page: Page,
  labelRe: RegExp,
  fracY: number,
  semId?: string,
): Promise<boolean> {
  if (semId) {
    if (await tapFlutterSemIdCompact(page, semId)) {
      await page.waitForTimeout(600);
      if (await pickerAberto(page)) return true;
    }
  }
  if (await tapCampoDropdown(page, labelRe)) {
    await page.waitForTimeout(700);
    if (await pickerAberto(page)) return true;
  }
  if (await tapListLabel(page, labelRe, { maxH: 48 })) {
    await page.waitForTimeout(700);
    if (await pickerAberto(page)) return true;
  }
  const box = await page.locator(FLUTTER_IFRAME).first().boundingBox();
  if (box) {
    await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * fracY);
    await page.waitForTimeout(500);
    if (await pickerAberto(page)) return true;
  }
  const blob = await flutterFrameLocator(page)
    .locator("body")
    .evaluate((b) => (b.innerText || "").slice(0, 400));
  console.log(`${LOG} picker ainda fechado text=${blob.replace(/\s+/g, " ")}`);
  return false;
}

/** Turma + Aluno (+ OK). Usado por alimentação/soneca/banheiro/bilhete. */
export async function preencherTurmaAluno(
  page: Page,
  opts?: { turma?: string; aluno?: string },
): Promise<void> {
  const turma = opts?.turma || resolveTurmaRotina();
  const aluno = opts?.aluno || resolveAlunoRotina();
  console.log(`${LOG} turma/aluno → ${turma} / ${aluno}`);

  const turmaOk = await abrirPickerCampo(
    page,
    /^Turma$/i,
    0.18,
    "rotina_composer_turma",
  );
  if (!turmaOk) {
    throw new Error("Picker Turma não abriu (WEB sem rotina_composer_turma)");
  }
  await page.waitForTimeout(400);
  if (!(await escolherNaLista(page, turma))) {
    throw new Error(`Turma "${turma}" não encontrada no picker (scroll até o fim)`);
  }
  await page.waitForTimeout(800);

  // WEB: Aluno é dropdown → modal (Selecionar + cards + OK). Não abre sozinho.
  const alunoAberto = await abrirPickerCampo(
    page,
    /^Aluno$/i,
    0.26,
    "rotina_composer_aluno",
  );
  if (!alunoAberto) {
    throw new Error("Picker Aluno não abriu");
  }
  await page.waitForTimeout(600);

  // Turma normal: só o Davi. "Selecionar" = o único card (4º era cache de load).
  console.log(`${LOG} aluno: Selecionar + OK`);
  if (!(await tapLinhaPicker(page, /^Selecionar$/i))) {
    if (!(await tapListLabel(page, /^Selecionar$/i, { maxH: 80 }))) {
      await tapFlutterByAccessibleName(page, /^Selecionar$/i);
    }
  }
  await page.waitForTimeout(400);
  await confirmarOkPicker(page);
  if (await pickerAberto(page)) {
    console.log(`${LOG} OK aluno ainda aberto — tenta de novo`);
    await confirmarOkPicker(page);
    await page.waitForTimeout(400);
  }
  await page.screenshot({
    path: path.join(__dirname, "..", "debug-rotina-aluno.png"),
    fullPage: true,
  });
  await page.waitForTimeout(300);
  await dismissAtenção(page);
}

/** Turma → Aluno → Termo → opção → Enviar. */
export async function preencherEnviarRotina(
  page: Page,
  opts?: {
    turma?: string;
    aluno?: string;
    termo?: string;
    /** Ex.: alimentação = ["Comida", "Jantar"] */
    opcoes?: string[];
  },
): Promise<void> {
  const termo = opts?.termo;
  const opcoes = opts?.opcoes;
  await preencherTurmaAluno(page, opts);

  // Termo já vem preenchido (ex. Alimentação) — só abre se o CT pedir outro.
  if (termo) {
    await abrirPickerCampo(page, /^Termo$/i, 0.34, "rotina_composer_termo");
    await page.waitForTimeout(400);
    await escolherNaLista(page, termo);
    await page.waitForTimeout(500);
    await confirmarOkPicker(page);
    await page.waitForTimeout(400);
  }

  if (opcoes?.length) {
    await marcarOpcoes(page, opcoes);
  } else if (!(await tapFlutterSemId(page, "rotina_composer_opcao_nao"))) {
    if (!(await tapFlutterSemId(page, "rotina_composer_opcao_0"))) {
      await tapListLabel(page, /^(Não|Nao|Sim)$/i, { maxH: 100 });
    }
  }
  await page.waitForTimeout(400);

  await enviarRotina(page);
}

export async function enviarBilheteRotina(
  page: Page,
  texto: string,
): Promise<void> {
  await abrirTipoRotina(page, "rotina_boom_bilhete", /Bilhete/i);
  await preencherTurmaAluno(page);

  if (await tapFlutterSemId(page, "rotina_composer_termo")) {
    await page.waitForTimeout(500);
    await tapPrimeiraLinhaLista(page);
    await page.waitForTimeout(400);
  }

  console.log(`${LOG} bilhete texto`);
  const box = await page.locator(FLUTTER_IFRAME).first().boundingBox();
  if (!(await tapFlutterByAccessibleName(page, /Escreva|Digite|mensagem|Bilhete/i))) {
    if (!(await tapListLabel(page, /Escreva|Digite|mensagem/i, { maxH: 120 }))) {
      if (box) {
        await page.mouse.click(
          box.x + box.width * 0.45,
          box.y + box.height * 0.55,
        );
      }
    }
  }
  await page.waitForTimeout(300);
  await page.keyboard.type(texto, { delay: 12 });
  await page.waitForTimeout(400);
  await enviarRotina(page);
}

export async function enviarRotina(page: Page): Promise<void> {
  console.log(`${LOG} enviar`);
  await dismissAtenção(page);

  if (!(await tapFlutterSemIdCompact(page, "rotina_composer_enviar"))) {
    if (!(await tapFlutterSemId(page, "rotina_composer_enviar"))) {
      if (!(await tapListLabel(page, /^Enviar$/i, { maxH: 80 }))) {
        const box = await page.locator(FLUTTER_IFRAME).first().boundingBox();
        if (box) {
          await page.mouse.click(
            box.x + box.width * 0.88,
            box.y + box.height * 0.72,
          );
        }
      }
    }
  }
  await page.waitForTimeout(1_500);
  await dismissAtenção(page);

  const frame = flutterFrameLocator(page);
  await expect
    .poll(
      async () => {
        if (page.isClosed()) return false;
        try {
          await dismissAtenção(page);
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
          if (/informe pelo menos um aluno/i.test(blob)) return false;
          if (/Registro criado/i.test(blob)) return true;
          if (
            (await frame
              .locator('[flt-semantics-identifier="rotina_boom_fab"]')
              .count()) > 0
          ) {
            return true;
          }
          if (
            (await frame
              .locator('[flt-semantics-identifier="rotina_lista_vazia"]')
              .count()) > 0
          ) {
            return true;
          }
          if (
            /Show menu/i.test(blob) &&
            /Rotina|Alimenta|Soneca|Banheiro|Bilhete/i.test(blob) &&
            !/Registre hábitos|Envie bilhetes/i.test(blob)
          ) {
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },
      { timeout: 30_000, message: "Rotina: não voltou à lista / sem toast" },
    )
    .toBe(true);
  console.log(`${LOG} envio ok`);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
