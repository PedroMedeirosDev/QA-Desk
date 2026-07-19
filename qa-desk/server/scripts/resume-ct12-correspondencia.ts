/**
 * Retoma CT-12 a partir do dialog de correspondência.
 * Uso: npx tsx server/scripts/resume-ct12-correspondencia.ts
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

const RESUME =
  "projects/polygonus/automation/maestro/flows/debug/resume_ct12_correspondencia_confirm.yaml";

console.log("[resume-ct12] Fase 1 restante — confirmar IR → Enviadas…");
const phase1 = await runMaestroFlow(RESUME, {
  onOutput: (c) => process.stdout.write(c),
  reinstallDriver: true,
});
if (!phase1.ok) {
  console.error("\n--- CT-12 resume: FALHOU na fase 1 ---\n");
  if (phase1.failure) console.error(JSON.stringify(phase1.failure, null, 2));
  process.exit(phase1.exitCode ?? 1);
}

console.log("[resume-ct12] Fase 2/3 — capturando ID (adb)…");
let id: string | null = null;
for (let i = 0; i < 4 && !id; i++) {
  try {
    id = captureMuralCardId(0);
  } catch (e) {
    console.warn(`[resume-ct12] adb tentativa ${i + 1}:`, e);
  }
  if (!id) await new Promise((r) => setTimeout(r, 2500));
}
if (!id) {
  console.error("[resume-ct12] ID ausente");
  process.exit(1);
}
const idDigits = id.replace(/[^0-9]/g, "");
console.log(`[resume-ct12] ID capturado: ${id}`);

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
    `\n--- CT-12 resume: ${phase3.ok ? "OK" : "FALHOU"} (exit ${phase3.exitCode}) ---\n`,
  );
  if (!phase3.ok && phase3.failure) {
    console.error(JSON.stringify(phase3.failure, null, 2));
  }
  process.exit(phase3.ok ? 0 : (phase3.exitCode ?? 1));
} finally {
  clearMuralRunEnv();
}
