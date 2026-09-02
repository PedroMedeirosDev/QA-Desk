/**
 * SESSAO-HIST-01 — Probe de sessão no Histórico escolar LEGADO (iframe Delphi).
 *
 * Login React CQ → menu "Histórico Escolar" (versão clássica) → busca aluna → idle.
 *
 *   set PLAYWRIGHT_SESSAO_PROBE_MIN=5
 *   npx playwright test legado/sessao-histescolar-idle.spec.ts --headed --workers=1
 */
import { test, expect } from "@playwright/test";
import path from "node:path";
import { GESTAO_URL, loadPlaywrightDotEnv } from "../shared/gestao-auth";
import {
  abrirTelaLegadoNoMenu,
  buscarRegistroNoLegado,
  LEGACY_IFRAME_SEL,
} from "../shared/gestao-menu-legado";
import {
  aguardarProbeIdle,
  installSessaoProbe,
  probeMinutos,
  resolveAlunoProbe,
} from "../shared/legado-session-probe";
import { abrirSessaoCq, loginCq } from "../academico/cq/cq-session";

loadPlaywrightDotEnv(path.join(__dirname, ".."));

test.use({ storageState: { cookies: [], origins: [] } });

const LOG = "[sessao-hist]";
const ALUNO = resolveAlunoProbe();
/** Menu 02.04.05 — Histórico Escolar (manual polygonus-react). */
const COD_MENU_HIST = "02.04.05";

async function abrirHistoricoLegadoNotas(page: import("@playwright/test").Page) {
  await loginCq(page, LOG);
  const frame = await abrirTelaLegadoNoMenu(page, "Histórico Escolar", {
    codMenuVersaoClassica: COD_MENU_HIST,
    caminho: ["Acadêmico", "Alunos", "Histórico Escolar"],
    log: LOG,
  });
  await buscarRegistroNoLegado(page, frame, ALUNO, LOG);

  const alterar = frame.getByRole("button", { name: /^Alterar$/i });
  if (await alterar.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await alterar.click();
    console.log(`${LOG} modo alteração (sem gravar)`);
  }
}

test("SESSAO-HIST-01 · Histórico escolar legado — idle até sessão cair ou timeout", async () => {
  const min = probeMinutos();
  test.setTimeout(min * 60_000 + 300_000);

  console.log(`${LOG} Amostra CQ =`, GESTAO_URL);
  console.log(`${LOG} canal = legado/iframe`);
  console.log(`${LOG} aluno =`, ALUNO);
  console.log(`${LOG} duração =`, min, "min");

  const { context, page } = await abrirSessaoCq();
  const stats = installSessaoProbe(page);

  try {
    await abrirHistoricoLegadoNotas(page);
    await expect(page.locator(LEGACY_IFRAME_SEL).first()).toBeAttached({
      timeout: 30_000,
    });
    const src = (await page.locator(LEGACY_IFRAME_SEL).first().getAttribute("src")) || "";
    expect(src, "deve carregar formulário Delphi").toMatch(/HistEscolar|acropolymodule|acropoly/i);
    await aguardarProbeIdle(page, stats, LOG);
  } finally {
    await context.close();
  }
});
