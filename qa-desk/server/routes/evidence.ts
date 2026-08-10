import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { attachUser, isVisitor, rejectVisitorMutations } from "../middleware/auth.js";
import { assertProject, readCatalog } from "../storage.js";
import {
  buildEvidenceStorageKey,
  isLocalUploadsKey,
  localEvidenceAbsPath,
  signedEvidenceUrl,
} from "../supabase-storage.js";
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
 * Path: `{project}/{testId}/{file}` (legado disco ou Storage).
 * Visitante: só arquivos sob CT com showInPortfolio === true.
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

  // 1) Disco legado
  const localKey = `uploads/${relRaw}`;
  const absLocal = localEvidenceAbsPath(localKey);
  if (absLocal && fs.existsSync(absLocal) && fs.statSync(absLocal).isFile()) {
    return res.sendFile(absLocal);
  }

  // Path absoluto antigo (mesmo root)
  const abs = path.resolve(UPLOADS_ROOT, relRaw);
  if (
    (abs.startsWith(UPLOADS_ROOT + path.sep) || abs === UPLOADS_ROOT) &&
    fs.existsSync(abs) &&
    fs.statSync(abs).isFile()
  ) {
    return res.sendFile(abs);
  }

  // 2) Supabase Storage (signed URL)
  const storageKey = buildEvidenceStorageKey(
    project,
    testId,
    segments.slice(2).join("/"),
  );
  if (segments.length < 3) {
    return res.status(404).json({ error: "Arquivo não encontrado" });
  }

  const signed = await signedEvidenceUrl(storageKey);
  if (signed) {
    return res.redirect(302, signed);
  }

  // Tentativa com storageKey “nu” (só object path)
  if (!isLocalUploadsKey(relRaw)) {
    const signed2 = await signedEvidenceUrl(`evidence/${relRaw}`);
    if (signed2) return res.redirect(302, signed2);
  }

  return res.status(404).json({ error: "Arquivo não encontrado" });
});
