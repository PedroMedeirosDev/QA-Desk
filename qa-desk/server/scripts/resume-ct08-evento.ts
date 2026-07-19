/**
 * Retoma CT-08 a partir do composer Novo evento.
 * Uso: npx tsx server/scripts/resume-ct08-evento.ts
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

const mode = (process.argv[2] || "send").toLowerCase();
const RESUME =
  mode === "composer"
    ? "projects/polygonus/automation/maestro/flows/debug/resume_ct08_evento_from_composer.yaml"
    : "projects/polygonus/automation/maestro/flows/debug/resume_ct08_evento_send_only.yaml";

console.log(`[resume-ct08] mode=${mode} → ${RESUME}`);
console.log("[resume-ct08] Fase 1 restante — até Enviadas…");
const phase1 = await runMaestroFlow(RESUME, {
  onOutput: (c) => process.stdout.write(c),
  reinstallDriver: true,
});
if (!phase1.ok) {
  console.error("\n--- CT-08 resume: FALHOU na fase 1 ---\n");
  if (phase1.failure) console.error(JSON.stringify(phase1.failure, null, 2));
  process.exit(phase1.exitCode ?? 1);
}

console.log("[resume-ct08] Fase 2/3 — capturando ID (adb)…");
// Vídeo/anexo: lista às vezes atrasa — refresh + retry
let id: string | null = null;
for (let i = 0; i < 4 && !id; i++) {
  try {
    id = captureMuralCardId(0);
  } catch (e) {
    console.warn(`[resume-ct08] adb tentativa ${i + 1}:`, e);
  }
  if (!id) {
    await new Promise((r) => setTimeout(r, 3000));
  }
}
if (!id) {
  console.error("[resume-ct08] ID ausente no topo de Enviadas");
  process.exit(1);
}
const idDigits = id.replace(/[^0-9]/g, "");
console.log(`[resume-ct08] ID capturado: ${id}`);

const generated = writeGeneratedPostSendVerifyFlow(idDigits, {
  verifyResponsavel: true,
});
writeMuralRunEnv(idDigits);
try {
  const phase3 = await runMaestroFlow(generated, {
    onOutput: (c) => process.stdout.write(c),
    extraEnv: { ID_COMUNICADO: idDigits },
    reinstallDriver: false,
  });
  console.log(
    `\n--- CT-08 resume: ${phase3.ok ? "OK" : "FALHOU"} (exit ${phase3.exitCode}) ---\n`,
  );
  if (!phase3.ok && phase3.failure) {
    console.error(JSON.stringify(phase3.failure, null, 2));
  }
  process.exit(phase3.ok ? 0 : (phase3.exitCode ?? 1));
} finally {
  clearMuralRunEnv();
}
