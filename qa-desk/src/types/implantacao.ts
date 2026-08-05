/** Tipos de implantação — anotações operacionais (não são CTs). */

export type ImplantacaoRequisitoTipo =
  | "sql"
  | "config"
  | "manual"
  | "aviso"
  | "outro";

export type ImplantacaoExecutor = "dba" | "suporte" | "qa" | "dev" | "outro";

export type ImplantacaoStatus = "ativo" | "arquivado";

export interface ImplantacaoRequisito {
  id: string;
  ordem: number;
  titulo: string;
  detalhe: string;
  tipo: ImplantacaoRequisitoTipo;
  /** Quem tipicamente executa (QA pode só anotar / escalar). */
  executor: ImplantacaoExecutor;
  obrigatorio: boolean;
  fonte?: string;
  fonteEm?: string;
  notas?: string;
}

export interface ImplantacaoTipo {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: ImplantacaoStatus;
  requisitos: ImplantacaoRequisito[];
  createdAt: string;
  updatedAt: string;
}

export interface ImplantacaoCatalog {
  meta: {
    project: string;
    updatedAt: string;
  };
  tipos: ImplantacaoTipo[];
}

export const REQUISITO_TIPO_LABELS: Record<ImplantacaoRequisitoTipo, string> = {
  sql: "SQL / script",
  config: "Configuração",
  manual: "Passo manual",
  aviso: "Aviso",
  outro: "Outro",
};

export const EXECUTOR_LABELS: Record<ImplantacaoExecutor, string> = {
  dba: "DBA / banco",
  suporte: "Suporte",
  qa: "QA",
  dev: "Dev",
  outro: "Outro",
};
