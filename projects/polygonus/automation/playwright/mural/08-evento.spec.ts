/**
 * EVENTO-01 / EVENTO-02 (WEB)
 * Espelho: 01_1_comunicado_evento.yaml + evento_dia_inteiro.yaml
 *
 *   npx playwright test mural/08-evento.spec.ts
 */
import { test } from "@playwright/test";
import path from "node:path";
import { textoComunicadoPlaywright } from "../shared/assinatura-teste";
import { openComunicadosSession } from "../shared/comunicados-session";
import {
  assertTextoNaLista,
  filtrarEnviadas,
  publicarEvento,
} from "../shared/mural-composer";

const ROOT = path.join(__dirname, "..");

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ timeout: 300_000 });

test("EVENTO-01 WEB: novo evento", async () => {
  const log = "[evento-01-web]";
  const { context, page } = await openComunicadosSession(ROOT, log);
  const titulo = textoComunicadoPlaywright("EVENTO-01");
  try {
    await publicarEvento(page, { titulo });
    await filtrarEnviadas(page);
    await assertTextoNaLista(page, "Teste Playwright Chrome");
    console.log(`${log} ok`);
  } finally {
    await context.close();
  }
});

test("EVENTO-02 WEB: evento dia inteiro", async () => {
  const log = "[evento-02-web]";
  const { context, page } = await openComunicadosSession(ROOT, log);
  const titulo = textoComunicadoPlaywright("EVENTO-02 dia inteiro");
  try {
    await publicarEvento(page, { titulo, diaInteiro: true });
    await filtrarEnviadas(page);
    await assertTextoNaLista(page, "Teste Playwright Chrome");
    console.log(`${log} ok`);
  } finally {
    await context.close();
  }
});
