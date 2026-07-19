/**
 * Roda CT-03 (excluir) pelo pipeline ID da qa-desk — sem HTTP/Postgres.
 * Uso: npx tsx server/scripts/run-ct03-excluir.ts
 */
import { loadEnv } from "../load-env.js";
import { runMaestroFlowWithMuralCardId } from "../automation.js";

loadEnv();

const FLOW =
  "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_excluir.yaml";

const result = await runMaestroFlowWithMuralCardId(FLOW, {
  onOutput: (chunk) => process.stdout.write(chunk),
});

console.log("\n---");
console.log(
  result.ok
    ? `CT-03 OK (exit ${result.exitCode})`
    : `CT-03 FALHOU (exit ${result.exitCode})${result.cancelled ? " · cancelado" : ""}`,
);
if (result.failure) {
  console.log("failure:", JSON.stringify(result.failure, null, 2));
}
process.exit(result.ok ? 0 : 1);
