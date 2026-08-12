/**
 * CT-MURAL-14 / BOLETO-02 (WEB) — Inadimplentes + competência "01" + Boleto.
 * Espelho: maestro/flows/mural/01_1_comunicado_boleto_competencia.yaml
 *
 *   npx playwright test mural/11b-boleto-competencia.spec.ts
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
  selecionarFiltroExtras,
  selecionarPeriodoCompetencia01,
  selecionarTurmasTodos,
} from "../shared/mural-composer";
import { flutterFrameLocator } from "../shared/flutter-comunicados";

const ROOT = path.join(__dirname, "..");
const LOG = "[boleto-competencia-web]";

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial", timeout: 360_000 });

test("CT-MURAL-14 WEB: boleto + competência 01", async () => {
  const { context, page } = await openComunicadosSession(ROOT, LOG);
  const runId = Date.now().toString(36).slice(-6);
  const texto = textoComunicadoPlaywright("BOLETO-14 competencia", { runId });

  try {
    await ensureMuralHome(page);
    await abrirNovoComunicado(page);
    await selecionarTurmasTodos(page);
    await selecionarAlvoTodos(page);

    // Funil → Inadimplentes (pode abrir Período)
    await selecionarFiltroExtras(page, /Inadimplentes/i);

    const frame = flutterFrameLocator(page);
    if (await frame.getByText(/Per[ií]odo/i).first().isVisible({ timeout: 2_000 }).catch(() => false)) {
      await selecionarPeriodoCompetencia01(page);
    }

    await anexarBoleto(page, { periodo: "competencia_01" });

    // Boleto às vezes reabre Período
    if (await frame.getByText(/Per[ií]odo/i).first().isVisible({ timeout: 2_000 }).catch(() => false)) {
      await selecionarPeriodoCompetencia01(page);
    }

    await escreverTextoComunicado(page, texto);
    await enviarComunicado(page);
    await filtrarEnviadas(page);
    await assertTextoNaLista(page, `#${runId}`);
    console.log(`${LOG} ok`);
  } finally {
    await context.close();
  }
});
