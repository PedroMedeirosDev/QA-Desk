/**
 * CT-MURAL-09 / LISTA-01 (WEB) — Alternar Enviadas ↔ Recebidas.
 * Espelho: maestro/flows/mural/01_1_filtro_enviadas.yaml
 *
 *   npx playwright test mural/09-filtro-enviadas.spec.ts
 */
import { test } from "@playwright/test";
import path from "node:path";
import { openComunicadosSession } from "../shared/comunicados-session";
import {
  assertFiltroSentidoAtivo,
  ensureMuralHome,
  filtrarSentido,
} from "../shared/mural-composer";

const ROOT = path.join(__dirname, "..");
const LOG = "[ct-mural-09-web]";

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial", timeout: 180_000 });

test("CT-MURAL-09 WEB: filtro Enviadas / Recebidas", async () => {
  const { context, page } = await openComunicadosSession(ROOT, LOG);

  try {
    await ensureMuralHome(page);
    await filtrarSentido(page, "Enviadas");
    await assertFiltroSentidoAtivo(page, "Enviadas");

    await filtrarSentido(page, "Recebidas");
    await assertFiltroSentidoAtivo(page, "Recebidas");
    console.log(`${LOG} ok`);
  } finally {
    await context.close();
  }
});
