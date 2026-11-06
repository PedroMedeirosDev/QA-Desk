/**
 * Demandas capturadas (Discord ou manual) — docs/CAPTURA_DISCORD.md.
 * Postgres (tabela `demandas`) quando há DATABASE_URL; JSON em data/projects/{slug}/demandas.json
 * como espelho ou como fonte no modo local.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import {
  codigoDemanda,
  tituloDoTexto,
  type Demanda,
  type DemandaAnexo,
  type DemandaOrigem,
  type DemandasCatalog,
  type DemandaStatus,
  type DemandaTipo,
  type PendenciaItem,
} from "../src/types/demanda.js";
import { DATA_ROOT } from "./data-paths.js";
import { isDatabaseEnabled } from "./db/config.js";
import { getPrisma } from "./db/prisma.js";
import { discordUrlKind, readGestorCasesCatalog } from "./gestor-cases.js";
import { redactPiiDeep } from "./privacy/redact-pii.js";
import { PROJECTS, type ProjectSlug } from "./types.js";

/** Quem recebe o Repasse: os casos pendentes dele entram na lista de pendências. */
const NOME_GESTOR = process.env.QA_GESTOR_NOME?.trim() || "Moacir";

const STATUS_VALIDOS: DemandaStatus[] = ["a_fazer", "fazendo", "aguardando", "feito"];

export class DemandaInvalidaError extends Error {}

function arquivo(project: ProjectSlug) {
  return path.join(DATA_ROOT, project, "demandas.json");
}

function catalogoVazio(project: ProjectSlug): DemandasCatalog {
  return { meta: { project, updatedAt: new Date().toISOString(), ultimoNumero: 0 }, demandas: [] };
}

function lerArquivo(project: ProjectSlug): DemandasCatalog {
  const f = arquivo(project);
  if (!fs.existsSync(f)) return catalogoVazio(project);
  return JSON.parse(fs.readFileSync(f, "utf8")) as DemandasCatalog;
}

function gravarArquivo(project: ProjectSlug, catalogo: DemandasCatalog) {
  const f = arquivo(project);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  catalogo.meta.updatedAt = new Date().toISOString();
  fs.writeFileSync(f, `${JSON.stringify(catalogo, null, 2)}\n`, "utf8");
}

async function garantirProjeto(project: ProjectSlug) {
  const label = PROJECTS.find((p) => p.slug === project)?.label ?? project;
  await getPrisma().project.upsert({
    where: { slug: project },
    create: { slug: project, label, metaVersion: "1.0.0" },
    update: {},
  });
}

async function lerCatalogo(project: ProjectSlug): Promise<DemandasCatalog> {
  if (!isDatabaseEnabled()) return lerArquivo(project);
  const rows = await getPrisma().demanda.findMany({
    where: { projectSlug: project },
    orderBy: { numero: "asc" },
  });
  const demandas = rows.map((r) => r.payload as unknown as Demanda);
  return {
    meta: {
      project,
      updatedAt: new Date().toISOString(),
      ultimoNumero: demandas.reduce((max, d) => Math.max(max, d.numero), 0),
    },
    demandas,
  };
}

async function gravarDemanda(project: ProjectSlug, demanda: Demanda) {
  if (isDatabaseEnabled()) {
    await garantirProjeto(project);
    const data = {
      id: demanda.id,
      projectSlug: project,
      numero: demanda.numero,
      status: demanda.status,
      comQuem: demanda.comQuem ?? null,
      payload: demanda as unknown as Prisma.InputJsonValue,
    };
    await getPrisma().demanda.upsert({ where: { id: demanda.id }, create: data, update: data });
  }
  // Espelho local (e fonte no modo JSON).
  const catalogo = lerArquivo(project);
  const idx = catalogo.demandas.findIndex((d) => d.id === demanda.id);
  if (idx >= 0) catalogo.demandas[idx] = demanda;
  else catalogo.demandas.push(demanda);
  catalogo.meta.ultimoNumero = Math.max(catalogo.meta.ultimoNumero, demanda.numero);
  gravarArquivo(project, catalogo);
}

