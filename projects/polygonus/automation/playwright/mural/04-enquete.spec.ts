/**
 * CT-MURAL-04 / ENQUETE-01 (WEB) — Comunicado com enquete Nova.
 * Espelho: maestro/flows/mural/01_1_comunicado_enquete.yaml
 *
 *   npx playwright test mural/04-enquete.spec.ts
 */
import { test } from "@playwright/test";
import path from "node:path";
import { textoComunicadoPlaywright } from "../shared/assinatura-teste";
import { openComunicadosSession } from "../shared/comunicados-session";
import {
  assertTextoNaLista,
  filtrarEnviadas,
  publicarComunicadoComEnquete,
} from "../shared/mural-composer";

const ROOT = path.join(__dirname, "..");
const LOG = "[ct-mural-04-web]";

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial", timeout: 300_000 });

test("CT-MURAL-04 WEB: comunicado com enquete Nova", async () => {
  const { context, page } = await openComunicadosSession(ROOT, LOG);
  const texto = textoComunicadoPlaywright("CT-MURAL-04 enquete");

  try {
    await publicarComunicadoComEnquete(page, texto);
    await filtrarEnviadas(page);
    await assertTextoNaLista(page, "Teste Playwright Chrome");
    console.log(`${LOG} ok`);
  } finally {
    await context.close();
  }
});
