/**
 * Bootstrap sessão WEB Comunicados (amostra produção, sem :8443).
 */
import { expect, chromium, type BrowserContext, type Page } from "@playwright/test";
import path from "node:path";
import {
  loadPlaywrightDotEnv,
  loginGestaoSePreciso,
  passarCloudflareSePreciso,
  resolveGestaoLogin,
  resolveGestaoUrl,
} from "./gestao-auth";
import {
  FLUTTER_IFRAME,
  abrirComunicadosNaGestao,
  probeMuralFlutter,
} from "./flutter-comunicados";

export type ComunicadosSession = {
  context: BrowserContext;
  page: Page;
  log: string;
};

export function prepareComunicadosEnv(playwrightRoot: string) {
  loadPlaywrightDotEnv(playwrightRoot);
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
}

export function comunicadosProfileDir(playwrightRoot: string) {
  return (
    process.env.PLAYWRIGHT_CHROME_PROFILE_COMUNICADOS?.trim() ||
    path.join(playwrightRoot, ".auth", "pw-comunicados")
  );
}

export async function openComunicadosSession(
  playwrightRoot: string,
  log = "[comunicados-web]",
): Promise<ComunicadosSession> {
  prepareComunicadosEnv(playwrightRoot);
  const headed = process.env.PLAYWRIGHT_HEADED !== "0";
  const context = await chromium.launchPersistentContext(
    comunicadosProfileDir(playwrightRoot),
    {
      channel: "chrome",
      headless: !headed,
      locale: "pt-BR",
      viewport: { width: 1400, height: 900 },
      args: ["--disable-blink-features=AutomationControlled"],
    },
  );
  const page = context.pages()[0] || (await context.newPage());
  const gestaoUrl = resolveGestaoUrl();
  console.log(`${log} url=${gestaoUrl} login=${resolveGestaoLogin()} headed=${headed}`);

  await page.goto(gestaoUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await passarCloudflareSePreciso(page, log);
  await loginGestaoSePreciso(page, log);
  await abrirComunicadosNaGestao(page);

  const iframe = page.locator(FLUTTER_IFRAME).first();
  await expect(iframe).toBeAttached({ timeout: 5_000 });
  expect(await iframe.getAttribute("src")).toMatch(/flutter/i);

  const probe = await probeMuralFlutter(page);
  console.log(`${log} probe: ${probe.mode} — ${probe.detail}`);
  expect(
    probe.mode,
    `Flutter precisa de semantics: ${probe.detail}`,
  ).toBe("semantics");
  expect(
    probe.sampleIds.some(
      (id) => id === "home_card_mural" || id.startsWith("mural_"),
    ),
    `Esperado home_card_mural ou mural_*; veio: ${probe.sampleIds.join(",")}`,
  ).toBeTruthy();

  return { context, page, log };
}
