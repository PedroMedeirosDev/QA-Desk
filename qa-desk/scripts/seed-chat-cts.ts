/**
 * Cria CTs Atendimento novo (Chat) no catálogo Desk.
 * Uso: npx tsx scripts/seed-chat-cts.ts
 *
 * Flows em draft — completar envio quando chat_* estiver no build.
 */
import { loadEnv } from "../server/load-env.ts";
loadEnv();

import {
  appendHistory,
  nextTestId,
  readCatalog,
  writeCatalog,
} from "../server/storage.ts";
import type { TestRecord } from "../server/types.ts";

const ITEMS = [
  {
    ctId: "CHAT-00",
    title: "CHAT-00 · Smoke abrir Atendimento",
    suite: "Lista",
    flowPath:
      "projects/polygonus/automation/maestro/flows/chat/06_0_chat_smoke_abrir.yaml",
    description:
      "Atendimento novo (home_card_chat): abrir menu e voltar. Runnable agora.",
    steps: [
      "PHJESUS coordenador na home",
      "Abrir tile Atendimento (home_card_chat)",
      "Voltar à home",
    ],
    expectedResult: "Menu abre e volta sem crash; home_card_mural visível de novo.",
    readiness: "ready" as const,
  },
  {
    ctId: "CHAT-01",
    title: "CHAT-01 · Enviar texto",
    suite: "Texto",
    flowPath:
      "projects/polygonus/automation/maestro/flows/chat/06_1_chat_texto.yaml",
    description:
      "Atendimento novo: enviar mensagem de texto. Draft até chat_input_texto/enviar.",
    steps: [
      "Abrir Atendimento novo",
      "Escrever texto assinado Maestro",
      "Enviar e validar na conversa",
    ],
    expectedResult: "Mensagem de texto visível na conversa.",
    readiness: "draft" as const,
  },
  {
    ctId: "CHAT-02",
    title: "CHAT-02 · Enviar áudio",
    suite: "Audio",
    flowPath:
      "projects/polygonus/automation/maestro/flows/chat/06_1_chat_audio.yaml",
    description:
      "Atendimento novo: anexar/enviar áudio. Draft até chat_input_audio.",
    steps: [
      "Abrir Atendimento novo",
      "Gravar ou anexar áudio",
      "Enviar",
    ],
    expectedResult: "Áudio anexado/enviado na conversa.",
    readiness: "draft" as const,
  },
  {
    ctId: "CHAT-03",
    title: "CHAT-03 · Enviar vídeo",
    suite: "Video",
    flowPath:
      "projects/polygonus/automation/maestro/flows/chat/06_1_chat_video.yaml",
    description:
      "Atendimento novo: anexar vídeo (câmera/galeria). Draft até chat_input_camera/galeria.",
    steps: [
      "Abrir Atendimento novo",
      "Anexar vídeo",
      "Enviar",
    ],
    expectedResult: "Vídeo anexado/enviado na conversa.",
    readiness: "draft" as const,
  },
  {
    ctId: "CHAT-04",
    title: "CHAT-04 · Enviar PDF",
    suite: "Pdf",
    flowPath:
      "projects/polygonus/automation/maestro/flows/chat/06_1_chat_pdf.yaml",
    description:
      "Atendimento novo: anexar PDF/documento. Draft até chat_input_anexo/pdf.",
    steps: [
      "Abrir Atendimento novo",
      "Anexar PDF",
      "Enviar",
    ],
    expectedResult: "PDF anexado/enviado na conversa.",
    readiness: "draft" as const,
  },
] as const;

const catalog = await readCatalog("polygonus");
const now = new Date().toISOString().slice(0, 10);
let created = 0;
let skipped = 0;

for (const item of ITEMS) {
  const testKey = `atendimento/${item.ctId.toLowerCase()}`;
  const exists = catalog.reports.find(
    (r) =>
      r.testKey === testKey ||
      r.automation?.flowPath?.replace(/\\/g, "/") === item.flowPath,
  );
  if (exists) {
    console.log("skip", exists.id, exists.title);
    skipped++;
    continue;
  }

  const id = nextTestId("polygonus", catalog);
  const report: TestRecord = {
    id,
    testKey,
    recordType: "teste",
    title: item.title,
    description: item.description,
    steps: [...item.steps],
    expectedResult: item.expectedResult,
    reportedAt: now,
    project: "polygonus",
    channel: "app",
    platform: "android",
    module: "Atendimento",
    status: "rascunho",
    homologationStatus: "pendente",
    executionMode: "automated",
    priority: "media",
    evidence: [],
    comments: [],
    history: [],
    showInPortfolio: false,
    automation: {
      type: "maestro",
      flowPath: item.flowPath,
      label: item.ctId,
      readiness: item.readiness,
    },
    tags: [
      "atendimento",
      "chat",
      "module:Atendimento",
      `suite:${item.suite}`,
      `ct:${item.ctId}`,
      "maestro",
    ],
  };

  appendHistory(report, {
    actor: "system",
    action: "test_created",
    detail: "CT Atendimento novo / Chat seed (flows Maestro draft)",
    meta: { testKey, flowPath: item.flowPath },
  });
  catalog.reports.unshift(report);
  created++;
  console.log("create", id, item.title);
}

if (created > 0) {
  await writeCatalog("polygonus", catalog);
}
console.log({ created, skipped, totalReports: catalog.reports.length });
