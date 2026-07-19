/**
 * Roda um ou mais CTs Mural via runMaestroFlow (sem HTTP).
 *
 * Aceita:
 *   - IDs de domínio: CRUD-01, ANEXO-02, BOLETO-01, E2E-99…
 *   - números legados: 01, 04, 11, 99…
 *
 * Uso:
 *   npx tsx server/scripts/run-ct-mural.ts ANEXO-02 BOLETO-01
 *   npx tsx server/scripts/run-ct-mural.ts 06 11
 */
import { loadEnv } from "../load-env.js";
import {
  MURAL_HOMOLOGATION_ITEMS,
  needsMuralIdPipeline,
  runMaestroFlow,
  runMaestroFlowWithMuralCardId,
} from "../automation.js";
import {
  dismissAndroidSystemOverlays,
  ensureEmulatorTimezoneBr,
  ensureMaestroFixturesOnDevice,
  ensureAndroidDeviceReady,
} from "../android-device.js";

loadEnv();

async function prepDeviceForCt(label: string) {
  const log = (m: string) => console.log(`[qa-desk] ${m}`);
  await ensureAndroidDeviceReady({ onProgress: log });
  await ensureEmulatorTimezoneBr({ onProgress: log });
  await ensureMaestroFixturesOnDevice({ onProgress: log });
  await dismissAndroidSystemOverlays({ onProgress: log });
  log(`Prep OK antes de ${label}`);
}

function resolveFlow(raw: string): { key: string; flow: string } | null {
  const token = raw.trim().replace(/^ct-?/i, "");
  const upper = token.toUpperCase();

  const byCtId = MURAL_HOMOLOGATION_ITEMS.find((i) => i.ctId === upper);
  if (byCtId) return { key: byCtId.ctId, flow: byCtId.flowPath };

  const legacy = token.replace(/^0+/, "").padStart(2, "0");
  const byLegacy = MURAL_HOMOLOGATION_ITEMS.find((i) => i.legacyNum === legacy);
  if (byLegacy) return { key: byLegacy.ctId, flow: byLegacy.flowPath };

  return null;
}

const args = process.argv.slice(2);
if (!args.length) {
  console.error("Uso: npx tsx server/scripts/run-ct-mural.ts ANEXO-02 11 CRUD-01");
  console.error("\nCTs disponíveis:");
  for (const item of MURAL_HOMOLOGATION_ITEMS) {
    console.error(`  ${item.ctId.padEnd(12)} (legado ${item.legacyNum})  ${item.title}`);
  }
  process.exit(2);
}

let failed = 0;
for (const raw of args) {
  const resolved = resolveFlow(raw);
  if (!resolved) {
    console.error(`CT desconhecido: ${raw}`);
    failed++;
    continue;
  }
  const { key, flow } = resolved;
  console.log(`\n========== ${key} → ${flow} ==========\n`);
  await prepDeviceForCt(key);
  const run = needsMuralIdPipeline(flow)
    ? runMaestroFlowWithMuralCardId
    : runMaestroFlow;
  const result = await run(flow, {
    onOutput: (chunk) => process.stdout.write(chunk),
  });
  console.log(
    `\n--- ${key}: ${result.ok ? "OK" : "FALHOU"} (exit ${result.exitCode})${result.cancelled ? " · cancelado" : ""} ---\n`,
  );
  if (!result.ok) {
    failed++;
    if (result.failure) console.log(JSON.stringify(result.failure, null, 2));
  }
}

process.exit(failed > 0 ? 1 : 0);
