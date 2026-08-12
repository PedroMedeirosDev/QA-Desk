/**
 * ANEXO-01 / ANEXO-02 (WEB) — foto/PDF via filechooser.
 * Vídeo (ANEXO-03): N/A se filechooser/compressão não estabilizar — ver README.
 *
 *   npx playwright test mural/05-anexos.spec.ts
 */
import { test } from "@playwright/test";
import path from "node:path";
import { textoComunicadoPlaywright } from "../shared/assinatura-teste";
import { openComunicadosSession } from "../shared/comunicados-session";
import {
  anexarArquivoWeb,
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
const FIX = path.join(__dirname, "fixtures");

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial", timeout: 360_000 });

async function publicarComAnexo(
  page: import("@playwright/test").Page,
  texto: string,
  file: string,
  via: "galeria" | "anexo",
) {
  await ensureMuralHome(page);
  await abrirNovoComunicado(page);
  await selecionarTurmasTodos(page);
  await selecionarAlvoTodos(page);
  await escreverTextoComunicado(page, texto);
  await anexarArquivoWeb(page, file, via);
  await enviarComunicado(page);
}

test("ANEXO-01 WEB: foto (filechooser)", async () => {
  const log = "[anexo-01-web]";
  const { context, page } = await openComunicadosSession(ROOT, log);
  const texto = textoComunicadoPlaywright("ANEXO-01 foto");
  try {
    await publicarComAnexo(page, texto, path.join(FIX, "foto-qa.png"), "galeria");
    await filtrarEnviadas(page);
    await assertTextoNaLista(page, "Teste Playwright Chrome");
    console.log(`${log} ok`);
  } finally {
    await context.close();
  }
});

test("ANEXO-02 WEB: PDF (filechooser)", async () => {
  const log = "[anexo-02-web]";
  const { context, page } = await openComunicadosSession(ROOT, log);
  const texto = textoComunicadoPlaywright("ANEXO-02 pdf");
  try {
    await publicarComAnexo(page, texto, path.join(FIX, "doc-qa.pdf"), "anexo");
    await filtrarEnviadas(page);
    await assertTextoNaLista(page, "Teste Playwright Chrome");
    console.log(`${log} ok`);
  } finally {
    await context.close();
  }
});
