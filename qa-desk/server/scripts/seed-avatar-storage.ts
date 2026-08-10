/**
 * One-shot: sobe src/assets/avatars/pedro.jpg para o bucket `avatars`
 * e atualiza profiles.avatar_path do admin (role = admin).
 *
 * Uso (com .env carregado):
 *   npx tsx server/scripts/seed-avatar-storage.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "../load-env.js";
import { getServiceClient } from "../middleware/auth.js";
import { AVATARS_BUCKET, uploadAvatarBuffer } from "../supabase-storage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

async function main() {
  const client = getServiceClient();
  if (!client) {
    console.error("Falta SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY no .env");
    process.exit(1);
  }

  const candidates = ["pedro.jpg", "pedro.png", "pedro.webp", "pedro.jpeg"].map((f) =>
    path.join(ROOT, "src/assets/avatars", f),
  );
  const file = candidates.find((f) => fs.existsSync(f));
  if (!file) {
    console.error("Nenhum pedro.* em src/assets/avatars/");
    process.exit(1);
  }

  const { data: admins, error: listErr } = await client
    .from("profiles")
    .select("id, email, avatar_path")
    .eq("role", "admin")
    .limit(5);

  if (listErr) {
    console.error("Erro ao listar admins:", listErr.message);
    process.exit(1);
  }
  if (!admins?.length) {
    console.error("Nenhum perfil admin. Rode: update profiles set role = 'admin' where email = ...");
    process.exit(1);
  }

  const buffer = fs.readFileSync(file);
  const ext = path.extname(file);
  const mime =
    ext === ".png"
      ? "image/png"
      : ext === ".webp"
        ? "image/webp"
        : "image/jpeg";

  for (const admin of admins) {
    const objectPath = await uploadAvatarBuffer({
      userId: admin.id as string,
      buffer,
      mimeType: mime,
      ext,
    });
    const { error } = await client
      .from("profiles")
      .update({
        avatar_path: objectPath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", admin.id);
    if (error) {
      console.error(`Falha update ${admin.email}:`, error.message);
      continue;
    }
    console.log(`OK ${admin.email} → ${AVATARS_BUCKET}/${objectPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
