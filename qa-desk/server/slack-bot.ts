/**
 * Slack (Socket Mode — sem webhook público): captura de demandas e bugs, comandos
 * /pendencias, /demandas e /suite, e avisos no canal #avisos.
 * Só liga com SLACK_ATIVO=1 (uma instância só). Aceita mensagens e comandos só do dono.
 */
import { App, LogLevel } from "@slack/bolt";
import { WebClient } from "@slack/web-api";
import { DEMANDA_STATUS_LABELS, formatarListaPendencias } from "../src/types/demanda.js";
import { capturarBug, capturarDemanda, type AnexoCaptura } from "./captura-core.js";
import { isDatabaseEnabled } from "./db/config.js";
import { getPrisma } from "./db/prisma.js";
import { listarDemandas, listarPendencias } from "./demandas.js";
import { readCatalog } from "./storage.js";
import type { ProjectSlug } from "./types.js";

const LOG = "[slack]";
const PROJETO: ProjectSlug = "polygonus";

function cfg() {
  return {
    bot: process.env.SLACK_BOT_TOKEN?.trim() ?? "",
    app: process.env.SLACK_APP_TOKEN?.trim() ?? "",
    demandas: process.env.SLACK_DEMANDAS_CHANNEL_ID?.trim() ?? "",
    bugs: process.env.SLACK_BUGS_CHANNEL_ID?.trim() ?? "",
    avisos: process.env.SLACK_AVISOS_CHANNEL_ID?.trim() ?? "",
    dono: process.env.SLACK_DONO_USER_ID?.trim() ?? "",
  };
}

export function isSlackAtivo(): boolean {
  const c = cfg();
  return process.env.SLACK_ATIVO === "1" && Boolean(c.bot && c.app && c.dono && (c.demandas || c.bugs));
}

