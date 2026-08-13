/**
 * Supabase Storage — evidence (privado) + avatars (público).
 * Requer SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY; senão fallback disco local.
 */
import fs from "node:fs";
import path from "node:path";
import { getServiceClient } from "./middleware/auth.js";
import { UPLOADS_ROOT } from "./storage.js";
import type { ProjectSlug } from "./types.js";

export const EVIDENCE_BUCKET = "evidence";
export const AVATARS_BUCKET = "avatars";

/** Prefixo gravado em EvidenceFile.storageKey quando o arquivo está no Storage. */
export const EVIDENCE_KEY_PREFIX = "evidence/";
/** Prefixo legado (disco em data/uploads). */
export const LOCAL_UPLOADS_KEY_PREFIX = "uploads/";

const SIGNED_URL_TTL_SEC = 60 * 15; // 15 min

export function isSupabaseStorageConfigured(): boolean {
  return Boolean(getServiceClient());
}

/** Path relativo dentro do bucket evidence: `{project}/{testId}/{file}` */
export function evidenceObjectPath(
  project: ProjectSlug,
  testId: string,
  filename: string,
): string {
  return `${project}/${testId}/${filename}`;
}

export function buildEvidenceStorageKey(
  project: ProjectSlug,
  testId: string,
  filename: string,
): string {
  return `${EVIDENCE_KEY_PREFIX}${evidenceObjectPath(project, testId, filename)}`;
}

/** Extrai path no bucket a partir do storageKey (`evidence/...` ou path nu). */
export function parseEvidenceObjectPath(storageKey: string): string | null {
  const key = storageKey.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!key || key.includes("..")) return null;
  if (key.startsWith(EVIDENCE_KEY_PREFIX)) {
    return key.slice(EVIDENCE_KEY_PREFIX.length) || null;
  }
  if (key.startsWith(LOCAL_UPLOADS_KEY_PREFIX)) return null;
  // URL /api/evidence/{project}/{id}/{file} — path sem prefixo de bucket
  const parts = key.split("/").filter(Boolean);
  if (parts.length >= 3) return key;
  return null;
}

export function isLocalUploadsKey(storageKey: string): boolean {
  return storageKey.replace(/\\/g, "/").startsWith(LOCAL_UPLOADS_KEY_PREFIX);
}

export function localEvidenceAbsPath(storageKey: string): string | null {
  const rel = storageKey
    .replace(/\\/g, "/")
    .replace(new RegExp(`^${LOCAL_UPLOADS_KEY_PREFIX}`), "");
  if (!rel || rel.includes("..")) return null;
  const abs = path.resolve(UPLOADS_ROOT, ...rel.split("/"));
  if (!abs.startsWith(UPLOADS_ROOT + path.sep) && abs !== UPLOADS_ROOT) return null;
  return abs;
}

function safeFilename(original: string, fallbackExt: string): string {
  const base = path.basename(original).replace(/[^\w.\-()+ ]+/g, "_").slice(0, 120);
  if (base && /\.\w+$/.test(base)) return base;
  return `${base || "file"}${fallbackExt}`;
}

export async function uploadEvidenceBuffer(opts: {
  project: ProjectSlug;
  testId: string;
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  storedFilename: string;
}): Promise<{ storageKey: string; backend: "supabase" | "local" }> {
  const objectPath = evidenceObjectPath(
    opts.project,
    opts.testId,
    opts.storedFilename,
  );
  const client = getServiceClient();

  if (client) {
    const { error } = await client.storage.from(EVIDENCE_BUCKET).upload(objectPath, opts.buffer, {
      contentType: opts.mimeType || "application/octet-stream",
      upsert: false,
    });
    if (error) {
      throw Object.assign(new Error(`Storage evidence upload: ${error.message}`), {
        status: 502,
      });
    }
    return {
      storageKey: buildEvidenceStorageKey(opts.project, opts.testId, opts.storedFilename),
      backend: "supabase",
    };
  }

  // Fallback disco
  const dir = path.join(UPLOADS_ROOT, opts.project, opts.testId);
  fs.mkdirSync(dir, { recursive: true });
  const abs = path.join(dir, opts.storedFilename);
  fs.writeFileSync(abs, opts.buffer);
  return {
    storageKey: `${LOCAL_UPLOADS_KEY_PREFIX}${opts.project}/${opts.testId}/${opts.storedFilename}`,
    backend: "local",
  };
}

