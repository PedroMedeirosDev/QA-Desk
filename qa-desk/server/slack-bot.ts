/**
 * Slack (Socket Mode — sem webhook público): captura de demandas e bugs, comandos
 * /pendencias, /demandas e /suite, e avisos no canal #avisos.
 * Canal de entrada: classifica o print/texto (Grok só com texto filtrado) e espera
 * o dono confirmar o tipo num botão antes de gravar.
 * Só liga com SLACK_ATIVO=1 (uma instância só). Aceita mensagens e comandos só do dono.
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { App, LogLevel } from "@slack/bolt";
import { WebClient } from "@slack/web-api";
import {
  DEMANDA_STATUS_LABELS,
  formatarListaPendencias,
  resumirPrazos,
  tituloDoTexto,
  type Demanda,
  type ResumoPrazos,
} from "../src/types/demanda.js";
import {
  capturarBug,
  capturarDemanda,
  lerTextoDoConteudo,
  montarTexto,
  type AnexoCaptura,
  type ConteudoCaptura,
} from "./captura-core.js";
import {
  classificarTexto,
  filtrarParaIaExterna,
  interpretarRevisaoGrok,
  parecidos,
  pedidoRevisao,
  TIPO_CAPTURA_LABELS,
  type Classificacao,
  type RevisaoGrok,
} from "./classificacao.js";
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
    entrada: process.env.SLACK_ENTRADA_CHANNEL_ID?.trim() ?? "",
    /** Canal onde o Grok revisa (só texto filtrado); o Grok NÃO pode estar no #entrada. */
    revisao: process.env.SLACK_REVISAO_CHANNEL_ID?.trim() ?? "",
    grok: process.env.SLACK_GROK_USER_ID?.trim() ?? "",
    /** xoxp- só com chat:write: o pedido ao Grok sai em nome do dono (o Grok ignora bots). */
    usuario: process.env.SLACK_USER_TOKEN?.trim() ?? "",
    avisos: process.env.SLACK_AVISOS_CHANNEL_ID?.trim() ?? "",
    dono: process.env.SLACK_DONO_USER_ID?.trim() ?? "",
  };
}

export function isSlackAtivo(): boolean {
  const c = cfg();
  return process.env.SLACK_ATIVO === "1" && Boolean(c.bot && c.app && c.dono && (c.demandas || c.bugs || c.entrada));
}

type AcaoEntrada = "entrada_bug" | "entrada_demanda" | "entrada_sugestao" | "entrada_descartar";

/** Bug/Sugestão/Demanda gravam; dúvida e configuração não têm registro próprio → Demanda. */
const ACAO_RECOMENDADA: Record<Classificacao["tipo"], AcaoEntrada> = {
  bug: "entrada_bug",
  sugestao: "entrada_sugestao",
  demanda: "entrada_demanda",
  duvida: "entrada_demanda",
  configuracao: "entrada_demanda",
};

/** Proposta de classificação com os botões; o recomendado vem destacado. */
export function blocosEntrada(
  id: string,
  c: Classificacao,
  similares: Array<{ codigo: string; titulo: string }>,
  aviso?: string,
  botaoRevisao = false,
): { texto: string; blocos: unknown[] } {
  const origem = c.fonte === "ia" ? "Grok" : "regras locais";
  const linhas = [
    `*Parece ${TIPO_CAPTURA_LABELS[c.tipo]}* (${origem}, confiança ${Math.round(c.confianca * 100)}%)`,
    `*${c.titulo}*`,
    ...(c.resumo ? [c.resumo] : []),
    ...(c.motivo ? [`_${c.motivo}_`] : []),
  ];
  const blocos: unknown[] = [{ type: "section", text: { type: "mrkdwn", text: linhas.join("\n") } }];
  if (similares.length) {
    blocos.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `:warning: Parecido com: ${similares.map((s) => `*${s.codigo}* ${s.titulo}`).join(" · ")}. Confira antes de criar outro.`,
        },
      ],
    });
  }
  if (aviso) blocos.push({ type: "context", elements: [{ type: "mrkdwn", text: aviso }] });
  if (botaoRevisao) {
    blocos.push({
      type: "actions",
      elements: [{ type: "button", text: { type: "plain_text", text: "Pedir revisão ao Grok" }, action_id: "entrada_revisao_grok", value: id }],
    });
  }
  const recomendada = ACAO_RECOMENDADA[c.tipo];
  const botao = (acao: AcaoEntrada, rotulo: string) => ({
    type: "button",
    text: { type: "plain_text", text: rotulo },
    action_id: acao,
    value: id,
    ...(acao === recomendada ? { style: "primary" } : {}),
  });
  blocos.push({
    type: "actions",
    elements: [
      botao("entrada_bug", "Bug"),
      botao("entrada_demanda", "Demanda"),
      botao("entrada_sugestao", "Sugestão"),
      { type: "button", text: { type: "plain_text", text: "Descartar" }, style: "danger", action_id: "entrada_descartar", value: id },
    ],
  });
  return { texto: `Parece ${TIPO_CAPTURA_LABELS[c.tipo]}: ${c.titulo}`, blocos };
}

