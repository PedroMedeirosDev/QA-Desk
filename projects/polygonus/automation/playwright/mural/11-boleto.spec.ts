/**
 * BOLETO-01 (WEB) — Clipe → Boleto (+ período se abrir).
 * Espelho: 01_1_comunicado_boleto.yaml
 *
 *   npx playwright test mural/11-boleto.spec.ts
 */
import { test } from "@playwright/test";
import path from "node:path";
import { textoComunicadoPlaywright } from "../shared/assinatura-teste";
import { openComunicadosSession } from "../shared/comunicados-session";
import {
  anexarBoleto,
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
const LOG = "[boleto-01-web]";

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial", timeout: 300_000 });

test("BOLETO-01 WEB: anexar boleto e enviar", async () => {
  const { context, page } = await openComunicadosSession(ROOT, LOG);
  const texto = textoComunicadoPlaywright("BOLETO-01");
  try {
    await ensureMuralHome(page);
    await abrirNovoComunicado(page);
    await selecionarTurmasTodos(page);
    await selecionarAlvoTodos(page);
    await anexarBoleto(page);
    await escreverTextoComunicado(page, texto);
    await enviarComunicado(page);
    await filtrarEnviadas(page);
    await assertTextoNaLista(page, "Teste Playwright Chrome");
    console.log(`${LOG} ok`);
  } finally {
    await context.close();
  }
});
