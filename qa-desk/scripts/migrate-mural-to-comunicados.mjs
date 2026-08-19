/**
 * Migra module "Mural" → "Comunicados" (aba) em tests.json + Postgres.
 * Não altera Rotina. Mantém tag "mural" (área) e testKey mural/*.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "data/projects/polygonus/tests.json");

function migratePayload(raw) {
  const p = { ...(raw || {}) };
  let changed = false;

  if (p.module === "Mural") {
    p.module = "Comunicados";
    changed = true;
  }

  if (Array.isArray(p.tags)) {
    const next = p.tags.map((t) =>
      t === "module:Mural" ? "module:Comunicados" : t,
    );
    if (next.join("\0") !== p.tags.join("\0")) {
      p.tags = next;
      changed = true;
    }
  }

  return { payload: p, changed };
}

const catalog = JSON.parse(fs.readFileSync(file, "utf8"));
let jsonUpdated = 0;
for (const r of catalog.reports ?? []) {
  const { payload, changed } = migratePayload(r);
  if (!changed) continue;
  Object.assign(r, payload);
  jsonUpdated += 1;
}
catalog.meta.updatedAt = new Date().toISOString().slice(0, 10);
fs.writeFileSync(file, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`tests.json: ${jsonUpdated} report(s)`);

const prisma = new PrismaClient();
try {
  const rows = await prisma.test.findMany({
    where: { projectSlug: "polygonus" },
    select: { id: true, payload: true },
  });
  let dbUpdated = 0;
  for (const row of rows) {
    const { payload, changed } = migratePayload(row.payload);
    if (!changed) continue;
    await prisma.test.update({
      where: { id: row.id },
      data: { payload },
    });
    dbUpdated += 1;
  }
  console.log(`postgres: ${dbUpdated} row(s)`);
} finally {
  await prisma.$disconnect();
}
