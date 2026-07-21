import { MURAL_HOMOLOGATION_ITEMS } from "../server/automation.ts";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "data/projects/polygonus/tests.json");
const catalog = JSON.parse(fs.readFileSync(file, "utf8"));
const byFlow = new Map(MURAL_HOMOLOGATION_ITEMS.map((i) => [i.flowPath, i]));

let n = 0;
for (const r of catalog.reports) {
  const item = r.automation?.flowPath ? byFlow.get(r.automation.flowPath) : undefined;
  if (!item) continue;
  r.description = item.description;
  r.steps = item.steps;
  if (item.prep) {
    r.automation = {
      type: "maestro",
      flowPath: item.flowPath,
      label: item.ctId,
      readiness: r.automation?.readiness ?? "draft",
      ...r.automation,
      prep: item.prep,
    };
  }
  n += 1;
}

catalog.meta.updatedAt = new Date().toISOString().slice(0, 10);
fs.writeFileSync(file, JSON.stringify(catalog, null, 2) + "\n");
console.log(`Updated ${n} tests with human-readable steps`);