/** Texto do Slack → texto comum: <url|rótulo> vira "rótulo (url)". */
export function textoDoSlack(texto: string): string {
  return texto
    .replace(/<(https?:[^|>]+)\|([^>]+)>/g, "$2 ($1)")
    .replace(/<(https?:[^>]+)>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

/** Link de mensagem do Discord da empresa colado junto: vira o "link original" da pendência. */
export function linkDiscordNoTexto(texto: string): string | undefined {
  return texto.match(/https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/channels\/\d+\/\d+\/\d+/)?.[0];
}

/** Aviso no #avisos (usado também por scripts, sem o bot ligado). */
export async function avisarSlack(texto: string): Promise<boolean> {
  const c = cfg();
  if (!c.bot || !c.avisos) return false;
  try {
    await new WebClient(c.bot).chat.postMessage({ channel: c.avisos, text: texto, unfurl_links: false });
    return true;
  } catch (err) {
    console.error(`${LOG} aviso falhou:`, err instanceof Error ? err.message : err);
    return false;
  }
}

async function resumoSuite(): Promise<string> {
  if (!isDatabaseEnabled()) return "Sem banco configurado: não há histórico de execuções.";
  const desde = new Date(Date.now() - 24 * 3_600_000);
  const runs = await getPrisma().testRun.findMany({
    where: { projectSlug: PROJETO, startedAt: { gte: desde } },
    select: { testId: true, status: true, appVersion: true },
  });
  if (!runs.length) return "Nenhuma execução nas últimas 24 horas.";
  const titulos = new Map((await readCatalog(PROJETO)).reports.map((r) => [r.id, r.title]));
  const ok = runs.filter((r) => r.status === "success").length;
  const falhas = [...new Set(runs.filter((r) => r.status === "failed").map((r) => titulos.get(r.testId) ?? r.testId))];
  const versao = runs.find((r) => r.appVersion)?.appVersion;
  const linhas = [`Últimas 24 h: ${runs.length} execuções · ${ok} passaram · ${runs.length - ok} falharam${versao ? ` · v${versao}` : ""}`];
  if (falhas.length) linhas.push("Falharam:", ...falhas.slice(0, 15).map((t) => `• ${t}`));
  return linhas.join("\n");
}

async function listaDemandasAbertas(): Promise<string> {
  const abertas = (await listarDemandas(PROJETO)).filter((d) => d.status !== "feito").sort((a, b) => a.numero - b.numero);
  if (!abertas.length) return "Nenhuma demanda aberta.";
  return abertas
    .map((d) => `${d.codigo} · ${d.titulo} · ${DEMANDA_STATUS_LABELS[d.status]}${d.comQuem ? ` (com ${d.comQuem})` : ""}`)
    .join("\n");
}

type ArquivoSlack = { url_private_download?: string; name?: string; mimetype?: string; size?: number };

let app: InstanceType<typeof App> | null = null;

export async function startSlack(): Promise<void> {
  if (!isSlackAtivo()) {
    console.log(`${LOG} inativo (SLACK_ATIVO=1 + tokens + dono + canais)`);
    return;
  }
  if (app) return;
  const c = cfg();
  const a = new App({ token: c.bot, appToken: c.app, socketMode: true, logLevel: LogLevel.WARN });

  a.message(async ({ message, client }) => {
    const m = message as {
      channel: string;
      ts: string;
      user?: string;
      text?: string;
      subtype?: string;
      bot_id?: string;
      files?: ArquivoSlack[];
    };
    if (m.bot_id || (m.subtype && m.subtype !== "file_share")) return;
    if (m.channel !== c.demandas && m.channel !== c.bugs) return;
    if (m.user !== c.dono) return;

    const texto = textoDoSlack(m.text ?? "");
    const anexos: AnexoCaptura[] = (m.files ?? [])
      .filter((f) => f.url_private_download)
      .map((f) => ({
        url: f.url_private_download!,
        name: f.name ?? "anexo",
        contentType: f.mimetype,
        size: f.size ?? 0,
        headers: { Authorization: `Bearer ${c.bot}` },
      }));
    const responder = (t: string) => client.chat.postMessage({ channel: m.channel, thread_ts: m.ts, text: t, unfurl_links: false });
    if (!texto && !anexos.length) {
      await responder("Mensagem sem texto nem anexo: nada para registrar.");
      return;
    }
    try {
      const permalink = (await client.chat.getPermalink({ channel: m.channel, message_ts: m.ts })).permalink ?? "";
      const conteudo = {
        texto,
        anexos,
        linkOriginal: linkDiscordNoTexto(texto),
        linkCaptura: permalink,
        dataOriginal: new Date(Number(m.ts) * 1000).toISOString(),
      };
      const { resposta, pulados } =
        m.channel === c.demandas ? await capturarDemanda(conteudo, "slack") : await capturarBug(conteudo, "slack");
      const aviso = pulados.length ? `\nNão guardei: ${pulados.join(", ")} (grande demais ou indisponível).` : "";
      await client.reactions.add({ channel: m.channel, timestamp: m.ts, name: "white_check_mark" }).catch(() => undefined);
      await responder(`${resposta}${aviso}`);
    } catch (err) {
      console.error(`${LOG} falha ao registrar:`, err);
      await client.reactions.add({ channel: m.channel, timestamp: m.ts, name: "x" }).catch(() => undefined);
      await responder(`Não consegui registrar: ${err instanceof Error ? err.message : "erro desconhecido"}`);
    }
  });

  const somenteDono = (userId: string) => userId === c.dono;

  a.command("/pendencias", async ({ command, ack, respond }) => {
    await ack();
    if (!somenteDono(command.user_id)) {
      await respond({ response_type: "ephemeral", text: "Comando restrito." });
      return;
    }
    const pessoa = command.text.trim() || process.env.QA_GESTOR_NOME?.trim() || "Moacir";
    const itens = await listarPendencias(PROJETO, pessoa);
    await respond({
      response_type: "ephemeral",
      text: itens.length ? `Pendências com ${pessoa}:\n${formatarListaPendencias(itens)}` : `Nada pendente com ${pessoa}.`,
    });
  });

  a.command("/demandas", async ({ command, ack, respond }) => {
    await ack();
    if (!somenteDono(command.user_id)) {
      await respond({ response_type: "ephemeral", text: "Comando restrito." });
      return;
    }
    await respond({ response_type: "ephemeral", text: await listaDemandasAbertas() });
  });

  a.command("/suite", async ({ command, ack, respond }) => {
    await ack();
    if (!somenteDono(command.user_id)) {
      await respond({ response_type: "ephemeral", text: "Comando restrito." });
      return;
    }
    await respond({ response_type: "ephemeral", text: await resumoSuite() });
  });

  a.error(async (err) => {
    console.error(`${LOG} erro:`, err.message);
  });

  await a.start();
  app = a;
  console.log(`${LOG} online (Socket Mode); aceita só o dono do app`);
}
