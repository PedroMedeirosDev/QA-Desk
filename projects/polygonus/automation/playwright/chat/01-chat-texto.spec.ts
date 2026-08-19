/**
 * CT-CHAT WEB — Smoke + texto (Atendimento novo).
 * Espelho: maestro/flows/chat/06_0_*, 06_1_chat_texto.yaml
 *
 *   npx playwright test chat/ --workers=1
 */
import { test } from "@playwright/test";
import path from "node:path";
import { openComunicadosSession } from "../shared/comunicados-session";
import {
  abrirChat,
  enviarMensagemChat,
  smokeAbrirChat,
} from "../shared/chat-composer";

const ROOT = path.join(__dirname, "..");

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ timeout: 240_000 });

test("CT-CHAT-00 WEB: smoke abrir atendimento", async () => {
  const log = "[ct-chat-00-web]";
  const { context, page } = await openComunicadosSession(ROOT, log);
  try {
    await smokeAbrirChat(page);
    console.log(`${log} ok`);
  } finally {
    await context.close().catch(() => undefined);
  }
});

test("CT-CHAT-01 WEB: enviar mensagem texto", async () => {
  const log = "[ct-chat-01-web]";
  const { context, page } = await openComunicadosSession(ROOT, log);
  const runId = Date.now().toString(36).slice(-6);
  try {
    await abrirChat(page);
    await enviarMensagemChat(
      page,
      `Teste Playwright Chrome - Chat Texto #${runId}`,
    );
    console.log(`${log} ok`);
  } finally {
    await context.close().catch(() => undefined);
  }
});
