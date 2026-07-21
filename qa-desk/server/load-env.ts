import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Lê pares chave=valor de um arquivo .env */
export function readEnvFile(envPath: string): Record<string, string> {
  const vars: Record<string, string> = {};
  if (!fs.existsSync(envPath)) return vars;

  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    vars[key] = value;
  }

  return vars;
}

/** Carrega qa-desk/.env sem sobrescrever variáveis já definidas no shell */
export function loadEnv() {
  const envPath = path.join(APP_ROOT, ".env");
  const e2eMock = process.env.QA_E2E_MOCK === "1";
  for (const [key, value] of Object.entries(readEnvFile(envPath))) {
    // E2E dogfooding: não puxar Supabase do .env (força auth mock)
    if (e2eMock && /SUPABASE/i.test(key)) continue;
    if (!(key in process.env)) process.env[key] = value;
  }
  if (e2eMock) {
    // Não usar delete — o Prisma/dotenv do .env re-injeta a key se ela não existir.
    // String vazia permanece e isServerAuthConfigured() / Vite tratam como mock.
    for (const key of [
      "VITE_SUPABASE_URL",
      "VITE_SUPABASE_ANON_KEY",
      "SUPABASE_URL",
      "SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ]) {
      process.env[key] = "";
    }
  }
}