export async function downloadEvidenceBytes(
  storageKey: string,
): Promise<{ buffer: Buffer; mimeType?: string } | null> {
  if (isLocalUploadsKey(storageKey) || !storageKey.startsWith(EVIDENCE_KEY_PREFIX)) {
    if (isLocalUploadsKey(storageKey)) {
      const abs = localEvidenceAbsPath(storageKey);
      if (!abs || !fs.existsSync(abs)) return null;
      return { buffer: fs.readFileSync(abs) };
    }
    // path sem prefixo: tentar disco legado sob uploads/
    const asLocal = localEvidenceAbsPath(`${LOCAL_UPLOADS_KEY_PREFIX}${storageKey}`);
    if (asLocal && fs.existsSync(asLocal)) {
      return { buffer: fs.readFileSync(asLocal) };
    }
  }

  const objectPath = parseEvidenceObjectPath(storageKey);
  if (!objectPath) return null;

  const client = getServiceClient();
  if (!client) {
    // sem service role: só disco
    const abs = localEvidenceAbsPath(`${LOCAL_UPLOADS_KEY_PREFIX}${objectPath}`);
    if (!abs || !fs.existsSync(abs)) return null;
    return { buffer: fs.readFileSync(abs) };
  }

  const { data, error } = await client.storage.from(EVIDENCE_BUCKET).download(objectPath);
  if (error || !data) return null;
  const ab = await data.arrayBuffer();
  return { buffer: Buffer.from(ab), mimeType: data.type || undefined };
}

export async function signedEvidenceUrl(storageKey: string): Promise<string | null> {
  const objectPath = parseEvidenceObjectPath(storageKey);
  if (!objectPath) return null;
  const client = getServiceClient();
  if (!client) return null;
  const { data, error } = await client.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrl(objectPath, SIGNED_URL_TTL_SEC);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Resolve bytes para Discord: Storage ou disco. */
export async function resolveEvidenceForAttach(
  storageKey: string,
): Promise<{ buffer: Buffer; size: number } | null> {
  const hit = await downloadEvidenceBytes(storageKey);
  if (!hit) return null;
  return { buffer: hit.buffer, size: hit.buffer.length };
}

export function publicAvatarUrl(avatarPath: string): string | null {
  const url = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  if (!url || !avatarPath.trim()) return null;
  const clean = avatarPath.replace(/^\/+/, "").replace(/\\/g, "/");
  if (!clean || clean.includes("..")) return null;
  return `${url.replace(/\/$/, "")}/storage/v1/object/public/${AVATARS_BUCKET}/${clean}`;
}

export async function uploadAvatarBuffer(opts: {
  userId: string;
  buffer: Buffer;
  mimeType: string;
  ext: string;
}): Promise<string> {
  const client = getServiceClient();
  if (!client) {
    throw Object.assign(
      new Error("SUPABASE_SERVICE_ROLE_KEY necessário para upload de avatar"),
      { status: 503 },
    );
  }
  const ext = opts.ext.startsWith(".") ? opts.ext : `.${opts.ext}`;
  const objectPath = `${opts.userId}/avatar${ext}`;
  const { error } = await client.storage.from(AVATARS_BUCKET).upload(objectPath, opts.buffer, {
    contentType: opts.mimeType,
    upsert: true,
  });
  if (error) {
    throw Object.assign(new Error(`Storage avatar upload: ${error.message}`), {
      status: 502,
    });
  }
  return objectPath;
}

export function makeStoredEvidenceFilename(originalName: string, id: string): string {
  const ext = path.extname(originalName) || ".png";
  const safe = safeFilename(originalName, ext);
  // Prefer uuid + ext to avoid collisions; keep short hint from original
  const hint = safe.replace(/\.[^.]+$/, "").slice(0, 40);
  return `${id}-${hint}${ext}`.replace(/--+/g, "-");
}

/** Best-effort: remove do Storage ou do disco. Falha não deve bloquear o catálogo. */
export async function deleteEvidenceObject(storageKey: string): Promise<void> {
  const client = getServiceClient();
  const objectPath = parseEvidenceObjectPath(storageKey);
  if (client && objectPath) {
    const { error } = await client.storage.from(EVIDENCE_BUCKET).remove([objectPath]);
    if (error) {
      console.warn("[evidence] falha ao apagar no Storage:", error.message);
    }
    return;
  }
  const abs = localEvidenceAbsPath(storageKey);
  if (abs && fs.existsSync(abs)) {
    fs.unlinkSync(abs);
  }
}