const MARCADOR_FILTRO = /\[(NOME|CPF|CNPJ|TELEFONE|EMAIL|VALOR|LINK|NUM|OCULTO)\]/;

/**
 * Título do Grok só vale se não carregar marcador do filtro; senão (e nas regras locais)
 * o título sai do texto original — o registro fica no QA Desk, não vai para fora.
 */
export function tituloDaIa(c: Classificacao): string | undefined {
  if (c.fonte !== "ia") return undefined;
  return MARCADOR_FILTRO.test(c.titulo) ? undefined : c.titulo;
}

/** Resposta do Grok levada à proposta no #entrada. */
export function textoRevisao(r: RevisaoGrok, tipoProposto: Classificacao["tipo"], tituloAceito: boolean): string {
  const linhas = [
    r.tipo
      ? `*Revisão do Grok:* ${r.tipo === tipoProposto ? "concorda" : "discorda"} — ${TIPO_CAPTURA_LABELS[r.tipo]}`
      : "*Revisão do Grok:* não indicou o tipo",
  ];
  if (r.titulo) linhas.push(`Título sugerido: ${r.titulo}${tituloAceito ? " _(uso este ao confirmar)_" : ""}`);
  if (r.falta) linhas.push(`O que falta: ${r.falta}`);
  return linhas.join("\n");
}

type EntradaPendente = {
  conteudo: ConteudoCaptura;
  lido: string;
  titulo?: string;
  tipoProposto?: Classificacao["tipo"];
  /** Mensagem do pedido no canal de revisão (a resposta do Grok vem na thread dela). */
  revisaoTs?: string;
  revisaoPedida?: boolean;
  tituloGrok?: string;
  canal: string;
  ts: string;
  criadaEm: number;
};

const BUG_ENCERRADO = new Set(["homologado", "cancelado", "arquivado", "sem_correcao", "nao_reproduzido"]);
const ENTRADA_VALIDADE_MS = 24 * 3_600_000;
const ARQ_PENDENTES = path.join(DATA_ROOT, "slack-entrada-pendentes.json");

/** Propostas à espera do clique; sobrevivem a reinício. O token não vai para o disco. */
const pendentes = {
  mapa: new Map<string, EntradaPendente>(),
  carregar() {
    try {
      const lido = JSON.parse(fs.readFileSync(ARQ_PENDENTES, "utf8")) as Record<string, EntradaPendente>;
      this.mapa = new Map(Object.entries(lido));
    } catch {
      this.mapa = new Map();
    }
  },
  gravar() {
    fs.mkdirSync(path.dirname(ARQ_PENDENTES), { recursive: true });
    const semToken = Object.fromEntries(
      [...this.mapa].map(([id, p]) => [id, { ...p, conteudo: { ...p.conteudo, anexos: p.conteudo.anexos.map(({ headers: _h, ...a }) => a) } }]),
    );
    fs.writeFileSync(ARQ_PENDENTES, JSON.stringify(semToken), "utf8");
  },
  set(id: string, p: EntradaPendente) {
    this.mapa.set(id, p);
    this.gravar();
  },
  /** Tira da fila (clique duplo não grava duas vezes) e devolve com o token recolocado. */
  retirar(id: string, token: string): EntradaPendente | undefined {
    const p = this.mapa.get(id);
    if (!p) return undefined;
    this.mapa.delete(id);
    this.gravar();
    return { ...p, conteudo: { ...p.conteudo, anexos: p.conteudo.anexos.map((a) => ({ ...a, headers: { Authorization: `Bearer ${token}` } })) } };
  },
  limparVencidas() {
    const limite = Date.now() - ENTRADA_VALIDADE_MS;
    let mudou = false;
    for (const [id, p] of this.mapa) {
      if (p.criadaEm < limite) {
        this.mapa.delete(id);
        mudou = true;
      }
    }
    if (mudou) this.gravar();
  },
};

