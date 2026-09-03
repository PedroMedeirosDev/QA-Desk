/**
 * Cria (ou promove) o usuário Grok no Supabase Auth + profiles.
 * Role `bot`: só Repasse. Senha impressa uma vez — não commitar.
 *
 *   npx tsx server/scripts/create-grok-user.ts
 *   npx tsx server/scripts/create-grok-user.ts --reset-password
 */
import crypto from "node:crypto";
import { loadEnv } from "../load-env.js";
import { getServiceClient } from "../middleware/auth.js";

loadEnv();

const GROK_EMAIL = "grok@qa-desk.local";
const GROK_NAME = "Grok";

function randomPassword(): string {
  return `Grok-Repasse-${crypto.randomBytes(6).toString("hex")}`;
}

async function main() {
  const resetPassword = process.argv.includes("--reset-password");
  const client = getServiceClient();
  if (!client) {
    console.error("Falta SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY no .env");
    process.exit(1);
  }

  const { data: listed, error: listErr } = await client.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) {
    console.error("Erro ao listar usuários:", listErr.message);
    process.exit(1);
  }

  const existing = listed.users.find(
    (u) => (u.email ?? "").toLowerCase() === GROK_EMAIL,
  );

  let userId: string;
  let password: string | null = null;

  if (existing) {
    userId = existing.id;
    const patch: {
      app_metadata: { role: "bot" };
      user_metadata: { display_name: string };
      password?: string;
    } = {
      app_metadata: { role: "bot" },
      user_metadata: { display_name: GROK_NAME },
    };
    if (resetPassword) {
      password = randomPassword();
      patch.password = password;
    }
    const { error: updErr } = await client.auth.admin.updateUserById(userId, patch);
    if (updErr) {
      console.error("Erro ao atualizar usuário:", updErr.message);
      process.exit(1);
    }
    console.log("Usuário Grok já existia — role/app_metadata atualizados.");
  } else {
    password = randomPassword();
    const { data, error } = await client.auth.admin.createUser({
      email: GROK_EMAIL,
      password,
      email_confirm: true,
      user_metadata: { display_name: GROK_NAME },
      app_metadata: { role: "bot" },
    });
    if (error || !data.user) {
      console.error("Erro ao criar usuário:", error?.message ?? "sem user");
      process.exit(1);
    }
    userId = data.user.id;
    console.log("Usuário Grok criado no Auth.");
  }

  const { error: profileErr } = await client
    .from("profiles")
    .update({
      role: "bot",
      display_name: GROK_NAME,
      email: GROK_EMAIL,
    })
    .eq("id", userId);

  if (profileErr) {
    console.warn(
      "profiles.role=bot falhou (rode supabase/migrations/006_profiles_role_bot.sql):",
      profileErr.message,
    );
    console.warn("O login ainda funciona via app_metadata.role=bot.");
  } else {
    console.log("profiles.role = bot");
  }

  console.log("");
  console.log("E-mail:", GROK_EMAIL);
  if (password) {
    console.log("Senha:", password);
  } else {
    console.log("Senha: inalterada (passe --reset-password para gerar outra).");
  }
  console.log("Acesso: só /projects/polygonus/repasse");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
