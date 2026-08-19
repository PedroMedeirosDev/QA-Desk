/**
 * CT-ROTINA WEB — Alimentação / Soneca / Banheiro / Bilhete / Humor / Vestuário / Momentos.
 * Ocorrência: rotina/08-ocorrencia-enviar.spec.ts
 *
 *   npx playwright test rotina/ --workers=1
 */
import { test } from "@playwright/test";
import path from "node:path";
import { openComunicadosSession } from "../shared/comunicados-session";
import {
  abrirTipoRotina,
  enviarBilheteRotina,
  enviarMomentosRotina,
  preencherEnviarRotina,
} from "../shared/rotina-composer";

const ROOT = path.join(__dirname, "..");

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ timeout: 360_000 });

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
    await preencherEnviarRotina(page, { opcoes: ["Dormiu", "Bem"] });
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
    await preencherEnviarRotina(page, { opcoes: ["Xixi", "No vaso"] });
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

test("CT-ROTINA-05 WEB: humor", async () => {
  const log = "[ct-rotina-05-web]";
  const { context, page } = await openComunicadosSession(ROOT, log);
  try {
    await abrirTipoRotina(page, "rotina_boom_humor", /Humor/i);
    await preencherEnviarRotina(page, { opcoes: ["Sorridente"] });
    console.log(`${log} ok`);
  } finally {
    await context.close().catch(() => undefined);
  }
});

test("CT-ROTINA-06 WEB: vestuário", async () => {
  const log = "[ct-rotina-06-web]";
  const { context, page } = await openComunicadosSession(ROOT, log);
  try {
    await abrirTipoRotina(page, "rotina_boom_vestuario", /Vestu/i);
    await preencherEnviarRotina(page, { opcoes: ["Fralda", "Uniforme"] });
    console.log(`${log} ok`);
  } finally {
    await context.close().catch(() => undefined);
  }
});

test("CT-ROTINA-07 WEB: momentos (8 fotos)", async () => {
  const log = "[ct-rotina-07-web]";
  const { context, page } = await openComunicadosSession(ROOT, log);
  const fix = path.join(ROOT, "..", "maestro", "fixtures");
  const fotos = [
    "Foto_1.jpeg",
    "Foto_2.jpeg",
    "Foto_3.jpg",
    "Foto_4.jpeg",
    "Foto_5.jpeg",
    "Foto_6.jpeg",
    "Foto_7.jpg",
    "Foto_8.jpeg",
  ].map((name) => path.join(fix, name));
  try {
    await enviarMomentosRotina(page, fotos);
    console.log(`${log} ok`);
  } finally {
    await context.close().catch(() => undefined);
  }
});