export async function listarDemandas(project: ProjectSlug): Promise<Demanda[]> {
  return (await lerCatalogo(project)).demandas;
}

/** Aceita o id interno ou o código público (D-014, d14, 14). */
export async function buscarDemanda(project: ProjectSlug, ref: string): Promise<Demanda | undefined> {
  const demandas = await listarDemandas(project);
  const porId = demandas.find((d) => d.id === ref);
  if (porId) return porId;
  const numero = Number(ref.replace(/^[ds]-?/i, ""));
  return Number.isFinite(numero) ? demandas.find((d) => d.numero === numero) : undefined;
}

export type NovaDemanda = {
  texto: string;
  titulo?: string;
  status?: DemandaStatus;
  comQuem?: string;
  solicitante?: string;
  origem?: DemandaOrigem;
  anexos?: DemandaAnexo[];
  tipo?: DemandaTipo;
  prazo?: string;
  reuniao?: string;
};

const PRAZO_RE = /^\d{4}-\d{2}-\d{2}$/;

function validarPrazo(prazo?: string) {
  if (prazo && !PRAZO_RE.test(prazo)) throw new DemandaInvalidaError("prazo deve ser AAAA-MM-DD");
}

function validarStatus(status: DemandaStatus, comQuem?: string) {
  if (!STATUS_VALIDOS.includes(status)) throw new DemandaInvalidaError(`status inválido: ${status}`);
  if (status === "aguardando" && !comQuem?.trim()) {
    throw new DemandaInvalidaError("informe com quem a demanda está aguardando");
  }
}

export async function criarDemanda(project: ProjectSlug, input: NovaDemanda, actor: string): Promise<Demanda> {
  const texto = input.texto?.trim() ?? "";
  if (!texto && !input.anexos?.length) throw new DemandaInvalidaError("demanda sem texto nem anexo");
  const status = input.status ?? "a_fazer";
  const comQuem = input.comQuem?.trim() || undefined;
  validarStatus(status, comQuem);
  validarPrazo(input.prazo);
  const tipo = input.tipo ?? "demanda";

  const agora = new Date().toISOString();
  const numero = (await lerCatalogo(project)).meta.ultimoNumero + 1;
  const demanda: Demanda = redactPiiDeep({
    id: randomUUID(),
    numero,
    codigo: codigoDemanda(numero, tipo),
    tipo,
    prazo: input.prazo || undefined,
    reuniao: input.reuniao?.trim() || undefined,
    sugestaoStatus: tipo === "sugestao" ? "enviada" : undefined,
    concluidaEm: status === "feito" ? agora : undefined,
    titulo: input.titulo?.trim() || tituloDoTexto(texto),
    texto,
    status,
    comQuem,
    aguardandoDesde: status === "aguardando" ? agora : undefined,
    solicitante: input.solicitante?.trim() || undefined,
    origem: input.origem ?? { tipo: "manual" },
    anexos: input.anexos ?? [],
    criadaEm: agora,
    atualizadaEm: agora,
    historico: [
      {
        at: agora,
        actor,
        action: "demanda_criada",
        detail: input.origem?.tipo === "discord" ? "Capturada pelo Discord" : "Criada no QA Desk",
      },
    ],
  });
  await gravarDemanda(project, demanda);
  return demanda;
}

export type AlteracaoDemanda = Partial<
  Pick<Demanda, "titulo" | "texto" | "status" | "comQuem" | "bugId" | "rascunhoIa" | "prazo" | "reuniao" | "sugestaoStatus">
>;

