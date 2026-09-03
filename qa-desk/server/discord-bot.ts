/**
 * Bot Discord — envia reports e escuta reações do gestor.
 * Env: DISCORD_BOT_TOKEN + DISCORD_BUG_CHANNEL_ID
 * Opcional: DISCORD_GESTOR_USER_IDS (csv de snowflakes; se vazio, qualquer humano conta)
 *
 * Reações (só uma ativa por vez — as outras humanas são limpas):
 *   🔧 → em_tratamento
 *   ✅ → corrigido_gestor
 *   ⏸️ → sem_correcao
 *   ❌ → cancelado (não apaga a mensagem)
 * Remover a reação que segura o status → enviado_gestor
 * QA homologa no Desk → bot reage 💯
 */
import {
  AttachmentBuilder,
  Client,
  GatewayIntentBits,
  Partials,
  type Message,
  type MessageReaction,
  type PartialMessageReaction,
  type PartialUser,
  type User,
} from "discord.js";
import fs from "node:fs";
import { appendHistory, readCatalog, writeCatalog } from "./storage.js";
import {
  PROJECTS,
  type BugStatus,
  type ProjectSlug,
  type TestCatalog,
  type TestRecord,
} from "./types.js";

const LOG = "[discord-bot]";

/** Emojis pré-colocados na mensagem e mapeados para status. */
export const DISCORD_GESTOR_REACTIONS = [
  { emoji: "🔧", status: "em_tratamento" as const, label: "Em tratamento" },
  { emoji: "✅", status: "corrigido_gestor" as const, label: "Corrigido" },
  { emoji: "⏸️", status: "sem_correcao" as const, label: "Sem correção agora" },
  { emoji: "❌", status: "cancelado" as const, label: "Cancelado" },
] as const;

/** Reação do bot quando o QA homologa no Desk (💯 = 100). */
export const DISCORD_QA_OK_EMOJI = "💯";

/** Legenda colada no fim da mensagem Discord (gestor clica nas reações já listadas). */
export function discordReactionLegend(): string {
  const lines = DISCORD_GESTOR_REACTIONS.map(
    (r) => `${r.emoji} ${r.label}`,
  ).join(" · ");
  return `**Ações** — clique na reação abaixo (só a última conta):\n${lines}\n_(QA confirma depois com ${DISCORD_QA_OK_EMOJI})_`;
}

const STATUS_BY_EMOJI: Record<string, BugStatus> = Object.fromEntries(
  DISCORD_GESTOR_REACTIONS.map((r) => [r.emoji, r.status]),
);

const EMOJI_BY_STATUS: Partial<Record<BugStatus, string>> = Object.fromEntries(
  DISCORD_GESTOR_REACTIONS.map((r) => [r.status, r.emoji]),
);

const LOCKED_STATUSES: BugStatus[] = ["homologado", "arquivado"];

let client: Client | null = null;
let startPromise: Promise<Client | null> | null = null;

export function isDiscordBotConfigured(): boolean {
  return Boolean(
    process.env.DISCORD_BOT_TOKEN?.trim() &&
      process.env.DISCORD_BUG_CHANNEL_ID?.trim(),
  );
}

function bugChannelId(): string {
  return process.env.DISCORD_BUG_CHANNEL_ID!.trim();
}

function gestorAllowlist(): Set<string> | null {
  const raw = process.env.DISCORD_GESTOR_USER_IDS?.trim();
  if (!raw) return null;
  const ids = raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.length ? new Set(ids) : null;
}

export async function startDiscordBot(): Promise<Client | null> {
  if (!isDiscordBotConfigured()) {
    console.log(
      `${LOG} inativo (defina DISCORD_BOT_TOKEN + DISCORD_BUG_CHANNEL_ID)`,
    );
    return null;
  }
  if (client?.isReady()) return client;
  if (startPromise) return startPromise;

  startPromise = (async () => {
    const token = process.env.DISCORD_BOT_TOKEN!.trim();
    const c = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
      ],
      partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
        Partials.User,
      ],
    });

    c.once("ready", () => {
      console.log(`${LOG} online como ${c.user?.tag} · canal ${bugChannelId()}`);
    });

    c.on("messageReactionAdd", (reaction, user) => {
      void handleReactionAdd(reaction, user);
    });
    c.on("messageReactionRemove", (reaction, user) => {
      void handleReaction(reaction, user, "remove");
    });

    c.on("error", (err) => {
      console.error(`${LOG} client error:`, err.message);
    });

    try {
      await c.login(token);
      client = c;
      return c;
    } catch (err) {
      console.error(
        `${LOG} login falhou:`,
        err instanceof Error ? err.message : err,
      );
      client = null;
      startPromise = null;
      return null;
    }
  })();

  return startPromise;
}

export async function ensureDiscordBot(): Promise<Client | null> {
  if (!isDiscordBotConfigured()) return null;
  if (client?.isReady()) return client;
  return startDiscordBot();
}

export type BotSendFile = {
  /** Caminho local (legado) ou omitido se `buffer` for passado. */
  abs?: string;
  buffer?: Buffer;
  filename: string;
  mimeType?: string;
};

