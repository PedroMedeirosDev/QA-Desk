/**
 * SESSAO-BIB-01 — Probe de sessão na Biblioteca / Obra LEGADO (iframe Delphi).
 *
 *   set PLAYWRIGHT_SESSAO_PROBE_MIN=5
 *   npx playwright test legado/sessao-biblioteca-idle.spec.ts --headed --workers=1
 */
import { test, expect } from "@playwright/test";
import path from "node:path";
import { GESTAO_URL, loadPlaywrightDotEnv } from "../shared/gestao-auth";
import {
  abrirTelaLegadoNoMenu,
  LEGACY_IFRAME_SEL,
} from "../shared/gestao-menu-legado";
import {
  aguardarProbeIdle,
  installSessaoProbe,
  probeMinutos,
} from "../shared/legado-session-probe";
import { abrirSessaoCq, loginCq } from "../academico/cq/cq-session";

loadPlaywrightDotEnv(path.join(__dirname, ".."));

test.use({ storageState: { cookies: [], origins: [] } });

const LOG = "[sessao-bib]";

async function abrirBibliotecaObraLegado(page: import("@playwright/test").Page) {
  await loginCq(page, LOG);
  const frame = await abrirTelaLegadoNoMenu(page, "Obra", {
    caminho: ["Biblioteca", "Obra"],
    log: LOG,
  });

  const novo = frame.getByRole("button", { name: /^Novo$/i });
  if (await novo.isVisible({ timeout: 15_000 }).catch(() => false)) {
    await novo.click();
    console.log(`${LOG} formulário novo obra aberto (sem gravar)`);
  }
}

test("SESSAO-BIB-01 · Biblioteca / obra legado — idle até sessão cair ou timeout", async () => {
  const min = probeMinutos();
  test.setTimeout(min * 60_000 + 300_000);

  console.log(`${LOG} Amostra CQ =`, GESTAO_URL);
  console.log(`${LOG} canal = legado/iframe`);
  console.log(`${LOG} duração =`, min, "min");

  const { context, page } = await abrirSessaoCq();
  const stats = installSessaoProbe(page);

  try {
    await abrirBibliotecaObraLegado(page);
    await expect(page.locator(LEGACY_IFRAME_SEL).first()).toBeAttached({
      timeout: 30_000,
    });
    const src = (await page.locator(LEGACY_IFRAME_SEL).first().getAttribute("src")) || "";
    expect(src, "deve carregar formulário Delphi de obra").toMatch(/Obra|acropolymodule|acropoly/i);
    await aguardarProbeIdle(page, stats, LOG);
  } finally {
    await context.close();
  }
});
