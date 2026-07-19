/**
 * Dump hierarquia Enviadas e mostra como o ID aparece em cada card.
 * Uso: npx tsx server/scripts/inspect-mural-ids.ts
 */
import { loadEnv } from "../load-env.js";
import { runMaestroFlow } from "../automation.js";
import { execFileSync } from "node:child_process";

loadEnv();

const PREP =
  "projects/polygonus/automation/maestro/flows/shared/mural/prep_lista_enviadas.yaml";

console.log("[inspect] prep Enviadas…");
const prep = await runMaestroFlow(PREP, {
  onOutput: (c) => process.stdout.write(c),
  reinstallDriver: true,
});
if (!prep.ok) {
  console.error("prep falhou", prep.failure);
  process.exit(1);
}

const adb =
  process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT
    ? `${process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT}\\platform-tools\\adb.exe`
    : "adb.exe";

execFileSync(adb, ["shell", "uiautomator", "dump", "/sdcard/uidump_inspect.xml"], {
  encoding: "utf8",
});
const xml = execFileSync(adb, ["shell", "cat", "/sdcard/uidump_inspect.xml"], {
  encoding: "utf8",
  maxBuffer: 8 * 1024 * 1024,
});

console.log("\n===== mural_card_menu nodes =====\n");
const cardRe =
  /<node\b[^>]*resource-id="mural_card_menu"[^>]*>/g;
let m: RegExpExecArray | null;
let i = 0;
while ((m = cardRe.exec(xml))) {
  const tag = m[0];
  const text = (tag.match(/text="([^"]*)"/) || [])[1] ?? "";
  const desc = (tag.match(/content-desc="([^"]*)"/) || [])[1] ?? "";
  console.log(`#${i}`);
  console.log(`  text=${JSON.stringify(text)}`);
  console.log(`  content-desc=${JSON.stringify(desc.replace(/&#10;/g, "\\n"))}`);
  i++;
}

console.log("\n===== qualquer text/content-desc com ID =====\n");
const idHits = [
  ...xml.matchAll(/text="([^"]*ID[^"]*)"/g),
  ...xml.matchAll(/content-desc="([^"]*ID[^"]*)"/g),
];
for (const h of idHits) {
  console.log(h[1].replace(/&#10;/g, " | "));
}

console.log(`\nTotal mural_card_menu: ${i}, hits ID: ${idHits.length}`);