export async function atualizarDemanda(
  project: ProjectSlug,
  ref: string,
  alteracao: AlteracaoDemanda,
  actor: string,
): Promise<Demanda | undefined> {
  const atual = await buscarDemanda(project, ref);
  if (!atual) return undefined;
  const agora = new Date().toISOString();
  const status = alteracao.status ?? atual.status;
  const comQuem = alteracao.comQuem !== undefined ? alteracao.comQuem.trim() || undefined : atual.comQuem;
  validarStatus(status, comQuem);
  validarPrazo(alteracao.prazo);

  const proxima: Demanda = { ...atual, ...alteracao, status, comQuem, atualizadaEm: agora };
  if (alteracao.prazo === "") proxima.prazo = undefined;
  if (status === "feito" && atual.status !== "feito") proxima.concluidaEm = agora;
  if (status !== "feito") proxima.concluidaEm = undefined;
  if (alteracao.sugestaoStatus && alteracao.sugestaoStatus !== atual.sugestaoStatus) {
    proxima.historico = [
      ...(proxima.historico ?? atual.historico),
      { at: agora, actor, action: "sugestao_status", detail: `${atual.sugestaoStatus ?? "—"} → ${alteracao.sugestaoStatus}` },
    ];
  }
  const passouAAguardar = status === "aguardando" && (atual.status !== "aguardando" || comQuem !== atual.comQuem);
  if (passouAAguardar) proxima.aguardandoDesde = agora;
  if (status !== "aguardando") proxima.aguardandoDesde = undefined;

  if (status !== atual.status || comQuem !== atual.comQuem) {
    proxima.historico = [
      ...(proxima.historico ?? atual.historico),
      {
        at: agora,
        actor,
        action: "demanda_status",
        detail: `${atual.status} → ${status}${status === "aguardando" && comQuem ? ` (com ${comQuem})` : ""}`,
      },
    ];
  }
  const segura = redactPiiDeep(proxima);
  await gravarDemanda(project, segura);
  return segura;
}

/** Registra uma cobrança (botão "Cobrei"). */
export async function registrarCobranca(project: ProjectSlug, ref: string, actor: string): Promise<Demanda | undefined> {
  const atual = await buscarDemanda(project, ref);
  if (!atual) return undefined;
  const agora = new Date().toISOString();
  const proxima: Demanda = {
    ...atual,
    cobrancas: [...(atual.cobrancas ?? []), agora],
    atualizadaEm: agora,
    historico: [...atual.historico, { at: agora, actor, action: "demanda_cobrada", detail: atual.comQuem ? `Cobrado com ${atual.comQuem}` : "Cobrado" }],
  };
  await gravarDemanda(project, proxima);
  return proxima;
}

/** Pessoas já usadas em `comQuem`, mais o gestor (Repasse). */
export async function pessoasConhecidas(project: ProjectSlug): Promise<string[]> {
  const nomes = new Set<string>([NOME_GESTOR]);
  for (const d of await listarDemandas(project)) if (d.comQuem) nomes.add(d.comQuem);
  return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function mesmoNome(a?: string, b?: string) {
  return Boolean(a && b) && a!.trim().toLocaleLowerCase("pt-BR") === b!.trim().toLocaleLowerCase("pt-BR");
}

/** "O que eu tenho de pendência com você?" — demandas aguardando a pessoa + Repasse pendente (gestor). */
export async function listarPendencias(project: ProjectSlug, comQuem: string): Promise<PendenciaItem[]> {
  const itens: PendenciaItem[] = (await listarDemandas(project))
    .filter((d) => d.status === "aguardando" && mesmoNome(d.comQuem, comQuem))
    .map((d) => ({
      fonte: "demanda" as const,
      ref: d.codigo,
      titulo: d.titulo,
      link: d.origem.linkOriginal ?? d.origem.linkCaptura,
      desde: d.aguardandoDesde ?? d.atualizadaEm,
    }));

  if (mesmoNome(comQuem, NOME_GESTOR)) {
    for (const c of readGestorCasesCatalog(project).cases) {
      if (c.status !== "pendente") continue;
      itens.push({
        fonte: "repasse",
        ref: `${c.author} #${c.number}`,
        titulo: c.title,
        link: c.discordUrl && discordUrlKind(c.discordUrl) === "message" ? c.discordUrl : undefined,
        desde: c.createdAt,
      });
    }
  }
  return itens.sort((a, b) => a.desde.localeCompare(b.desde));
}
