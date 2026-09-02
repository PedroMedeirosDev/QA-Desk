import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { attachUser, isVisitor, rejectVisitorMutations } from "../middleware/auth.js";
import { assertProject } from "../storage.js";
import {
  buildEvidenceStorageKey,
  downloadEvidenceBytes,
  isLocalUploadsKey,
  localEvidenceAbsPath,
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

function mimeFromName(name: string): string | undefined {
  const ext = path.extname(name).toLowerCase();
  const map: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska",
  };
  return map[ext];
}

/**
 * Serve evidências sob /api/evidence/*
 * Path: `{project}/{testId}/{file}` (legado disco ou Storage).
 * Sempre faz proxy dos bytes (sem redirect ao Storage) para <img>/<video>/fetch
 * funcionarem no mesmo origin — inclusive no export do relatório HTML.
 * Visitante: nenhum byte de print/vídeo (tela do produto).
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
    return res.status(404).json({ error: "Arquivo não encontrado" });
  }

  const sendLocal = (absPath: string) => {
    const mime = mimeFromName(absPath);
    if (mime) res.type(mime);
    return res.sendFile(absPath);
  };

  // 1) Disco legado
  const localKey = `uploads/${relRaw}`;
  const absLocal = localEvidenceAbsPath(localKey);
  if (absLocal && fs.existsSync(absLocal) && fs.statSync(absLocal).isFile()) {
    return sendLocal(absLocal);
  }

  const abs = path.resolve(UPLOADS_ROOT, relRaw);
  if (
    (abs.startsWith(UPLOADS_ROOT + path.sep) || abs === UPLOADS_ROOT) &&
    fs.existsSync(abs) &&
    fs.statSync(abs).isFile()
  ) {
    return sendLocal(abs);
  }

  // 2) Supabase Storage — proxy (não redirect; evita CORS no fetch do relatório)
  if (segments.length < 3) {
    return res.status(404).json({ error: "Arquivo não encontrado" });
  }

  const storageKey = buildEvidenceStorageKey(
    project,
    testId,
    segments.slice(2).join("/"),
  );
  const hit =
    (await downloadEvidenceBytes(storageKey)) ??
    (!isLocalUploadsKey(relRaw)
      ? await downloadEvidenceBytes(`evidence/${relRaw}`)
      : null);

  if (!hit) {
    return res.status(404).json({ error: "Arquivo não encontrado" });
  }

  const mime = hit.mimeType || mimeFromName(relRaw) || "application/octet-stream";
  res.setHeader("Content-Type", mime);
  res.setHeader("Cache-Control", "private, max-age=300");
  return res.send(hit.buffer);
});
