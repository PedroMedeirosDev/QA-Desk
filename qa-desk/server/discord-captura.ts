/**
 * Captura pelo servidor pessoal do Discord (docs/CAPTURA_DISCORD.md):
 * mensagem encaminhada (ou escrita) em #demandas vira demanda; em #capturas, bug em rascunho.
 * Só liga com DISCORD_CAPTURA_ATIVA=1 — uma instância só, senão cada mensagem vira duas.
 */
import { Client, Events, GatewayIntentBits, type Message } from "discord.js";
import { capturarBug, capturarDemanda, type AnexoCaptura } from "./captura-core.js";

export { montarTexto } from "./captura-core.js";

const LOG = "[discord-captura]";

type AnexoDiscord = AnexoCaptura;

export type ConteudoCapturado = {
  texto: string;
  anexos: AnexoDiscord[];
  /** Mensagem de onde veio, quando foi encaminhada (servidor da empresa). */
  linkOriginal?: string;
  linkCaptura: string;
  dataOriginal?: string;
  encaminhada: boolean;
};

/** `Collection` do discord.js é um Map: iterar direto dá pares [id, valor]. */
type Colecao<T> = { values(): Iterable<T> };

/** Forma mínima da mensagem que a extração usa (facilita testar sem o Discord). */
export type MensagemCaptura = {
  content: string;
  url: string;
  createdAt: Date;
  attachments: Colecao<AnexoDiscord>;
  reference?: { guildId?: string | null; channelId?: string | null; messageId?: string | null } | null;
  messageSnapshots?: Colecao<{
    content?: string | null;
    createdAt?: Date | null;
    attachments?: Colecao<AnexoDiscord> | null;
  }>;
};

export function extrairConteudo(msg: MensagemCaptura): ConteudoCapturado {
  const snapshot = msg.messageSnapshots ? [...msg.messageSnapshots.values()][0] : undefined;
  if (snapshot) {
    const r = msg.reference;
    const linkOriginal =
      r?.channelId && r.messageId
        ? `https://discord.com/channels/${r.guildId ?? "@me"}/${r.channelId}/${r.messageId}`
        : undefined;
    // O comentário que você escreve ao encaminhar fica em msg.content.
    const texto = [snapshot.content?.trim(), msg.content?.trim()].filter(Boolean).join("\n\n");
    return {
      texto,
      anexos: snapshot.attachments ? [...snapshot.attachments.values()] : [],
      linkOriginal,
      linkCaptura: msg.url,
      dataOriginal: snapshot.createdAt?.toISOString(),
      encaminhada: true,
    };
  }
  return {
    texto: msg.content?.trim() ?? "",
    anexos: [...msg.attachments.values()],
    linkCaptura: msg.url,
    dataOriginal: msg.createdAt.toISOString(),
    encaminhada: false,
  };
}

function canais() {
  return {
    demandas: process.env.DISCORD_CAPTURA_DEMANDAS_CHANNEL_ID?.trim() ?? "",
    bugs: process.env.DISCORD_CAPTURA_BUGS_CHANNEL_ID?.trim() ?? "",
  };
}

export function isCapturaAtiva(): boolean {
  const c = canais();
  return process.env.DISCORD_CAPTURA_ATIVA === "1" && Boolean(process.env.DISCORD_BOT_TOKEN?.trim() && c.demandas && c.bugs);
}

async function tratarMensagem(msg: Message, donoId: string) {
  const c = canais();
  if (msg.author.bot) return;
  if (msg.channelId !== c.demandas && msg.channelId !== c.bugs) return;
  if (msg.author.id !== donoId) return;

  const conteudo = extrairConteudo(msg as unknown as MensagemCaptura);
  if (!conteudo.texto && conteudo.anexos.length === 0) {
    await msg.react("❌").catch(() => undefined);
    await msg.reply("Mensagem sem texto nem anexo: nada para registrar.").catch(() => undefined);
    return;
  }
  try {
    const { resposta, pulados } = msg.channelId === c.demandas ? await capturarDemanda(conteudo, "discord") : await capturarBug(conteudo, "discord");
    const aviso = pulados.length ? `\nNão guardei: ${pulados.join(", ")} (grande demais ou indisponível).` : "";
    await msg.react("✅").catch(() => undefined);
    await msg.reply(`${resposta}${aviso}`);
  } catch (err) {
    console.error(`${LOG} falha ao registrar:`, err);
    await msg.react("❌").catch(() => undefined);
    await msg.reply(`Não consegui registrar: ${err instanceof Error ? err.message : "erro desconhecido"}`).catch(() => undefined);
  }
}

let cliente: Client | null = null;

export async function startCaptura(): Promise<Client | null> {
  if (!isCapturaAtiva()) {
    console.log(`${LOG} inativa (DISCORD_CAPTURA_ATIVA=1 + canais de demandas e bugs)`);
    return null;
  }
  if (cliente) return cliente;
  const c = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  });
  let donoId = "";
  c.once(Events.ClientReady, async (pronto) => {
    const app = await pronto.application.fetch();
    donoId = app.owner && "ownerId" in app.owner ? app.owner.ownerId ?? "" : app.owner?.id ?? "";
    console.log(`${LOG} online como ${pronto.user.tag}; aceita mensagens só do dono do app`);
  });
  c.on(Events.MessageCreate, (msg) => {
    if (!donoId) return;
    void tratarMensagem(msg, donoId);
  });
  c.on(Events.Error, (err) => console.error(`${LOG} erro do cliente:`, err.message));
  await c.login(process.env.DISCORD_BOT_TOKEN!.trim());
  cliente = c;
  return c;
}
