import type { HistoryEntry, ProjectSlug } from "./test-record";

/** Ciclo da demanda (docs/CAPTURA_DISCORD.md). */
export type DemandaStatus = "a_fazer" | "fazendo" | "aguardando" | "feito";

export const DEMANDA_STATUS_ORDER: DemandaStatus[] = ["a_fazer", "fazendo", "aguardando", "feito"];

export const DEMANDA_STATUS_LABELS: Record<DemandaStatus, string> = {
  a_fazer: "A fazer",
  fazendo: "Fazendo",
  aguardando: "Aguardando",
  feito: "Feito",
};

export interface DemandaAnexo {
  fileId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
}

export interface DemandaOrigem {
  tipo: "discord" | "manual";
  /** Mensagem original no servidor de onde veio (o que vai na lista para a pessoa). */
  linkOriginal?: string;
  /** Mensagem no servidor pessoal (a cópia encaminhada). */
  linkCaptura?: string;
  autor?: string;
  dataOriginal?: string;
  /** Parte do texto veio de OCR do print — pode ter dígitos trocados. */
  textoDoPrint?: boolean;
}

export type RascunhoIaTipo = "gherkin" | "bug_v2";

export interface RascunhoIa {
  tipo: RascunhoIaTipo;
  texto: string;
  geradoEm: string;
}

export interface Demanda {
  id: string;
  /** Sequencial por projeto; `codigo` é o formato público (D-001). */
  numero: number;
  codigo: string;
  titulo: string;
  texto: string;
  status: DemandaStatus;
  /** De quem a demanda depende; obrigatório em `aguardando`. */
  comQuem?: string;
  /** Desde quando depende de `comQuem` (ordem da lista de pendências). */
  aguardandoDesde?: string;
  solicitante?: string;
  origem: DemandaOrigem;
  anexos: DemandaAnexo[];
  bugId?: string;
  rascunhoIa?: RascunhoIa;
  criadaEm: string;
  atualizadaEm: string;
  historico: HistoryEntry[];
}

export interface DemandasCatalog {
  meta: { project: ProjectSlug; updatedAt: string; ultimoNumero: number };
  demandas: Demanda[];
}

/** Item da lista "o que eu tenho de pendência com você?". */
export interface PendenciaItem {
  fonte: "demanda" | "repasse";
  ref: string;
  titulo: string;
  link?: string;
  desde: string;
}

export function codigoDemanda(numero: number): string {
  return `D-${String(numero).padStart(3, "0")}`;
}

/** Primeira linha com texto, até 120 caracteres. */
export function tituloDoTexto(texto: string): string {
  const linha = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find(Boolean);
  if (!linha) return "(sem título)";
  return linha.length > 120 ? `${linha.slice(0, 117)}…` : linha;
}

/** Texto para colar no Discord: só nome e link, numerado. */
export function formatarListaPendencias(itens: PendenciaItem[]): string {
  return itens.map((item, i) => `${i + 1}. ${item.titulo}${item.link ? ` — ${item.link}` : ""}`).join("\n");
}
