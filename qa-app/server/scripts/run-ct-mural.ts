/**
 * Roda um ou mais CTs Mural via runMaestroFlow (sem HTTP).
 * Uso: npx tsx server/scripts/run-ct-mural.ts 04 05
 */
import { loadEnv } from "../load-env.js";
import { needsMuralIdPipeline, runMaestroFlow, runMaestroFlowWithMuralCardId } from "../automation.js";

loadEnv();

const FLOWS: Record<string, string> = {
  "01": "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_enviar.yaml",
  "02": "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_editar.yaml",
  "03": "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_excluir.yaml",
  "04": "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_enquete.yaml",
  "05": "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_foto_galeria.yaml",
  "06": "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_pdf.yaml",
  "07": "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_video_pequeno.yaml",
  "08": "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_evento.yaml",
  "09": "projects/polygonus/automation/maestro/flows/mural/01_1_filtro_enviadas.yaml",
  "11": "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_boleto.yaml",
  "12": "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_correspondencia_ir.yaml",
  "13": "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_evento_dia_inteiro.yaml",
  "14": "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_boleto_competencia.yaml",
  "99": "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_completo_e2e.yaml",
};

const ids = process.argv.slice(2).map((s) => s.replace(/^ct-?0?/i, "").padStart(2, "0"));
if (!ids.length) {
  console.error("Uso: npx tsx server/scripts/run-ct-mural.ts 04 05");
  process.exit(2);
}

let failed = 0;
for (const id of ids) {
  const flow = FLOWS[id];
  if (!flow) {
    console.error(`CT desconhecido: ${id}`);
    failed++;
    continue;
  }
  console.log(`\n========== CT-${id} → ${flow} ==========\n`);
  const run = needsMuralIdPipeline(flow)
    ? runMaestroFlowWithMuralCardId
    : runMaestroFlow;
  const result = await run(flow, {
    onOutput: (chunk) => process.stdout.write(chunk),
  });
  console.log(
    `\n--- CT-${id}: ${result.ok ? "OK" : "FALHOU"} (exit ${result.exitCode})${result.cancelled ? " · cancelado" : ""} ---\n`,
  );
  if (!result.ok) {
    failed++;
    if (result.failure) console.log(JSON.stringify(result.failure, null, 2));
  }
}

process.exit(failed > 0 ? 1 : 0);
