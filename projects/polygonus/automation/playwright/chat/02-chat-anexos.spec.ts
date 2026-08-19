/**
 * CT-CHAT WEB — Anexos (PDF / foto / vídeo) via filechooser.
 * Espelho Maestro: flows/chat/06_1_chat_pdf.yaml, 06_1_chat_video.yaml
 *
 * Áudio (CHAT-02): fora — gravação nativa / falta chat_input_audio (SEMANTICS item 19).
 *
 *   npx playwright test chat/02-chat-anexos.spec.ts --workers=1
 */
import { test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { openComunicadosSession } from "../shared/comunicados-session";
import { enviarAnexoChat } from "../shared/chat-composer";

const ROOT = path.join(__dirname, "..");
const FIX = path.join(ROOT, "..", "maestro", "fixtures");
const FIX_MURAL = path.join(ROOT, "mural", "fixtures");

function pickFile(...candidates: string[]): string {
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error(`Fixture não encontrada: ${candidates.join(" | ")}`);
}

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ timeout: 360_000 });

test("CT-CHAT-04 WEB: anexar PDF", async () => {
  const log = "[ct-chat-04-web]";
  const { context, page } = await openComunicadosSession(ROOT, log);
  const runId = Date.now().toString(36).slice(-6);
  const file = pickFile(
    path.join(FIX, "PDF_TESTE.pdf"),
    path.join(FIX_MURAL, "doc-qa.pdf"),
  );
  try {
    await enviarAnexoChat(page, file, {
      tipo: "documento",
      legenda: `Teste Playwright Chrome - Chat PDF #${runId}`,
      assertNeedle: /Chat PDF|PDF_TESTE|doc-qa|\.pdf/i,
    });
    console.log(`${log} ok`);
  } finally {
    await context.close().catch(() => undefined);
  }
});

test("CT-CHAT-05 WEB: anexar foto (galeria)", async () => {
  const log = "[ct-chat-05-web]";
  const { context, page } = await openComunicadosSession(ROOT, log);
  const runId = Date.now().toString(36).slice(-6);
  const file = pickFile(
    path.join(FIX, "Foto_1.jpeg"),
    path.join(FIX_MURAL, "foto-qa.png"),
  );
  try {
    await enviarAnexoChat(page, file, {
      tipo: "galeria",
      legenda: `Teste Playwright Chrome - Chat Foto #${runId}`,
      assertNeedle: /Chat Foto|Foto_1|foto-qa|\.jpe?g|\.png/i,
    });
    console.log(`${log} ok`);
  } finally {
    await context.close().catch(() => undefined);
  }
});

test("CT-CHAT-06 WEB: anexar vídeo (galeria)", async () => {
  const log = "[ct-chat-06-web]";
  const { context, page } = await openComunicadosSession(ROOT, log);
  const runId = Date.now().toString(36).slice(-6);
  const file = pickFile(path.join(FIX, "Video_teste.mp4"));
  try {
    await enviarAnexoChat(page, file, {
      tipo: "galeria",
      legenda: `Teste Playwright Chrome - Chat Video #${runId}`,
      assertNeedle: /Chat Video|Video_teste|\.mp4/i,
    });
    console.log(`${log} ok`);
  } finally {
    await context.close().catch(() => undefined);
  }
});
