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
  tipo: "discord" | "slack" | "manual";
  /** Mensagem original no servidor de onde veio (o que vai na lista para a pessoa). */
  linkOriginal?: string;
  /** Mensagem no servidor pessoal (a cópia encaminhada). */
  linkCaptura?: string;
  autor?: string;
  dataOriginal?: string;
  /** Parte do texto veio de OCR do print — pode ter dígitos trocados. */
  textoDoPrint?: boolean;
  /** Canal da captura ("#entrada", "#demandas"); ausente = #demandas do Discord. */
  canal?: string;
}

export type RascunhoIaTipo = "gherkin" | "bug_v2";

export interface RascunhoIa {
  tipo: RascunhoIaTipo;
  texto: string;
  geradoEm: string;
}

export type DemandaTipo = "demanda" | "sugestao";

/** Sugestão de melhoria: o ciclo é o do retorno, não o da execução. */
export type SugestaoStatus = "enviada" | "sem_retorno" | "aceita" | "recusada" | "implementada";

export const SUGESTAO_STATUS_LABELS: Record<SugestaoStatus, string> = {
  enviada: "Enviada",
  sem_retorno: "Sem retorno",
  aceita: "Aceita",
  recusada: "Recusada",
  implementada: "Implementada",
};

export interface Demanda {
  id: string;
  /** Ausente = demanda (registros antigos). */
  tipo?: DemandaTipo;
  /** Data de entrega combinada (YYYY-MM-DD). */
  prazo?: string;
  /** Agrupador: "Reunião com escola A · 05/11". */
  reuniao?: string;
  /** Quando passou para "feito" (prometido × entregue no prazo). */
  concluidaEm?: string;
  sugestaoStatus?: SugestaoStatus;
  /** Datas em que o Pedro cobrou (botão "Cobrei" no Slack ou na tela). */
  cobrancas?: string[];
  /** Ordem interna, única no projeto (chave do banco). */
  numero: number;
  /** Sequencial dentro do tipo (D-001…, S-001…); ausente = `numero` (registros antigos). */
  sequencial?: number;
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

export function codigoDemanda(numero: number, tipo: DemandaTipo = "demanda"): string {
  return `${tipo === "sugestao" ? "S" : "D"}-${String(numero).padStart(3, "0")}`;
}

export function sequencialDe(d: Pick<Demanda, "sequencial" | "numero">): number {
  return d.sequencial ?? d.numero;
}

/** Próximo número dentro do tipo: demandas e sugestões contam separado. */
export function proximoSequencial(demandas: Demanda[], tipo: DemandaTipo): number {
  return demandas.filter((d) => (d.tipo ?? "demanda") === tipo).reduce((max, d) => Math.max(max, sequencialDe(d)), 0) + 1;
}

/** "S-001" / "s1" → sugestão 1; "D-014" / "14" → demanda 14. */
export function interpretarCodigo(ref: string): { tipo: DemandaTipo; sequencial: number } | null {
  const m = ref.trim().match(/^([ds])?-?0*(\d+)$/i);
  if (!m) return null;
  return { tipo: m[1]?.toLowerCase() === "s" ? "sugestao" : "demanda", sequencial: Number(m[2]) };
}

export type ResumoPrazos = { vencemHoje: Demanda[]; atrasadas: Demanda[]; proximos: Demanda[] };

/** Demandas abertas com prazo: vencem hoje, atrasadas e nos próximos `dias` dias. `hoje` em YYYY-MM-DD. */
export function resumirPrazos(demandas: Demanda[], hoje: string, dias = 3): ResumoPrazos {
  const limite = new Date(`${hoje}T00:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() + dias);
  const ate = limite.toISOString().slice(0, 10);
  const abertas = demandas.filter((d) => d.prazo && d.status !== "feito" && (d.tipo ?? "demanda") === "demanda");
  const ordenar = (lista: Demanda[]) => lista.sort((a, b) => (a.prazo ?? "").localeCompare(b.prazo ?? ""));
  return {
    vencemHoje: ordenar(abertas.filter((d) => d.prazo === hoje)),
    atrasadas: ordenar(abertas.filter((d) => d.prazo! < hoje)),
    proximos: ordenar(abertas.filter((d) => d.prazo! > hoje && d.prazo! <= ate)),
  };
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
