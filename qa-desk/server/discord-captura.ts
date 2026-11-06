/**
 * Captura pelo servidor pessoal do Discord (docs/CAPTURA_DISCORD.md):
 * mensagem encaminhada (ou escrita) em #demandas vira demanda; em #capturas, bug em rascunho.
 * Só liga com DISCORD_CAPTURA_ATIVA=1 — uma instância só, senão cada mensagem vira duas.
 */
import { randomUUID } from "node:crypto";
import { Client, Events, GatewayIntentBits, type Message } from "discord.js";
import { tituloDoTexto, type DemandaAnexo } from "../src/types/demanda.js";
import { criarDemanda } from "./demandas.js";
import { appendHistory, nextBugCode, nextBugId, readCatalog, writeCatalog } from "./storage.js";
import { ehImagem, lerTextoDosPrints } from "./ocr.js";
import { makeStoredEvidenceFilename, uploadEvidenceBuffer } from "./supabase-storage.js";
import type { EvidenceFile, ProjectSlug, TestRecord } from "./types.js";

const LOG = "[discord-captura]";
const PROJETO: ProjectSlug = "polygonus";
const MAX_ANEXOS = 10;
const MAX_BYTES = 20 * 1024 * 1024;

type AnexoDiscord = { url: string; name: string; contentType?: string | null; size: number };

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

function urlPublica(caminho: string): string {
  const base = (process.env.QA_DESK_PUBLIC_URL?.trim() || "https://qa-desk-pedro.duckdns.org").replace(/\/$/, "");
  return `${base}${caminho}`;
}

function tipoEvidencia(mime: string, nome: string): EvidenceFile["type"] {
  if (/^video\//.test(mime) || /\.(mp4|webm|mov|mkv)$/i.test(nome)) return "video";
  if (/^image\//.test(mime) || /\.(png|jpe?g|webp|gif)$/i.test(nome)) return "screenshot";
  return "log";
}

/** Baixa do CDN do Discord (o link expira) e guarda no Storage do QA Desk. */
async function guardarAnexos(pasta: string, anexos: AnexoDiscord[]) {
  const guardados: Array<DemandaAnexo & { type: EvidenceFile["type"] }> = [];
  const imagens: Buffer[] = [];
  const pulados: string[] = [];
  for (const a of anexos.slice(0, MAX_ANEXOS)) {
    if (a.size > MAX_BYTES) {
      pulados.push(a.name);
      continue;
    }
    const resp = await fetch(a.url);
    if (!resp.ok) {
      pulados.push(a.name);
      continue;
    }
    const buffer = Buffer.from(await resp.arrayBuffer());
    const fileId = randomUUID();
    const mimeType = a.contentType || "application/octet-stream";
    const storedFilename = makeStoredEvidenceFilename(a.name, fileId);
    const { storageKey } = await uploadEvidenceBuffer({
      project: PROJETO,
      testId: pasta,
      buffer,
      originalName: a.name,
      mimeType,
      storedFilename,
    });
    guardados.push({ fileId, filename: a.name, mimeType, sizeBytes: buffer.length, storageKey, type: tipoEvidencia(mimeType, a.name) });
    if (ehImagem(mimeType, a.name)) imagens.push(buffer);
  }
  return { guardados, imagens, pulados: [...pulados, ...anexos.slice(MAX_ANEXOS).map((a) => a.name)] };
}

/** Junta o texto escrito com o lido dos prints; o lido vem marcado porque o OCR troca dígitos. */
export function montarTexto(escrito: string, lido: string): string {
  if (!lido) return escrito;
  if (!escrito) return lido;
  return `${escrito}\n\n--- Texto lido do print ---\n${lido}`;
}

async function lerPrintsComSeguranca(imagens: Buffer[]): Promise<string> {
  try {
    return await lerTextoDosPrints(imagens);
  } catch (err) {
    console.error(`${LOG} OCR falhou (segue só com o anexo):`, err instanceof Error ? err.message : err);
    return "";
  }
}

async function capturarDemanda(conteudo: ConteudoCapturado) {
  const { guardados, imagens, pulados } = await guardarAnexos(`demanda-${randomUUID()}`, conteudo.anexos);
  const lido = await lerPrintsComSeguranca(imagens);
  const demanda = await criarDemanda(
    PROJETO,
    {
      texto: montarTexto(conteudo.texto, lido),
      origem: {
        tipo: "discord",
        linkOriginal: conteudo.linkOriginal,
        linkCaptura: conteudo.linkCaptura,
        dataOriginal: conteudo.dataOriginal,
        ...(lido ? { textoDoPrint: true } : {}),
      },
      anexos: guardados.map(({ type: _t, ...a }) => a),
    },
    "discord",
  );
  const avisoOcr = lido ? "\nTexto lido do print: confira números e nomes." : "";
  return {
    resposta: `${demanda.codigo} · ${demanda.titulo}${avisoOcr}\n${urlPublica(`/projects/${PROJETO}/demandas/${demanda.codigo}`)}`,
    pulados,
  };
}

async function capturarBug(conteudo: ConteudoCapturado) {
  const catalogo = await readCatalog(PROJETO);
  const id = nextBugId(PROJETO, catalogo);
  const { guardados, imagens, pulados } = await guardarAnexos(id, conteudo.anexos);
  // Print de bug costuma ser tela do app: só vale ler quando não veio texto nenhum.
  const lido = conteudo.texto ? "" : await lerPrintsComSeguranca(imagens);
  const texto = montarTexto(conteudo.texto, lido);
  const agora = new Date().toISOString();
  const origem = conteudo.linkOriginal ? `\n\nOrigem: ${conteudo.linkOriginal}` : "";
  const bug: TestRecord = {
    id,
    recordType: "bug",
    bugCode: nextBugCode(catalogo, "app", "android"),
    title: tituloDoTexto(texto) || "Bug capturado pelo Discord",
    description: `${texto}${origem}`,
    steps: [],
    reportedAt: agora.slice(0, 10),
    project: PROJETO,
    channel: "app",
    platform: "android",
    status: "rascunho",
    severity: "media",
    priority: "media",
    evidence: guardados.map((a) => ({
      fileId: a.fileId,
      type: a.type,
      filename: a.filename,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      uploadedAt: agora,
      storageKey: a.storageKey,
    })),
    comments: [],
    history: [],
    showInPortfolio: false,
    tags: ["captura:discord"],
  };
  appendHistory(bug, { actor: "discord", action: "test_created", detail: "Bug capturado pelo Discord (rascunho)" });
  catalogo.reports.unshift(bug);
  await writeCatalog(PROJETO, catalogo);
  return { resposta: `${bug.bugCode} · rascunho · ${bug.title}\n${urlPublica(`/projects/${PROJETO}/app/bugs/${id}`)}`, pulados };
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
    const { resposta, pulados } = msg.channelId === c.demandas ? await capturarDemanda(conteudo) : await capturarBug(conteudo);
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
