/**
 * Fecha CT-13: evento já em Enviadas — assert por texto (sem ID).
 * Uso: npx tsx server/scripts/resume-ct13-evento-text.ts
 */
import { loadEnv } from "../load-env.js";
import {
  runMaestroFlow,
  writeGeneratedPostSendTextVerifyFlow,
} from "../automation.js";

loadEnv();

const PREP =
  "projects/polygonus/automation/maestro/flows/shared/mural/prep_lista_enviadas.yaml";

console.log("[resume-ct13] prep Enviadas…");
const prep = await runMaestroFlow(PREP, {
  onOutput: (c) => process.stdout.write(c),
  reinstallDriver: true,
});
if (!prep.ok) {
  console.error("\n--- CT-13 resume: FALHOU no prep ---\n");
  process.exit(prep.exitCode ?? 1);
}

const generated = writeGeneratedPostSendTextVerifyFlow("Evento Dia Inteiro", {
  verifyResponsavel: false,
  skipIdCapture: true,
  assertText: "Evento Dia Inteiro",
});
console.log(`[resume-ct13] assert texto → ${generated}`);
const phase3 = await runMaestroFlow(generated, {
  onOutput: (c) => process.stdout.write(c),
  reinstallDriver: false,
});
console.log(
  `\n--- CT-13 resume: ${phase3.ok ? "OK" : "FALHOU"} (exit ${phase3.exitCode}) ---\n`,
);
if (!phase3.ok && phase3.failure) {
  console.error(JSON.stringify(phase3.failure, null, 2));
}
process.exit(phase3.ok ? 0 : (phase3.exitCode ?? 1));
