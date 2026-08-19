/**
 * Sync Mural CT titles / testKeys / suite tags from MURAL_HOMOLOGATION_ITEMS → tests.json
 * Matching by automation.flowPath (legacy YAML path).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MURAL_HOMOLOGATION_ITEMS,
  muralDomainTestKey,
} from "../server/automation.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "data/projects/polygonus/tests.json");
const catalog = JSON.parse(fs.readFileSync(file, "utf8"));

const byFlow = new Map(
  MURAL_HOMOLOGATION_ITEMS.map((i) => [i.flowPath.replace(/\\/g, "/"), i]),
);

let updated = 0;
let missing: string[] = [];

for (const item of MURAL_HOMOLOGATION_ITEMS) {
  const hit = catalog.reports.find(
    (r: { automation?: { flowPath?: string } }) =>
      r.automation?.flowPath?.replace(/\\/g, "/") === item.flowPath,
  );
  if (!hit) {
    missing.push(item.ctId);
    continue;
  }

  const domainKey = muralDomainTestKey(item.ctId);
  hit.title = item.title;
  hit.description = item.description;
  hit.preconditions = item.preconditions;
  hit.expectedResult = item.expectedResult;
  hit.steps = item.steps;
  hit.testKey = domainKey;
  hit.module = "Comunicados";
  if (hit.automation) {
    hit.automation.label = item.ctId;
  }

  const tags = new Set<string>(Array.isArray(hit.tags) ? hit.tags : []);
  tags.add("homologacao");
  tags.add("mural");
  tags.add("mural-backend-homologacao");
  tags.add("module:Comunicados");
  tags.add(`suite:${item.suite}`);
  tags.add(`ct:${item.ctId}`);
  // drop stale suite:/ct: tags
  hit.tags = [...tags].filter((t) => {
    if (t.startsWith("suite:") && t !== `suite:${item.suite}`) return false;
    if (t.startsWith("ct:") && t !== `ct:${item.ctId}`) return false;
    if (t === "module:Mural") return false;
    return true;
  });

  updated += 1;
  console.log(`✓ ${item.ctId} ← ${domainKey} · ${item.title}`);
}

catalog.meta.updatedAt = new Date().toISOString().slice(0, 10);
fs.writeFileSync(file, JSON.stringify(catalog, null, 2) + "\n");

console.log(`\nUpdated ${updated} report(s).`);
if (missing.length) {
  console.log(
    `Not in tests.json yet (${missing.length}): ${missing.join(", ")}`,
  );
}
