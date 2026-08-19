/**
 * CT-NOTAS-01 WEB — Lançar nota (História / AV1 / Ana Carolina).
 *
 * Escopo: turma M3A26, disciplina História, aluna Ana Carolina Teixeira de Menezes,
 * avaliação AV1, nota 0–10 variando a cada run (NOTA_DIARIO override).
 *
 *   npx playwright test diario/01-notas-lancar.spec.ts --workers=1
 */
import { test } from "@playwright/test";
import path from "node:path";
import { openComunicadosSession } from "../shared/comunicados-session";
import { lancarNotaHistoria } from "../shared/diario-composer";

const ROOT = path.join(__dirname, "..");

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ timeout: 360_000 });

test("CT-NOTAS-01 WEB: lançar nota História AV1", async () => {
  const log = "[ct-notas-01-web]";
  const { context, page } = await openComunicadosSession(ROOT, log, {
    perfil: "PROFESSORES",
  });
  try {
    const nota = await lancarNotaHistoria(page);
    console.log(`${log} ok nota=${nota}`);
  } finally {
    await context.close().catch(() => undefined);
  }
});
