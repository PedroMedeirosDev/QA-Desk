/**
 * Slack (Socket Mode — sem webhook público): captura de demandas e bugs, comandos
 * /pendencias, /demandas e /suite, e avisos no canal #avisos.
 * Só liga com SLACK_ATIVO=1 (uma instância só). Aceita mensagens e comandos só do dono.
 */
import fs from "node:fs";
import path from "node:path";
import { App, LogLevel } from "@slack/bolt";
import { WebClient } from "@slack/web-api";
import {
  DEMANDA_STATUS_LABELS,
  formatarListaPendencias,
  resumirPrazos,
  type Demanda,
  type ResumoPrazos,
} from "../src/types/demanda.js";
import { capturarBug, capturarDemanda, type AnexoCaptura } from "./captura-core.js";
import { DATA_ROOT } from "./data-paths.js";
import { isDatabaseEnabled } from "./db/config.js";
import { getPrisma } from "./db/prisma.js";
import { atualizarDemanda, listarDemandas, listarPendencias, registrarCobranca } from "./demandas.js";
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

const ARQ_LEMBRETES = path.join(DATA_ROOT, "slack-lembretes.json");

function hojeSaoPaulo(): { data: string; hora: number; minuto: number; mes: string; dia: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  );
  return { data: `${p.year}-${p.month}-${p.day}`, hora: Number(p.hour), minuto: Number(p.minute), mes: `${p.year}-${p.month}`, dia: Number(p.day) };
}

function lerEnvios(): { diario?: string; mensal?: string } {
  try {
    return JSON.parse(fs.readFileSync(ARQ_LEMBRETES, "utf8"));
  } catch {
    return {};
  }
}

function gravarEnvios(e: { diario?: string; mensal?: string }) {
  fs.mkdirSync(path.dirname(ARQ_LEMBRETES), { recursive: true });
  fs.writeFileSync(ARQ_LEMBRETES, JSON.stringify(e), "utf8");
}

function dataBr(iso?: string) {
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "";
}

/** Blocos do lembrete: cada demanda com Cobrei / Entregue / Adiar 3 dias. */
export function blocosLembrete(r: ResumoPrazos): { texto: string; blocos: unknown[] } | null {
  const grupos: Array<[string, Demanda[]]> = [
    ["Vencem hoje", r.vencemHoje],
    ["Atrasadas", r.atrasadas],
    ["Próximos 3 dias", r.proximos],
  ];
  if (!grupos.some(([, l]) => l.length)) return null;
  const blocos: unknown[] = [{ type: "header", text: { type: "plain_text", text: "Prazos de hoje" } }];
  for (const [titulo, lista] of grupos) {
    if (!lista.length) continue;
    blocos.push({ type: "section", text: { type: "mrkdwn", text: `*${titulo}*` } });
    for (const d of lista) {
      const linha = `*${d.codigo}* · ${d.titulo}${d.comQuem ? ` · com ${d.comQuem}` : ""} · prazo ${dataBr(d.prazo)}${d.cobrancas?.length ? ` · cobrado ${d.cobrancas.length}x` : ""}`;
      blocos.push({ type: "section", text: { type: "mrkdwn", text: linha } });
      blocos.push({
        type: "actions",
        elements: [
          { type: "button", text: { type: "plain_text", text: "Cobrei" }, action_id: "demanda_cobrei", value: d.codigo },
          { type: "button", text: { type: "plain_text", text: "Entregue" }, style: "primary", action_id: "demanda_entregue", value: d.codigo },
          { type: "button", text: { type: "plain_text", text: "Adiar 3 dias" }, action_id: "demanda_adiar", value: d.codigo },
        ],
      });
    }
  }
  const texto = `Prazos: ${r.vencemHoje.length} hoje · ${r.atrasadas.length} atrasadas · ${r.proximos.length} nos próximos dias`;
  return { texto, blocos };
}

async function enviarLembretes(client: WebClient, canal: string) {
  const agora = hojeSaoPaulo();
  if (agora.hora < 8 || (agora.hora === 8 && agora.minuto < 30)) return;
  const envios = lerEnvios();
  const demandas = await listarDemandas(PROJETO);
  if (envios.diario !== agora.data) {
    const lembrete = blocosLembrete(resumirPrazos(demandas, agora.data));
    if (lembrete) await client.chat.postMessage({ channel: canal, text: lembrete.texto, blocks: lembrete.blocos as never });
    envios.diario = agora.data;
  }
  if (agora.dia === 1 && envios.mensal !== agora.mes) {
    const abertas = demandas.filter((d) => d.tipo === "sugestao" && (d.sugestaoStatus === "enviada" || d.sugestaoStatus === "sem_retorno"));
    if (abertas.length) {
      const maisAntiga = [...abertas].sort((a, b) => a.criadaEm.localeCompare(b.criadaEm))[0];
      await client.chat.postMessage({
        channel: canal,
        text: `Sugestões sem retorno: ${abertas.length} (a mais antiga de ${dataBr(maisAntiga.criadaEm)})\n${abertas.map((s) => `• ${s.codigo} · ${s.titulo}`).join("\n")}`,
      });
    }
    envios.mensal = agora.mes;
  }
  gravarEnvios(envios);
}

function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

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

  const acaoDemanda = (acao: "demanda_cobrei" | "demanda_entregue" | "demanda_adiar") =>
    a.action(acao, async ({ ack, body, action, respond }) => {
      await ack();
      if (!somenteDono(body.user.id)) return;
      const codigo = (action as { value?: string }).value ?? "";
      const atual = (await listarDemandas(PROJETO)).find((d) => d.codigo === codigo);
      if (!atual) {
        await respond({ response_type: "ephemeral", replace_original: false, text: `${codigo} não encontrada.` });
        return;
      }
      let texto: string;
      if (acao === "demanda_cobrei") {
        await registrarCobranca(PROJETO, codigo, "slack");
        texto = `${codigo}: cobrança registrada.`;
      } else if (acao === "demanda_entregue") {
        await atualizarDemanda(PROJETO, codigo, { status: "feito" }, "slack");
        texto = `${codigo}: marcada como entregue.`;
      } else {
        const novo = somarDias(atual.prazo ?? hojeSaoPaulo().data, 3);
        await atualizarDemanda(PROJETO, codigo, { prazo: novo }, "slack");
        texto = `${codigo}: prazo adiado para ${dataBr(novo)}.`;
      }
      await respond({ response_type: "ephemeral", replace_original: false, text: texto });
    });
  acaoDemanda("demanda_cobrei");
  acaoDemanda("demanda_entregue");
  acaoDemanda("demanda_adiar");

  a.error(async (err) => {
    console.error(`${LOG} erro:`, err.message);
  });

  await a.start();
  app = a;
  if (c.avisos) {
    const web = new WebClient(c.bot);
    const rodar = () => enviarLembretes(web, c.avisos).catch((err) => console.error(`${LOG} lembrete falhou:`, err instanceof Error ? err.message : err));
    void rodar();
    setInterval(rodar, 10 * 60_000).unref();
  }
  console.log(`${LOG} online (Socket Mode); aceita só o dono do app`);
}
