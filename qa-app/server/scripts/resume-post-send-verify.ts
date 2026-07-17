/**
 * Continua só a fase 3 (assert ID + responsável) com ID já na lista.
 * Se não estiver em Enviadas, roda prep antes.
 *
 * Uso: npx tsx server/scripts/resume-post-send-verify.ts [idDigits] [--share] [--no-resp] [--no-prep]
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

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const share = process.argv.includes("--share");
const noResp = process.argv.includes("--no-resp");
const noPrep = process.argv.includes("--no-prep");

const PREP =
  "projects/polygonus/automation/maestro/flows/shared/mural/prep_lista_enviadas.yaml";

if (!noPrep) {
  console.log("[resume-verify] prep Enviadas…");
  const prep = await runMaestroFlow(PREP, {
    onOutput: (c) => process.stdout.write(c),
    reinstallDriver: true,
  });
  if (!prep.ok) {
    console.error("\n--- resume-verify: FALHOU no prep ---\n");
    process.exit(prep.exitCode ?? 1);
  }
}

let idDigits = args[0]?.replace(/\D/g, "") || "";
if (!idDigits) {
  console.log("[resume-verify] capturando ID topo (adb)…");
  const id = captureMuralCardId(0);
  if (!id) {
    console.error("[resume-verify] ID ausente");
    process.exit(1);
  }
  idDigits = id.replace(/[^0-9]/g, "");
  console.log(`[resume-verify] ${id}`);
}

const generated = writeGeneratedPostSendVerifyFlow(idDigits, {
  verifyResponsavel: !noResp,
  compartilharAnexos: share,
});
writeMuralRunEnv(idDigits);
console.log(`[resume-verify] fase 3 → ${generated}`);
try {
  const phase3 = await runMaestroFlow(generated, {
    onOutput: (c) => process.stdout.write(c),
    extraEnv: { ID_COMUNICADO: idDigits },
    reinstallDriver: false,
  });
  console.log(
    `\n--- resume-verify: ${phase3.ok ? "OK" : "FALHOU"} (exit ${phase3.exitCode}) ---\n`,
  );
  if (!phase3.ok && phase3.failure) {
    console.error(JSON.stringify(phase3.failure, null, 2));
  }
  process.exit(phase3.ok ? 0 : (phase3.exitCode ?? 1));
} finally {
  clearMuralRunEnv();
}
