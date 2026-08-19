/**
 * CT-ROTINA-08 WEB — Ocorrência (registros pedagógicos).
 * Espelho: maestro/flows/rotina/01_2_2_ocorrencia_enviar.yaml
 *
 *   npx playwright test rotina/08-ocorrencia-enviar.spec.ts --workers=1
 */
import { test } from "@playwright/test";
import path from "node:path";
import { openComunicadosSession } from "../shared/comunicados-session";
import { enviarOcorrenciaRotina } from "../shared/rotina-composer";

const ROOT = path.join(__dirname, "..");

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ timeout: 360_000 });

test("CT-ROTINA-08 WEB: ocorrência", async () => {
  const log = "[ct-rotina-08-web]";
  const { context, page } = await openComunicadosSession(ROOT, log);
  const runId = Date.now().toString(36).slice(-6);
  try {
    await enviarOcorrenciaRotina(
      page,
      `Teste Playwright Chrome - Ocorrência Rotina #${runId}`,
    );
    console.log(`${log} ok`);
  } finally {
    await context.close().catch(() => undefined);
  }
});
