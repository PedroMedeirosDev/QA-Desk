/**
 * Envia report de bug/CT para Discord (bot preferencial; webhook como fallback).
 */
import { formatDiscordReport } from "../src/lib/discord-report.js";
import {
  discordReactionLegend,
  isDiscordBotConfigured,
  sendBugMessageViaBot,
} from "./discord-bot.js";
import { resolveEvidenceForAttach } from "./supabase-storage.js";
import type { EvidenceFile, TestRecord } from "./types.js";

const DISCORD_CONTENT_MAX = 2000;
const DISCORD_FILE_MAX_BYTES = 9 * 1024 * 1024; // margem sob o limite ~10 MB
const DISCORD_MAX_FILES = 8;

export type DiscordSendResult = {
  ok: true;
  via: "bot" | "webhook";
  attached: string[];
  skipped: Array<{ filename: string; reason: string }>;
  truncatedContent: boolean;
  messageId?: string;
  channelId?: string;
};

type AttachReady = { evidence: EvidenceFile; buffer: Buffer };

async function pickEvidenceFiles(evidence: EvidenceFile[]): Promise<{
  attach: AttachReady[];
  skipped: Array<{ filename: string; reason: string }>;
}> {
  const skipped: Array<{ filename: string; reason: string }> = [];
  const candidates = evidence.filter(
    (e) => e.type === "screenshot" || e.type === "video",
  );
  candidates.sort((a, b) => {
    if (a.type === b.type) return 0;
    return a.type === "screenshot" ? -1 : 1;
  });

  const attach: AttachReady[] = [];
  for (const ev of candidates) {
    if (attach.length >= DISCORD_MAX_FILES) {
      skipped.push({ filename: ev.filename, reason: "limite de arquivos" });
      continue;
    }
    const loaded = await resolveEvidenceForAttach(ev.storageKey);
    if (!loaded) {
      skipped.push({
        filename: ev.filename,
        reason: "arquivo ausente (Storage/disco)",
      });
      continue;
    }
    if (loaded.size > DISCORD_FILE_MAX_BYTES) {
      skipped.push({
        filename: ev.filename,
        reason: `acima de ${Math.round(DISCORD_FILE_MAX_BYTES / (1024 * 1024))} MB`,
      });
      continue;
    }
    attach.push({ evidence: ev, buffer: loaded.buffer });
  }
  return { attach, skipped };
}

function buildContent(report: TestRecord): {
  content: string;
  truncatedContent: boolean;
} {
  let content = formatDiscordReport(report, {
    osVersion: report.osVersion,
    deviceLabel: report.deviceLabel,
    browser: report.browser,
    testLogin: report.testLogin,
    technicalEvidence: report.technicalEvidence,
  });

  const footerId = report.bugCode?.trim() || report.id;
  const legend = discordReactionLegend();
  const footer = `\n\n${legend}\n\n— \`qa-desk · ${report.project} · ${footerId}\``;
  const budget = DISCORD_CONTENT_MAX - footer.length;
  let truncatedContent = false;
  if (content.length > budget) {
    content = `${content.slice(0, Math.max(0, budget - 20))}\n…(truncado)`;
    truncatedContent = true;
  }
  content = `${content}${footer}`;
  return { content, truncatedContent };
}

async function sendViaWebhook(
  content: string,
  attach: AttachReady[],
): Promise<{ messageId?: string; channelId?: string }> {
  const webhook = process.env.DISCORD_BUG_WEBHOOK_URL?.trim();
  if (!webhook) {
    throw Object.assign(
      new Error(
        "Discord não configurado: defina DISCORD_BOT_TOKEN + DISCORD_BUG_CHANNEL_ID (bot) ou DISCORD_BUG_WEBHOOK_URL (fallback)",
      ),
      { status: 503 },
    );
  }

  const form = new FormData();
  form.append(
    "payload_json",
    JSON.stringify({
      content,
      allowed_mentions: { parse: [] },
    }),
  );

  for (let i = 0; i < attach.length; i++) {
    const { evidence, buffer } = attach[i];
    const blob = new Blob([new Uint8Array(buffer)], {
      type: evidence.mimeType || "application/octet-stream",
    });
    form.append(`files[${i}]`, blob, evidence.filename);
  }

  const waitUrl = webhook.includes("?") ? `${webhook}&wait=true` : `${webhook}?wait=true`;
  const res = await fetch(waitUrl, { method: "POST", body: form });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw Object.assign(
      new Error(
        `Discord webhook falhou (${res.status})${body ? `: ${body.slice(0, 200)}` : ""}`,
      ),
      { status: 502 },
    );
  }

  try {
    const json = (await res.json()) as { id?: string; channel_id?: string };
    return { messageId: json.id, channelId: json.channel_id };
  } catch {
    return {};
  }
}

export async function sendBugReportToDiscord(
  report: TestRecord,
): Promise<DiscordSendResult> {
  const { content, truncatedContent } = buildContent(report);
  const { attach, skipped } = await pickEvidenceFiles(report.evidence ?? []);

  if (isDiscordBotConfigured()) {
    const sent = await sendBugMessageViaBot({
      content,
      files: attach.map((a) => ({
        buffer: a.buffer,
        filename: a.evidence.filename,
        mimeType: a.evidence.mimeType,
      })),
    });
    return {
      ok: true,
      via: "bot",
      attached: attach.map((a) => a.evidence.filename),
      skipped,
      truncatedContent,
      messageId: sent.messageId,
      channelId: sent.channelId,
    };
  }

  const sent = await sendViaWebhook(content, attach);
  return {
    ok: true,
    via: "webhook",
    attached: attach.map((a) => a.evidence.filename),
    skipped,
    truncatedContent,
    messageId: sent.messageId,
    channelId: sent.channelId,
  };
}