async function seedGestorReactions(message: Message) {
  for (const { emoji } of DISCORD_GESTOR_REACTIONS) {
    try {
      await message.react(emoji);
    } catch (err) {
      console.warn(
        `${LOG} falha ao pré-reagir ${emoji}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
}

export async function sendBugMessageViaBot(opts: {
  content: string;
  files: BotSendFile[];
}): Promise<{ messageId: string; channelId: string }> {
  const c = await ensureDiscordBot();
  if (!c?.isReady()) {
    throw Object.assign(new Error("Bot Discord não está pronto"), { status: 503 });
  }

  const channel = await c.channels.fetch(bugChannelId());
  if (!channel || !channel.isTextBased() || !("send" in channel)) {
    throw Object.assign(
      new Error("DISCORD_BUG_CHANNEL_ID não é um canal de texto"),
      { status: 500 },
    );
  }

  const attachments = opts.files.map((f) => {
    const buf = f.buffer ?? (f.abs ? fs.readFileSync(f.abs) : null);
    if (!buf) {
      throw new Error(`Anexo Discord sem bytes: ${f.filename}`);
    }
    return new AttachmentBuilder(buf, { name: f.filename });
  });

  const message: Message = await channel.send({
    content: opts.content,
    files: attachments,
    allowedMentions: { parse: [] },
  });

  await seedGestorReactions(message);

  return { messageId: message.id, channelId: message.channelId };
}

/**
 * Após QA homologar no Desk: reage 💯 na mensagem do bug (feedback visual ao gestor).
 * No-op se bot offline ou sem messageId.
 */
export async function reactQaHomologatedOnDiscord(opts: {
  messageId: string;
  channelId?: string;
}): Promise<boolean> {
  const c = await ensureDiscordBot();
  if (!c?.isReady()) {
    console.log(`${LOG} 💯 ignorado — bot offline`);
    return false;
  }

  const channelId = opts.channelId?.trim() || bugChannelId();
  try {
    const channel = await c.channels.fetch(channelId);
    if (!channel || !channel.isTextBased() || !("messages" in channel)) {
      console.warn(`${LOG} 💯 canal inválido ${channelId}`);
      return false;
    }
    const message = await channel.messages.fetch(opts.messageId);
    const existing = message.reactions.cache.find((r) => isQaOkEmoji(r.emoji.name));
    if (existing?.me) return true;
    await message.react(DISCORD_QA_OK_EMOJI);
    console.log(`${LOG} 💯 homologação QA em msg ${opts.messageId}`);
    return true;
  } catch (err) {
    console.warn(
      `${LOG} falha ao reagir 💯:`,
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

function isQaOkEmoji(emojiName: string | null): boolean {
  if (!emojiName) return false;
  return (
    emojiName === DISCORD_QA_OK_EMOJI ||
    emojiName === "100" ||
    emojiName.includes("💯")
  );
}

function reactionMatchesEmoji(
  reaction: MessageReaction,
  emoji: string,
): boolean {
  const name = reaction.emoji.name;
  if (!name) return false;
  if (name === emoji) return true;
  const resolved = resolveGestorEmoji(name);
  return resolved === emoji;
}

/**
 * Remove reações humanas dos outros status — fica só a última escolhida.
 * Mantém a seed do bot nas opções restantes.
 */
async function clearOtherHumanGestorReactions(
  message: Message,
  keepEmoji: string,
) {
  await message.fetch().catch(() => undefined);
  for (const { emoji } of DISCORD_GESTOR_REACTIONS) {
    if (emoji === keepEmoji) continue;
    const reaction = message.reactions.cache.find((r) =>
      reactionMatchesEmoji(r, emoji),
    );
    if (!reaction) continue;
    try {
      const users = await reaction.users.fetch();
      for (const [id, u] of users) {
        if (u.bot) continue;
        await reaction.users.remove(id).catch(() => undefined);
      }
    } catch (err) {
      console.warn(
        `${LOG} limpeza de ${emoji}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
}

async function findReportByDiscordMessageId(messageId: string): Promise<{
  project: ProjectSlug;
  catalog: TestCatalog;
  idx: number;
  report: TestRecord;
} | null> {
  for (const { slug } of PROJECTS) {
    const catalog = await readCatalog(slug);
    const idx = catalog.reports.findIndex((r) => r.discordMessageId === messageId);
    if (idx < 0) continue;
    return { project: slug, catalog, idx, report: catalog.reports[idx] };
  }
  return null;
}

function resolveGestorEmoji(emojiName: string | null): string | null {
  if (!emojiName) return null;
  if (STATUS_BY_EMOJI[emojiName]) return emojiName;
  // aliases unicode / nomes Discord
  if (emojiName === "white_check_mark" || emojiName.includes("✅")) return "✅";
  if (
    emojiName === "wrench" ||
    emojiName === "hammer_and_wrench" ||
    emojiName.includes("🔧") ||
    emojiName.includes("🛠")
  ) {
    return "🔧";
  }
  if (
    emojiName === "pause_button" ||
    emojiName === "double_vertical_bar" ||
    emojiName.includes("⏸")
  ) {
    return "⏸️";
  }
  if (emojiName === "x" || emojiName === "❌" || emojiName.includes("❌")) {
    return "❌";
  }
  return null;
}

async function stripReaction(
  reaction: MessageReaction | PartialMessageReaction,
  userId: string,
) {
  try {
    await reaction.users.remove(userId);
  } catch (err) {
    console.warn(
      `${LOG} não removeu reação de ${userId}:`,
      err instanceof Error ? err.message : err,
    );
  }
}

/** Add: bloqueia emojis fora do mapa; apply status nos permitidos. */
async function handleReactionAdd(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
) {
  try {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    // Só atuamos em mensagens vinculadas a bugs do Desk
    const messageId = reaction.message.id;
    const hit = await findReportByDiscordMessageId(messageId);
    if (!hit) return;

    const emojiKey = resolveGestorEmoji(reaction.emoji.name);
    // 💯 é do bot (homologação QA) — não remove se alguém espelhar; só ignora
    if (!emojiKey && isQaOkEmoji(reaction.emoji.name)) {
      return;
    }
    if (!emojiKey) {
      await stripReaction(reaction, user.id);
      console.log(`${LOG} reação bloqueada (emoji fora do mapa) user=${user.id}`);
      return;
    }

    const allow = gestorAllowlist();
    if (allow && !allow.has(user.id)) {
      await stripReaction(reaction, user.id);
      console.log(`${LOG} reação bloqueada (fora da allowlist) user=${user.id}`);
      return;
    }

    await handleReaction(reaction, user, "add");
  } catch (err) {
    console.error(
      `${LOG} reactionAdd falhou:`,
      err instanceof Error ? err.message : err,
    );
  }
}

async function handleReaction(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
  action: "add" | "remove",
) {
  try {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    const emojiKey = resolveGestorEmoji(reaction.emoji.name);
    if (!emojiKey) return;
    const mappedStatus = STATUS_BY_EMOJI[emojiKey];
    if (!mappedStatus) return;

    const allow = gestorAllowlist();
    if (allow && !allow.has(user.id)) {
      console.log(`${LOG} reação ignorada (user ${user.id} fora da allowlist)`);
      return;
    }

    const messageId = reaction.message.id;
    const hit = await findReportByDiscordMessageId(messageId);
    if (!hit) {
      console.log(`${LOG} mensagem ${messageId} sem bug vinculado`);
      return;
    }

    const { project, catalog, idx, report } = hit;
    const isBug =
      (report.recordType ?? (report.campaign ? "teste" : "bug")) === "bug";
    if (!isBug) return;
    if (LOCKED_STATUSES.includes(report.status)) return;

    const actor =
      ("tag" in user && user.tag) ||
      user.username ||
      `discord:${user.id}`;

    const prev = report.status;

    if (action === "add") {
      if (report.status === mappedStatus) {
        // Mesmo status: ainda limpa outras reações humanas (só a última visual)
        const msg = reaction.message;
        if (msg && "reactions" in msg) {
          await clearOtherHumanGestorReactions(msg as Message, emojiKey);
        }
        return;
      }
      report.status = mappedStatus;
      appendHistory(report, {
        actor,
        action: "discord_gestor_reaction",
        detail: `${emojiKey} no Discord → ${mappedStatus} (antes: ${prev})`,
        meta: {
          discordMessageId: messageId,
          discordUserId: user.id,
          emoji: emojiKey,
          status: mappedStatus,
        },
      });
      catalog.reports[idx] = report;
      await writeCatalog(project, catalog);
      const { syncGestorCasesForBug } = await import("./gestor-cases.js");
      syncGestorCasesForBug(project, report.id, report.status);
      const msg = reaction.message;
      if (msg && "reactions" in msg) {
        await clearOtherHumanGestorReactions(msg as Message, emojiKey);
      }
      console.log(
        `${LOG} ${report.id} → ${report.status} (add ${emojiKey}) por ${actor}`,
      );
      return;
    } else {
      // Só revoga se a reação removida era a que “segura” o status atual
      const holding = EMOJI_BY_STATUS[report.status];
      if (holding !== emojiKey) return;
      report.status = "enviado_gestor";
      appendHistory(report, {
        actor,
        action: "discord_gestor_revoke",
        detail: `Remoção de ${emojiKey} no Discord → enviado_gestor`,
        meta: {
          discordMessageId: messageId,
          discordUserId: user.id,
          emoji: emojiKey,
        },
      });
    }

    catalog.reports[idx] = report;
    await writeCatalog(project, catalog);
    const { syncGestorCasesForBug } = await import("./gestor-cases.js");
    syncGestorCasesForBug(project, report.id, report.status);
    console.log(
      `${LOG} ${report.id} → ${report.status} (${action} ${emojiKey}) por ${actor}`,
    );
  } catch (err) {
    console.error(
      `${LOG} reação falhou:`,
      err instanceof Error ? err.message : err,
    );
  }
}
