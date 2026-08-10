import { Router } from "express";
import multer from "multer";
import path from "node:path";
import {
  attachUser,
  getServiceClient,
  rejectVisitorMutations,
  requireAdmin,
} from "../middleware/auth.js";
import { publicAvatarUrl, uploadAvatarBuffer } from "../supabase-storage.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(png|jpe?g|webp)$/i.test(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error("Apenas PNG, JPG ou WebP"));
  },
});

export const meRouter = Router();

meRouter.use(attachUser);
meRouter.use(rejectVisitorMutations);

/** Perfil atual (inclui avatar_path / URL pública). */
meRouter.get("/", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Não autenticado" });

  const db = getServiceClient();
  let avatarPath: string | null = null;
  if (db) {
    const { data } = await db
      .from("profiles")
      .select("avatar_path")
      .eq("id", req.user.id)
      .maybeSingle();
    avatarPath = (data?.avatar_path as string | null) ?? null;
  }

  res.json({
    id: req.user.id,
    email: req.user.email,
    displayName: req.user.displayName,
    role: req.user.role,
    actor: req.user.actor,
    avatarPath,
    avatarUrl: avatarPath ? publicAvatarUrl(avatarPath) : null,
  });
});

/**
 * Admin: sobe foto para bucket `avatars` e grava profiles.avatar_path.
 */
meRouter.put("/avatar", requireAdmin, upload.single("file"), async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Não autenticado" });
  if (!req.file?.buffer) return res.status(400).json({ error: "Arquivo obrigatório" });

  const ext = path.extname(req.file.originalname) || ".jpg";
  let avatarPath: string;
  try {
    avatarPath = await uploadAvatarBuffer({
      userId: req.user.id,
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      ext,
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return res.status(status).json({
      error: err instanceof Error ? err.message : "Falha no upload",
    });
  }

  const db = getServiceClient();
  if (!db) {
    return res.status(503).json({ error: "Supabase service role não configurado" });
  }

  const { error } = await db
    .from("profiles")
    .update({ avatar_path: avatarPath, updated_at: new Date().toISOString() })
    .eq("id", req.user.id);

  if (error) {
    return res.status(502).json({ error: `Falha ao atualizar perfil: ${error.message}` });
  }

  res.json({
    avatarPath,
    avatarUrl: publicAvatarUrl(avatarPath),
  });
});
