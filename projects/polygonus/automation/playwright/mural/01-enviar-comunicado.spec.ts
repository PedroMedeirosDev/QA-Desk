/**
 * CT-MURAL-01 (WEB) — Enviar comunicado de texto.
 * Espelho: maestro/flows/mural/01_1_comunicado_enviar.yaml
 *
 * Assinatura: "Teste Playwright Chrome — …"
 *
 *   cd projects/polygonus/automation/playwright
 *   npx playwright test mural/01-enviar-comunicado.spec.ts
 */
import { test, expect } from "@playwright/test";
import path from "node:path";
import { textoComunicadoPlaywright } from "../shared/assinatura-teste";
import { openComunicadosSession } from "../shared/comunicados-session";
import {
  assertTextoNaLista,
  filtrarEnviadas,
  publicarComunicadoTexto,
} from "../shared/mural-composer";

const ROOT = path.join(__dirname, "..");
const LOG = "[ct-mural-01-web]";

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial", timeout: 240_000 });

test("CT-MURAL-01 WEB: enviar comunicado (assinatura Playwright)", async () => {
  const { context, page } = await openComunicadosSession(ROOT, LOG);
  const texto = textoComunicadoPlaywright("CT-MURAL-01 enviar");

  try {
    console.log(`${LOG} publicando: ${texto}`);
    await publicarComunicadoTexto(page, texto);
    await filtrarEnviadas(page);
    // Assinatura deve aparecer no card (Recebidas ou Enviadas)
    await assertTextoNaLista(page, "Teste Playwright Chrome");
    console.log(`${LOG} ok — comunicado na lista com assinatura Playwright`);
  } finally {
    await context.close();
  }
});
