/**
 * Retoma CT-06 sem re-login.
 * Uso:
 *   npx tsx server/scripts/resume-ct06-pdf.ts
 *   npx tsx server/scripts/resume-ct06-pdf.ts picker   # DocumentsUI já aberto
 *   npx tsx server/scripts/resume-ct06-pdf.ts composer # composer aberto
 */
import { loadEnv } from "../load-env.js";
import {
  clearMuralRunEnv,
  runMaestroFlow,
  writeGeneratedPostSendVerifyFlow,
  writeMuralRunEnv,
} from "../automation.js";
import { captureMuralCardId } from "../mural-card-id.js";

loadEnv();

const mode = (process.argv[2] || "picker").toLowerCase();
const RESUME =
  mode === "composer"
    ? "projects/polygonus/automation/maestro/flows/debug/resume_ct06_pdf_from_composer.yaml"
    : "projects/polygonus/automation/maestro/flows/debug/resume_ct06_pdf_from_picker.yaml";

console.log(`[resume-ct06] mode=${mode} → ${RESUME}`);
console.log("[resume-ct06] Fase 1 restante — até Enviadas…");
const phase1 = await runMaestroFlow(RESUME, {
  onOutput: (c) => process.stdout.write(c),
  reinstallDriver: true,
  // Literal — ${FIXTURE_PDF} no YAML aninhado às vezes vira undefined (espaço + .env).
  extraEnv: {
    ANEXO_NOME: "PDF TESTE.pdf",
    ANEXO_PASTA: "Download",
    FIXTURE_PDF: "PDF TESTE.pdf",
  },
});
if (!phase1.ok) {
  console.error("\n--- CT-06 resume: FALHOU na fase 1 ---\n");
  if (phase1.failure) console.error(JSON.stringify(phase1.failure, null, 2));
  process.exit(phase1.exitCode ?? 1);
}

console.log("[resume-ct06] Fase 2/3 — capturando ID (adb)…");
let id: string | null = null;
try {
  id = captureMuralCardId(0);
} catch (e) {
  console.error("[resume-ct06] adb falhou:", e);
  process.exit(1);
}
if (!id) {
  console.error("[resume-ct06] ID ausente no topo de Enviadas");
  process.exit(1);
}
const idDigits = id.replace(/[^0-9]/g, "");
console.log(`[resume-ct06] ID capturado: ${id}`);

const generated = writeGeneratedPostSendVerifyFlow(idDigits, {
  verifyResponsavel: true,
});
writeMuralRunEnv(idDigits);
console.log("[resume-ct06] Fase 3/3 — assert por ID + responsável…");
try {
  const phase3 = await runMaestroFlow(generated, {
    onOutput: (c) => process.stdout.write(c),
    extraEnv: { ID_COMUNICADO: idDigits },
    reinstallDriver: false,
  });
  console.log(
    `\n--- CT-06 resume: ${phase3.ok ? "OK" : "FALHOU"} (exit ${phase3.exitCode}) ---\n`,
  );
  if (!phase3.ok && phase3.failure) {
    console.error(JSON.stringify(phase3.failure, null, 2));
  }
  process.exit(phase3.ok ? 0 : (phase3.exitCode ?? 1));
} finally {
  clearMuralRunEnv();
}
