import {
  computeKbCurationMetrics,
  readKbCurationCatalog,
} from "../kb-curation.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, "../../data/projects/polygonus/kb-curation.json");

const catalog = await readKbCurationCatalog("polygonus");
const metrics = computeKbCurationMetrics(catalog.pullRequests);
const open = catalog.pullRequests.filter((r) => r.githubState === "open").length;

fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      written: file,
      total: catalog.pullRequests.length,
      open,
      metrics,
    },
    null,
    2,
  ),
);
