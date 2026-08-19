/**
 * Garante função no Flutter (espelho Maestro garantir_perfil_*).
 * Labels exatos na lista: COORDENADOR | PROFESSORES | SUPORTE | SECRETARIA | RESPONSAVEIS
 */
import type { Page } from "@playwright/test";
import {
  flutterFrameLocator,
  tapFlutterByAccessibleName,
  tapFlutterSemId,
} from "./flutter-comunicados";
import {
  emitAppBuildMarker,
  parseVersaoTelaPerfil,
} from "./gestao-auth";

const LOG = "[perfil-web]";

export type FuncaoPerfilFlutter =
  | "COORDENADOR"
  | "PROFESSORES"
  | "SUPORTE"
  | "SECRETARIA"
  | "RESPONSAVEIS";

const TODAS: FuncaoPerfilFlutter[] = [
  "COORDENADOR",
  "PROFESSORES",
  "SUPORTE",
  "SECRETARIA",
  "RESPONSAVEIS",
];

export async function garantirPerfilCoordenador(page: Page): Promise<void> {
  await garantirPerfilFuncao(page, "COORDENADOR");
}

export async function garantirPerfilProfessor(page: Page): Promise<void> {
  await garantirPerfilFuncao(page, "PROFESSORES");
}

export async function garantirPerfilFuncao(
  page: Page,
  funcao: FuncaoPerfilFlutter,
): Promise<void> {
  const frame = flutterFrameLocator(page);
  console.log(`${LOG} garantindo ${funcao}`);

  // Se já estamos no Mural, volta à home
  if (
    (await frame
      .locator('[flt-semantics-identifier="mural_boom_fab"]')
      .count()) > 0
  ) {
    await page.keyboard.press("Escape").catch(() => undefined);
    const back = frame.getByText(/^Back$/i).first();
    if (await back.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await back.click({ force: true });
      await page.waitForTimeout(800);
    } else {
      const box = await page
        .locator('iframe[title="Flutter"], iframe[src*="flutter"]')
        .first()
        .boundingBox();
      if (box) await page.mouse.click(box.x + 28, box.y + 28);
      await page.waitForTimeout(800);
    }
  }

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

  const versao = await capturarVersaoPerfil(page);
  if (!versao) {
    throw new Error(
      "Tela Perfil: Versão do app não apareceu (esperado 'Versão: x.y.z')",
    );
  }

  const jaNaFuncao = await frame.locator("body").evaluate((body, alvo) => {
    const re = new RegExp(`^${alvo}$`, "i");
    let found = false;
    const walk = (node: Node | null) => {
      if (!node || found) return;
      if (node instanceof Element) {
        const t =
          ((node as HTMLElement).innerText || "").trim().split("\n")[0] || "";
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
    walk(body);
    return found;
  }, funcao);

  if (jaNaFuncao) {
    console.log(`${LOG} já ${funcao} — voltando`);
    await voltarParaHomeFlutter(page);
    return;
  }

  console.log(`${LOG} trocando função → ${funcao}`);
  const outras = TODAS.filter((f) => f !== funcao);
  if (!(await tapFlutterSemId(page, "perfil_dropdown_funcao"))) {
    await tapFlutterByAccessibleName(
      page,
      new RegExp(`^(${outras.join("|")})$`, "i"),
    );
  }
  await page.waitForTimeout(800);

  if (!(await tapFlutterByAccessibleName(page, new RegExp(`^${funcao}$`, "i")))) {
    await frame
      .getByText(new RegExp(`^${funcao}$`, "i"))
      .first()
      .click({ force: true, timeout: 10_000 });
  }
  await page.waitForTimeout(800);
  await voltarParaHomeFlutter(page);
  console.log(`${LOG} ${funcao} ok`);
}

async function capturarVersaoPerfil(page: Page): Promise<string | undefined> {
  const text = await flutterFrameLocator(page)
    .locator("body")
    .evaluate((body) => {
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
  const version = parseVersaoTelaPerfil(text);
  if (version) {
    process.env.APP_VERSION_PERFIL = version;
    emitAppBuildMarker(version, LOG);
    return version;
  }
  console.log(
    `${LOG} WARN Versão ausente no Perfil text=${text.replace(/\s+/g, " ").slice(0, 280)}`,
  );
  return undefined;
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
