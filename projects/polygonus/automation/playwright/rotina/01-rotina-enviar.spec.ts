/**
 * CT-ROTINA WEB — Alimentação / Soneca / Banheiro / Bilhete.
 * Espelho: maestro/flows/rotina/01_2_*
 *
 *   npx playwright test rotina/ --workers=1
 */
import { test } from "@playwright/test";
import path from "node:path";
import { openComunicadosSession } from "../shared/comunicados-session";
import {
  abrirTipoRotina,
  enviarBilheteRotina,
  preencherEnviarRotina,
} from "../shared/rotina-composer";

const ROOT = path.join(__dirname, "..");

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ timeout: 300_000 });

test("CT-ROTINA-01 WEB: alimentação", async () => {
  const log = "[ct-rotina-01-web]";
  const { context, page } = await openComunicadosSession(ROOT, log);
  try {
    await abrirTipoRotina(page, "rotina_boom_alimentacao", /Alimenta/i);
    await preencherEnviarRotina(page, {
      opcoes: ["Comida", "Jantar", "Comeu bem"],
    });
    console.log(`${log} ok`);
  } finally {
    await context.close().catch(() => undefined);
  }
});

test("CT-ROTINA-02 WEB: soneca", async () => {
  const log = "[ct-rotina-02-web]";
  const { context, page } = await openComunicadosSession(ROOT, log);
  try {
    await abrirTipoRotina(page, "rotina_boom_soneca", /Soneca/i);
    await preencherEnviarRotina(page, { opcoes: ["Dormiu"] });
    console.log(`${log} ok`);
  } finally {
    await context.close().catch(() => undefined);
  }
});

test("CT-ROTINA-03 WEB: banheiro", async () => {
  const log = "[ct-rotina-03-web]";
  const { context, page } = await openComunicadosSession(ROOT, log);
  try {
    await abrirTipoRotina(page, "rotina_boom_banheiro", /Banheiro/i);
    await preencherEnviarRotina(page, { opcoes: ["Xixi", "Sim"] });
    console.log(`${log} ok`);
  } finally {
    await context.close().catch(() => undefined);
  }
});

test("CT-ROTINA-04 WEB: bilhete", async () => {
  const log = "[ct-rotina-04-web]";
  const { context, page } = await openComunicadosSession(ROOT, log);
  const runId = Date.now().toString(36).slice(-6);
  try {
    await enviarBilheteRotina(
      page,
      `Teste Playwright Chrome - Bilhete Rotina #${runId}`,
    );
    console.log(`${log} ok`);
  } finally {
    await context.close().catch(() => undefined);
  }
});
