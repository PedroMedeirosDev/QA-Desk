/**
 * Atualiza o bucket `evidence` no Supabase Storage (vídeo + 50 MB).
 * Uso (em qa-desk/): node --env-file=.env supabase/apply-evidence-video.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const allowedMimeTypes = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  "video/3gpp",
];

const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { error } = await client.storage.updateBucket("evidence", {
  fileSizeLimit: 50 * 1024 * 1024,
  allowedMimeTypes,
});
if (error) {
  console.error(error.message);
  process.exit(1);
}

const { data, error: getErr } = await client.storage.getBucket("evidence");
if (getErr) {
  console.error(getErr.message);
  process.exit(1);
}
console.log("evidence bucket ok:", {
  file_size_limit: data.file_size_limit,
  allowed_mime_types: data.allowed_mime_types,
});
