/**
 * CT-MURAL-02 (WEB) — Editar comunicado em Enviadas.
 * Espelho: maestro/flows/mural/01_1_comunicado_editar.yaml
 *
 *   npx playwright test mural/02-editar-comunicado.spec.ts
 */
import { test } from "@playwright/test";
import path from "node:path";
import { textoComunicadoPlaywright } from "../shared/assinatura-teste";
import { openComunicadosSession } from "../shared/comunicados-session";
import {
  assertTextoNaLista,
  editarComunicadoLista,
  filtrarEnviadas,
  publicarComunicadoTexto,
} from "../shared/mural-composer";

const ROOT = path.join(__dirname, "..");
const LOG = "[ct-mural-02-web]";

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial", timeout: 300_000 });

test("CT-MURAL-02 WEB: editar comunicado", async () => {
  const { context, page } = await openComunicadosSession(ROOT, LOG);
  const runId = Date.now().toString(36).slice(-6);
  const original = textoComunicadoPlaywright("CT-MURAL-02 original", { runId });
  const edited = textoComunicadoPlaywright("CT-MURAL-02 editado", { runId });

  try {
    await publicarComunicadoTexto(page, original);
    await filtrarEnviadas(page);
    await editarComunicadoLista(page, {
      trechoAncora: `#${runId}`,
      novoTexto: edited,
    });
    await assertTextoNaLista(page, `CT-MURAL-02 editado #${runId}`);
    console.log(`${LOG} ok — texto editado`);
  } finally {
    await context.close();
  }
});
