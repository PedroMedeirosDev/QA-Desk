/**
 * Uma vez: aplica o sequencial por tipo (D-001…, S-001…) aos registros antigos.
 *   npx tsx scripts/renumerar-demandas.ts            → só mostra
 *   npx tsx scripts/renumerar-demandas.ts --aplicar  → grava
 */
import "dotenv/config";
import { renumerarPorTipo } from "../server/demandas.js";

const aplicar = process.argv.includes("--aplicar");
const mudancas = await renumerarPorTipo("polygonus", "renumeracao", !aplicar);
if (!mudancas.length) console.log("Nada a renumerar.");
for (const m of mudancas) console.log(`${m.de} → ${m.para}  ${m.titulo.slice(0, 70)}`);
console.log(aplicar ? "Gravado." : "Simulação: rode com --aplicar para gravar.");
process.exit(0);