/** Resposta do Grok na thread de um pedido: guarda o título revisado e avisa no #entrada. */
async function tratarRevisaoGrok(client: WebClient, threadTs: string, texto: string) {
  const achado = [...pendentes.mapa].find(([, p]) => p.revisaoTs === threadTs);
  if (!achado) return;
  const [id, p] = achado;
  const revisao = interpretarRevisaoGrok(texto);
  const tituloAceito = Boolean(revisao.titulo && !MARCADOR_FILTRO.test(revisao.titulo));
  if (tituloAceito) pendentes.set(id, { ...p, tituloGrok: revisao.titulo });
  await client.chat.postMessage({
    channel: p.canal,
    thread_ts: p.ts,
    text: textoRevisao(revisao, p.tipoProposto ?? "demanda", tituloAceito),
    unfurl_links: false,
  });
}

async function itensJaRegistrados(): Promise<Array<{ codigo: string; titulo: string }>> {
  const demandas = (await listarDemandas(PROJETO))
    .filter((d) => d.status !== "feito")
    .map((d) => ({ codigo: d.codigo, titulo: d.titulo }));
  const bugs = (await readCatalog(PROJETO)).reports
    .filter((r) => r.recordType === "bug" && !BUG_ENCERRADO.has(r.status))
    .map((r) => ({ codigo: r.bugCode ?? r.id, titulo: r.title }));
  return [...demandas, ...bugs];
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
  pendentes.carregar();
  const a = new App({ token: c.bot, appToken: c.app, socketMode: true, logLevel: LogLevel.WARN });

  a.message(async ({ message, client }) => {
    const m = message as {
      channel: string;
      ts: string;
      user?: string;
      text?: string;
      subtype?: string;
      bot_id?: string;
      thread_ts?: string;
      files?: ArquivoSlack[];
    };
    // Canal de revisão: só interessa a resposta do Grok na thread de um pedido nosso.
    if (c.revisao && m.channel === c.revisao) {
      if (c.grok && m.user === c.grok && m.thread_ts) {
        await tratarRevisaoGrok(client, m.thread_ts, textoDoSlack(m.text ?? "")).catch((err) =>
          console.error(`${LOG} revisão do Grok falhou:`, err instanceof Error ? err.message : err),
        );
      }
      return;
    }
    if (m.bot_id || (m.subtype && m.subtype !== "file_share")) return;
    const ehEntrada = Boolean(c.entrada) && m.channel === c.entrada;
    if (!ehEntrada && m.channel !== c.demandas && m.channel !== c.bugs) return;
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
        canal: ehEntrada ? "#entrada" : m.channel === c.demandas ? "#demandas" : "#bugs",
      };
      if (ehEntrada) {
        pendentes.limparVencidas();
        const lido = await lerTextoDoConteudo(conteudo);
        const completo = montarTexto(texto, lido);
        if (!completo.trim()) {
          await responder("Não achei texto na mensagem nem no print. Mande pelo #demandas ou #bugs.");
          return;
        }
        const classificacao = await classificarTexto(completo);
        const tituloIa = tituloDaIa(classificacao);
        const titulo = tituloIa ?? tituloDoTexto(completo);
        const similares = parecidos(`${titulo}\n${completo}`, await itensJaRegistrados());
        const id = randomUUID();
        const pendente: EntradaPendente = {
          conteudo,
          lido,
          titulo: tituloIa,
          tipoProposto: classificacao.tipo,
          canal: m.channel,
          ts: m.ts,
          criadaEm: Date.now(),
        };
        let aviso: string | undefined;
        if (c.revisao) {
          // Para o canal do Grok vai só texto filtrado — nunca o print nem o texto original.
          const pedido = await client.chat.postMessage({
            channel: c.revisao,
            text: pedidoRevisao(filtrarParaIaExterna(completo), classificacao.tipo, filtrarParaIaExterna(titulo)),
            unfurl_links: false,
          });
          pendente.revisaoTs = pedido.ts;
          aviso = c.usuario && c.grok
            ? `Revisão: o texto filtrado está no <#${c.revisao}>. Toque em *Pedir revisão ao Grok* (sai em seu nome).`
            : `Revisão: no <#${c.revisao}>, responda \`@Grok revise\` na mensagem do QA Desk.`;
        }
        pendentes.set(id, pendente);
        const proposta = blocosEntrada(id, { ...classificacao, titulo }, similares, aviso, Boolean(c.revisao && c.usuario && c.grok));
        await client.chat.postMessage({
          channel: m.channel,
          thread_ts: m.ts,
          text: proposta.texto,
          blocks: proposta.blocos as never,
          unfurl_links: false,
        });
        return;
      }
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

  const acaoEntrada = (acao: AcaoEntrada) =>
    a.action(acao, async ({ ack, body, action, respond, client }) => {
      await ack();
      if (!somenteDono(body.user.id)) return;
      const id = (action as { value?: string }).value ?? "";
      const p = pendentes.retirar(id, c.bot);
      if (!p) {
        await respond({ replace_original: true, text: "Essa proposta expirou ou já foi usada. Mande a mensagem de novo." });
        return;
      }
      if (acao === "entrada_descartar") {
        await respond({ replace_original: true, text: "Descartado: nada foi registrado." });
        return;
      }
      try {
        const opcoes = { titulo: p.tituloGrok ?? p.titulo, lido: p.lido };
        const { resposta, pulados } =
          acao === "entrada_bug"
            ? await capturarBug(p.conteudo, "slack", opcoes)
            : await capturarDemanda(p.conteudo, "slack", { ...opcoes, tipo: acao === "entrada_sugestao" ? "sugestao" : "demanda" });
        const aviso = pulados.length ? `\nNão guardei: ${pulados.join(", ")} (grande demais ou indisponível).` : "";
        await client.reactions.add({ channel: p.canal, timestamp: p.ts, name: "white_check_mark" }).catch(() => undefined);
        await respond({ replace_original: true, text: `${resposta}${aviso}` });
      } catch (err) {
        console.error(`${LOG} falha ao registrar entrada:`, err);
        pendentes.set(id, p);
        await respond({
          replace_original: false,
          text: `Não consegui registrar: ${err instanceof Error ? err.message : "erro desconhecido"}. Tente o botão de novo.`,
        });
      }
    });
  a.action("entrada_revisao_grok", async ({ ack, body, action, respond }) => {
    await ack();
    if (!somenteDono(body.user.id)) return;
    const id = (action as { value?: string }).value ?? "";
    const p = pendentes.mapa.get(id);
    const avisar = (text: string) => respond({ response_type: "ephemeral", replace_original: false, text });
    if (!p?.revisaoTs) {
      await avisar("Essa proposta expirou ou já foi registrada.");
      return;
    }
    if (p.revisaoPedida) {
      await avisar("Revisão já pedida: a resposta do Grok aparece aqui na conversa.");
      return;
    }
    try {
      await new WebClient(c.usuario).chat.postMessage({ channel: c.revisao, thread_ts: p.revisaoTs, text: `<@${c.grok}> revise` });
      pendentes.set(id, { ...p, revisaoPedida: true });
      await avisar("Pedido enviado ao Grok. A revisão aparece aqui na conversa.");
    } catch (err) {
      console.error(`${LOG} pedido ao Grok falhou:`, err instanceof Error ? err.message : err);
      await avisar(`Não consegui pedir a revisão (${err instanceof Error ? err.message : "erro"}). Responda \`@Grok revise\` no canal.`);
    }
  });

  acaoEntrada("entrada_bug");
  acaoEntrada("entrada_demanda");
  acaoEntrada("entrada_sugestao");
  acaoEntrada("entrada_descartar");

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
