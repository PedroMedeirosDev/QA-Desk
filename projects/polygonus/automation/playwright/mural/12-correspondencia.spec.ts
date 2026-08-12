/**
 * CORRESP-01 (WEB) — Clipe → Correspondência → item da lista.
 * Espelho: 01_1_comunicado_correspondencia_ir.yaml
 *
 *   npx playwright test mural/12-correspondencia.spec.ts
 */
import { test } from "@playwright/test";
import path from "node:path";
import { textoComunicadoPlaywright } from "../shared/assinatura-teste";
import { openComunicadosSession } from "../shared/comunicados-session";
import {
  anexarCorrespondencia,
  assertTextoNaLista,
  escreverTextoComunicado,
  ensureMuralHome,
  enviarComunicado,
  filtrarEnviadas,
  abrirNovoComunicado,
  selecionarAlvoTodos,
  selecionarTurmasTodos,
} from "../shared/mural-composer";

const ROOT = path.join(__dirname, "..");
const LOG = "[corresp-01-web]";

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial", timeout: 300_000 });

test("CORRESP-01 WEB: correspondência", async () => {
  const { context, page } = await openComunicadosSession(ROOT, LOG);
  const texto = textoComunicadoPlaywright("CORRESP-01");
  try {
    await ensureMuralHome(page);
    await abrirNovoComunicado(page);
    await selecionarTurmasTodos(page);
    await selecionarAlvoTodos(page);
    await anexarCorrespondencia(page);
    await escreverTextoComunicado(page, texto);
    await enviarComunicado(page);
    await filtrarEnviadas(page);
    await assertTextoNaLista(page, "Teste Playwright Chrome");
    console.log(`${LOG} ok`);
  } finally {
    await context.close();
  }
});
