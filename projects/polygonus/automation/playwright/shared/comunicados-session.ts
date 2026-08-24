/**
 * Bootstrap sessão WEB Comunicados (amostra produção, sem :8443).
 */
import { expect, chromium, type BrowserContext, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import {
  chromePersistentLaunchOptions,
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
import {
  garantirPerfilCoordenador,
  garantirPerfilFuncao,
  garantirPerfilProfessor,
  type FuncaoPerfilFlutter,
} from "./garantir-perfil-coordenador";

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

/** Windows: perfil persistente fica preso se o Chrome headed não fechou. */
function killChromeUsingProfile(profileDir: string) {
  if (process.platform !== "win32") return;
  const marker = path.basename(profileDir) || "pw-comunicados";
  const ps = `
Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" |
  Where-Object { $_.CommandLine -match '${marker}' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
`;
  try {
    execFileSync("powershell.exe", ["-NoProfile", "-Command", ps], {
      stdio: "ignore",
      timeout: 20_000,
    });
  } catch {
    /* ignore */
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
  opts?: { perfil?: FuncaoPerfilFlutter },
): Promise<ComunicadosSession> {
  prepareComunicadosEnv(playwrightRoot);
  const headed = process.env.PLAYWRIGHT_HEADED !== "0";
  const profile = comunicadosProfileDir(playwrightRoot);
  const launchOpts = chromePersistentLaunchOptions(profile, { headed });
  let context: BrowserContext | undefined;
  let lastErr: unknown;
  for (let i = 0; i < 4; i++) {
    killChromeUsingProfile(profile);
    await new Promise((r) => setTimeout(r, 1_200));
    try {
      context = await chromium.launchPersistentContext(profile, launchOpts);
      break;
    } catch (e) {
      lastErr = e;
      console.log(`${log} launch retry ${i + 1}/4`);
      await new Promise((r) => setTimeout(r, 1_500 + i * 1_000));
    }
  }
  if (!context) throw lastErr;
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

  const perfil = opts?.perfil ?? "COORDENADOR";
  if (perfil === "PROFESSORES") {
    await garantirPerfilProfessor(page);
  } else if (perfil === "COORDENADOR") {
    // Envio mural sem Coordenador cai em Pendentes — quebra CRUD WEB
    await garantirPerfilCoordenador(page);
  } else {
    await garantirPerfilFuncao(page, perfil);
  }

  return { context, page, log };
}
