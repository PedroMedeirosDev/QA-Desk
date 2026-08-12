/**
 * CT-MURAL-03 (WEB) — Excluir comunicado em Enviadas.
 * Espelho: maestro/flows/mural/01_1_comunicado_excluir.yaml
 *
 *   npx playwright test mural/03-excluir-comunicado.spec.ts
 */
import { test } from "@playwright/test";
import path from "node:path";
import { textoComunicadoPlaywright } from "../shared/assinatura-teste";
import { openComunicadosSession } from "../shared/comunicados-session";
import {
  assertTextoAusenteNaLista,
  excluirComunicadoLista,
  filtrarEnviadas,
  publicarComunicadoTexto,
} from "../shared/mural-composer";

const ROOT = path.join(__dirname, "..");
const LOG = "[ct-mural-03-web]";

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial", timeout: 300_000 });

test("CT-MURAL-03 WEB: excluir comunicado", async () => {
  const { context, page } = await openComunicadosSession(ROOT, LOG);
  const runId = Date.now().toString(36).slice(-6);
  const texto = textoComunicadoPlaywright("CT-MURAL-03 excluir", { runId });
  const ancora = `#${runId}`;

  try {
    await publicarComunicadoTexto(page, texto);
    await filtrarEnviadas(page);
    await excluirComunicadoLista(page, ancora);
    await assertTextoAusenteNaLista(page, ancora);
    console.log(`${LOG} ok — exclusão confirmada`);
  } finally {
    await context.close();
  }
});
