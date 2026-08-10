/**
 * Smoke WEB — app Flutter via gestão Comunicação → Comunicados.
 * Espelho do smoke Maestro (piloto Coordenador / PHJESUS).
 *
 *   cd projects/polygonus/automation/playwright
 *   npx playwright test mural/smoke-comunicados-web.spec.ts
 *
 * Credenciais: PLAYWRIGHT_LOGIN (default LOGIN_PHJESUS) + SENHA do .env Maestro/PW.
 * Cloudflare: headed (PLAYWRIGHT_HEADED≠0).
 */
import { test, expect, chromium } from "@playwright/test";
import path from "node:path";
import {
  GESTAO_URL,
  loadPlaywrightDotEnv,
  loginGestaoSePreciso,
  passarCloudflareSePreciso,
  resolveGestaoLogin,
} from "../shared/gestao-auth";
import {
  abrirComunicadosNaGestao,
  probeHomeFlutter,
  tapMenuFlutterSeVisivel,
} from "../shared/flutter-comunicados";

loadPlaywrightDotEnv(path.join(__dirname, ".."));
// Smoke do app: PHJESUS (Coordenador), salvo override explícito COMUNICADOS_LOGIN
process.env.PLAYWRIGHT_LOGIN =
  process.env.COMUNICADOS_LOGIN?.trim() ||
  process.env.LOGIN_PHJESUS?.trim() ||
  "PHJESUS";
if (!process.env.PLAYWRIGHT_SENHA?.trim() && process.env.SENHA?.trim()) {
  process.env.PLAYWRIGHT_SENHA = process.env.SENHA.trim();
}

const PROFILE_DIR =
  process.env.PLAYWRIGHT_CHROME_PROFILE_COMUNICADOS?.trim() ||
  path.join(__dirname, "..", ".auth", "pw-comunicados");

const HEADED = process.env.PLAYWRIGHT_HEADED !== "0";
const LOG = "[comunicados-web]";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe.configure({ mode: "serial", timeout: 180_000 });

test("smoke: gestão → Comunicados → Flutter carrega", async () => {
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: "chrome",
    headless: !HEADED,
    locale: "pt-BR",
    viewport: { width: 1400, height: 900 },
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const page = context.pages()[0] || (await context.newPage());

  try {
    console.log(`${LOG} login=${resolveGestaoLogin()} headed=${HEADED}`);
    await page.goto(GESTAO_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await passarCloudflareSePreciso(page, LOG);
    await loginGestaoSePreciso(page, LOG);

    await abrirComunicadosNaGestao(page);

    const iframe = page
      .locator(
        'iframe[title="Flutter"], iframe[src*="/acropoly/web/flutter/"], iframe[src*="/web/flutter/"], iframe[src*="flutter"]',
      )
      .first();
    await expect(iframe).toBeAttached({ timeout: 5_000 });
    const src = (await iframe.getAttribute("src")) || "";
    expect(src, "iframe deve apontar para Flutter web").toMatch(/flutter/i);

    const probe = await probeHomeFlutter(page);
    console.log(`${LOG} probe home: ${probe.mode} — ${probe.detail}`);

    if (probe.mode === "none") {
      await page.screenshot({
        path: path.join(
          __dirname,
          "..",
          "test-results",
          "comunicados-web-no-a11y.png",
        ),
        fullPage: true,
      });
      test.info().annotations.push({
        type: "blocker",
        description:
          "Flutter web (CanvasKit) sem árvore a11y para menus. Smoke de abertura OK; taps de menu dependem de semantics web (pedido aos devs) ou HTML renderer.",
      });
      // Gate de abertura passou; a11y é próximo passo (não falha o smoke de carga).
      console.log(
        `${LOG} AVISO: menus Flutter não automatizáveis ainda — ${probe.detail}`,
      );
      if (process.env.COMUNICADOS_REQUIRE_A11Y === "1") {
        expect(
          probe.mode,
          `Exigido a11y (COMUNICADOS_REQUIRE_A11Y=1): ${probe.detail}`,
        ).not.toBe("none");
      }
      return;
    }

    expect(["a11y", "text"]).toContain(probe.mode);
    const abriuCal = await tapMenuFlutterSeVisivel(page, /CALEND[AÁ]RIO/i);
    console.log(`${LOG} tap Calendário = ${abriuCal}`);
  } finally {
    await context.close();
  }
});
