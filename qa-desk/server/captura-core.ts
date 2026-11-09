/**
 * Núcleo da captura (Discord e Slack): guarda anexos, lê prints por OCR local,
 * e cria demanda ou bug em rascunho. O filtro de dados sensíveis roda na gravação.
 */
import { randomUUID } from "node:crypto";
import { tituloDoTexto, type DemandaAnexo, type DemandaTipo } from "../src/types/demanda.js";
import { criarDemanda } from "./demandas.js";
import { ehImagem, lerTextoDosPrints } from "./ocr.js";
import { appendHistory, nextBugCode, nextBugId, readCatalog, writeCatalog } from "./storage.js";
import { makeStoredEvidenceFilename, uploadEvidenceBuffer } from "./supabase-storage.js";
import type { EvidenceFile, ProjectSlug, TestRecord } from "./types.js";

export type FonteCaptura = "discord" | "slack";

export type AnexoCaptura = {
  url: string;
  name: string;
  contentType?: string | null;
  size: number;
  /** Slack: arquivo privado exige Authorization. */
  headers?: Record<string, string>;
};

export type ConteudoCaptura = {
  texto: string;
  anexos: AnexoCaptura[];
  linkOriginal?: string;
  linkCaptura: string;
  dataOriginal?: string;
};

export type ResultadoCaptura = { codigo: string; resposta: string; pulados: string[] };

const PROJETO: ProjectSlug = "polygonus";
const MAX_ANEXOS = 10;
const MAX_BYTES = 20 * 1024 * 1024;
const NOME_FONTE: Record<FonteCaptura, string> = { discord: "Discord", slack: "Slack" };

export function urlPublica(caminho: string): string {
  const base = (process.env.QA_DESK_PUBLIC_URL?.trim() || "https://qa-desk-pedro.duckdns.org").replace(/\/$/, "");
  return `${base}${caminho}`;
}

function tipoEvidencia(mime: string, nome: string): EvidenceFile["type"] {
  if (/^video\//.test(mime) || /\.(mp4|webm|mov|mkv)$/i.test(nome)) return "video";
  if (/^image\//.test(mime) || /\.(png|jpe?g|webp|gif)$/i.test(nome)) return "screenshot";
  return "log";
}

/** Baixa da origem (links expiram) e guarda no Storage do QA Desk. */
async function guardarAnexos(pasta: string, anexos: AnexoCaptura[]) {
  const guardados: Array<DemandaAnexo & { type: EvidenceFile["type"] }> = [];
  const imagens: Buffer[] = [];
  const pulados: string[] = [];
  for (const a of anexos.slice(0, MAX_ANEXOS)) {
    if (a.size > MAX_BYTES) {
      pulados.push(a.name);
      continue;
    }
    const resp = await fetch(a.url, a.headers ? { headers: a.headers } : undefined);
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
    console.error("[captura] OCR falhou (segue só com o anexo):", err instanceof Error ? err.message : err);
    return "";
  }
}

/** Só lê os prints (OCR local), sem guardar nada — usado para classificar antes de registrar. */
export async function lerTextoDoConteudo(conteudo: ConteudoCaptura): Promise<string> {
  const imagens: Buffer[] = [];
  for (const a of conteudo.anexos.slice(0, MAX_ANEXOS)) {
    if (a.size > MAX_BYTES || !ehImagem(a.contentType ?? "", a.name)) continue;
    const resp = await fetch(a.url, a.headers ? { headers: a.headers } : undefined);
    if (resp.ok) imagens.push(Buffer.from(await resp.arrayBuffer()));
  }
  return imagens.length ? lerPrintsComSeguranca(imagens) : "";
}

/** Já decidido antes (classificação confirmada): evita reler o print e fixa tipo/título. */
export type OpcoesCaptura = { tipo?: DemandaTipo; titulo?: string; lido?: string };

export async function capturarDemanda(
  conteudo: ConteudoCaptura,
  fonte: FonteCaptura,
  opcoes: OpcoesCaptura = {},
): Promise<ResultadoCaptura> {
  const { guardados, imagens, pulados } = await guardarAnexos(`demanda-${randomUUID()}`, conteudo.anexos);
  const lido = opcoes.lido ?? (await lerPrintsComSeguranca(imagens));
  const demanda = await criarDemanda(
    PROJETO,
    {
      texto: montarTexto(conteudo.texto, lido),
      ...(opcoes.tipo ? { tipo: opcoes.tipo } : {}),
      ...(opcoes.titulo ? { titulo: opcoes.titulo } : {}),
      origem: {
        tipo: fonte,
        linkOriginal: conteudo.linkOriginal,
        linkCaptura: conteudo.linkCaptura,
        dataOriginal: conteudo.dataOriginal,
        ...(lido ? { textoDoPrint: true } : {}),
      },
      anexos: guardados.map(({ type: _t, ...a }) => a),
    },
    fonte,
  );
  const avisoOcr = lido ? "\nTexto lido do print: confira números e nomes." : "";
  return {
    codigo: demanda.codigo,
    resposta: `${demanda.codigo} · ${demanda.titulo}${avisoOcr}\n${urlPublica(`/projects/${PROJETO}/demandas/${demanda.codigo}`)}`,
    pulados,
  };
}

export async function capturarBug(
  conteudo: ConteudoCaptura,
  fonte: FonteCaptura,
  opcoes: Omit<OpcoesCaptura, "tipo"> = {},
): Promise<ResultadoCaptura> {
  const catalogo = await readCatalog(PROJETO);
  const id = nextBugId(PROJETO, catalogo);
  const { guardados, imagens, pulados } = await guardarAnexos(id, conteudo.anexos);
  // Print de bug costuma ser tela do app: só vale ler quando não veio texto nenhum.
  const lido = conteudo.texto ? "" : (opcoes.lido ?? (await lerPrintsComSeguranca(imagens)));
  const texto = montarTexto(conteudo.texto, lido);
  const agora = new Date().toISOString();
  const origem = conteudo.linkOriginal ? `\n\nOrigem: ${conteudo.linkOriginal}` : "";
  const bug: TestRecord = {
    id,
    recordType: "bug",
    bugCode: nextBugCode(catalogo, "app", "android"),
    title: opcoes.titulo || tituloDoTexto(texto) || `Bug capturado pelo ${NOME_FONTE[fonte]}`,
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
    tags: [`captura:${fonte}`],
  };
  appendHistory(bug, { actor: fonte, action: "test_created", detail: `Bug capturado pelo ${NOME_FONTE[fonte]} (rascunho)` });
  catalogo.reports.unshift(bug);
  await writeCatalog(PROJETO, catalogo);
  return {
    codigo: bug.bugCode ?? id,
    resposta: `${bug.bugCode} · rascunho · ${bug.title}\n${urlPublica(`/projects/${PROJETO}/app/bugs/${id}`)}`,
    pulados,
  };
}
