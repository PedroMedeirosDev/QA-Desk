/**
 * Smoke WEB — Flutter via gestão Comunicação → Comunicados (= home → Mural).
 *
 * URL: amostra PRODUÇÃO (sem :8443) —
 *   https://amostra.polygonus.com.br/web/react/gestao
 * Override: COMUNICADOS_GESTAO_URL
 *
 * Selectors: [flt-semantics-identifier="…"] no iframe (frameLocator).
 * Headed por default (Cloudflare bloqueia headless).
 *
 *   cd projects/polygonus/automation/playwright
 *   npx playwright test mural/smoke-comunicados-web.spec.ts
 *
 * Gate estrito (só semantics): COMUNICADOS_REQUIRE_A11Y=1
 */
import { test, expect, chromium } from "@playwright/test";
import path from "node:path";
import {
  chromePersistentLaunchOptions,
  loadPlaywrightDotEnv,
  loginGestaoSePreciso,
  passarCloudflareSePreciso,
  resolveGestaoLogin,
  resolveGestaoUrl,
} from "../shared/gestao-auth";
import {
  FLUTTER_IFRAME,
  abrirComunicadosNaGestao,
  probeMuralFlutter,
  tapMuralAcaoSmoke,
} from "../shared/flutter-comunicados";

loadPlaywrightDotEnv(path.join(__dirname, ".."));

// App Flutter WEB = amostra produção (sem :8443). CQ :8443 fica p/ Acadêmico/Ficha.
process.env.PLAYWRIGHT_GESTAO_URL =
  process.env.COMUNICADOS_GESTAO_URL?.trim() ||
  "https://amostra.polygonus.com.br/web/react/gestao";

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
const REQUIRE_A11Y = process.env.COMUNICADOS_REQUIRE_A11Y === "1";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe.configure({ mode: "serial", timeout: 180_000 });

test("smoke: gestão → Comunicados → Mural", async () => {
  const context = await chromium.launchPersistentContext(
    PROFILE_DIR,
    chromePersistentLaunchOptions(PROFILE_DIR, { headed: HEADED }),
  );
  const page = context.pages()[0] || (await context.newPage());

  try {
    const gestaoUrl = resolveGestaoUrl();
    console.log(
      `${LOG} url=${gestaoUrl} login=${resolveGestaoLogin()} headed=${HEADED} requireA11y=${REQUIRE_A11Y}`,
    );
    await page.goto(gestaoUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await passarCloudflareSePreciso(page, LOG);
    await loginGestaoSePreciso(page, LOG);

    await abrirComunicadosNaGestao(page);

    const iframe = page.locator(FLUTTER_IFRAME).first();
    await expect(iframe).toBeAttached({ timeout: 5_000 });
    const src = (await iframe.getAttribute("src")) || "";
    expect(src, "iframe deve apontar para Flutter web").toMatch(/flutter/i);

    const probe = await probeMuralFlutter(page);
    console.log(`${LOG} probe: ${probe.mode} — ${probe.detail}`);

    if (REQUIRE_A11Y) {
      expect(
        probe.mode,
        `Exigido flt-semantics-identifier: ${probe.detail}`,
      ).toBe("semantics");
    } else {
      // Homologação: Flutter carregou (semantics, texto ou canvas) = ok
      expect(
        ["semantics", "text", "shell"].includes(probe.mode),
        `Flutter Comunicados não carregou: ${probe.detail}`,
      ).toBeTruthy();
    }

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
      return;
    }

    const tapped = await tapMuralAcaoSmoke(page);
    console.log(`${LOG} ação smoke = ${tapped ?? "falhou"}`);

    if (REQUIRE_A11Y) {
      expect(
        tapped && tapped !== "fallback",
        "deveria tocar mural_* via flt-semantics-identifier",
      ).toBeTruthy();
    }
  } finally {
    await context.close();
  }
});
