/**
 * Retoma CT-07 a partir do picker (DocumentsUI).
 * Uso: npx tsx server/scripts/resume-ct07-video.ts
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

const mode = (process.argv[2] || "composer").toLowerCase();
const RESUME =
  mode === "picker"
    ? "projects/polygonus/automation/maestro/flows/debug/resume_ct07_video_from_picker.yaml"
    : "projects/polygonus/automation/maestro/flows/debug/resume_ct07_video_from_composer.yaml";

console.log(`[resume-ct07] mode=${mode} → ${RESUME}`);
console.log("[resume-ct07] Fase 1 restante — até Enviadas…");
const phase1 = await runMaestroFlow(RESUME, {
  onOutput: (c) => process.stdout.write(c),
  reinstallDriver: true,
  extraEnv: {
    ANEXO_NOME: "Video_teste.mp4",
    ANEXO_PASTA: "Download",
    FIXTURE_VIDEO: "Video_teste.mp4",
  },
});
if (!phase1.ok) {
  console.error("\n--- CT-07 resume: FALHOU na fase 1 ---\n");
  if (phase1.failure) console.error(JSON.stringify(phase1.failure, null, 2));
  process.exit(phase1.exitCode ?? 1);
}

console.log("[resume-ct07] Fase 2/3 — capturando ID (adb)…");
let id: string | null = null;
try {
  id = captureMuralCardId(0);
} catch (e) {
  console.error("[resume-ct07] adb falhou:", e);
  process.exit(1);
}
if (!id) {
  console.error("[resume-ct07] ID ausente no topo de Enviadas");
  process.exit(1);
}
const idDigits = id.replace(/[^0-9]/g, "");
console.log(`[resume-ct07] ID capturado: ${id}`);

const generated = writeGeneratedPostSendVerifyFlow(idDigits, {
  verifyResponsavel: true,
});
writeMuralRunEnv(idDigits);
console.log("[resume-ct07] Fase 3/3 — assert por ID + responsável…");
try {
  const phase3 = await runMaestroFlow(generated, {
    onOutput: (c) => process.stdout.write(c),
    extraEnv: { ID_COMUNICADO: idDigits },
    reinstallDriver: false,
  });
  console.log(
    `\n--- CT-07 resume: ${phase3.ok ? "OK" : "FALHOU"} (exit ${phase3.exitCode}) ---\n`,
  );
  if (!phase3.ok && phase3.failure) {
    console.error(JSON.stringify(phase3.failure, null, 2));
  }
  process.exit(phase3.ok ? 0 : (phase3.exitCode ?? 1));
} finally {
  clearMuralRunEnv();
}
