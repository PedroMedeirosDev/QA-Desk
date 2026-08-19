/**
 * CT-DIARIO-01 WEB — Conteúdo e Frequência (falta + conteúdo + anexos).
 *
 * Escopo: turma M3A26, disciplina História, aluna Ana Carolina…
 * - Check → falta (X vermelho)
 * - Conteúdo: "Conteudo teste (Web)" / Tarefa: "Tarefa teste (Web)"
 * - Anexar PDF_TESTE.pdf + Video_teste.mp4 (maestro/fixtures)
 *
 *   npx playwright test diario/02-conteudo-frequencia.spec.ts --workers=1
 */
import { test } from "@playwright/test";
import path from "node:path";
import { openComunicadosSession } from "../shared/comunicados-session";
import { lancarConteudoEFrequencia } from "../shared/diario-composer";

const ROOT = path.join(__dirname, "..");

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ timeout: 420_000 });

test("CT-DIARIO-01 WEB: falta + conteúdo + PDF + vídeo", async () => {
  const log = "[ct-diario-01-web]";
  const { context, page } = await openComunicadosSession(ROOT, log, {
    perfil: "PROFESSORES",
  });
  try {
    await lancarConteudoEFrequencia(page, ROOT, "Web");
    console.log(`${log} ok`);
  } finally {
    await context.close().catch(() => undefined);
  }
});
