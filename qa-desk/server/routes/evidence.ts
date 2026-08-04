import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { attachUser, isVisitor, rejectVisitorMutations } from "../middleware/auth.js";
import { assertProject, readCatalog } from "../storage.js";
import type { ProjectSlug } from "../types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.resolve(path.join(__dirname, "../../data/uploads"));

export const evidenceRouter = Router();

evidenceRouter.use(attachUser);
evidenceRouter.use(rejectVisitorMutations);

function relativeEvidencePath(reqPath: string): string {
  return reqPath.replace(/^\/+/, "").replace(/\\/g, "/");
}

/**
 * Serve evidências sob /api/evidence/*
 * Visitante: só arquivos sob CT com showInPortfolio === true (filtro no backend).
 */
evidenceRouter.get("/{*path}", async (req, res) => {
  const raw = req.params.path;
  const relRaw = relativeEvidencePath(
    Array.isArray(raw) ? raw.join("/") : String(raw ?? ""),
  );
  if (!relRaw || relRaw.includes("..")) {
    return res.status(400).json({ error: "Caminho inválido" });
  }

  const segments = relRaw.split("/").filter(Boolean);
  if (segments.length < 2) {
    return res.status(404).json({ error: "Arquivo não encontrado" });
  }

  let project: ProjectSlug;
  try {
    project = assertProject(segments[0]);
  } catch {
    return res.status(404).json({ error: "Arquivo não encontrado" });
  }
  const testId = segments[1];

  if (isVisitor(req)) {
    const catalog = await readCatalog(project);
    const test = catalog.reports.find((r) => r.id === testId);
    if (!test?.showInPortfolio) {
      return res.status(404).json({ error: "Arquivo não encontrado" });
    }
    if (!relRaw.startsWith(`${project}/${testId}/`)) {
      return res.status(404).json({ error: "Arquivo não encontrado" });
    }
  }

  const abs = path.resolve(UPLOADS_ROOT, relRaw);
  if (!abs.startsWith(UPLOADS_ROOT + path.sep) && abs !== UPLOADS_ROOT) {
    return res.status(400).json({ error: "Caminho inválido" });
  }
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    return res.status(404).json({ error: "Arquivo não encontrado" });
  }

  res.sendFile(abs);
});
