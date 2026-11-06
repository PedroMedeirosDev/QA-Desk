/** Espelho das respostas de server/test-ficha.ts. */
export type ExecucaoResumo = {
  runId: string;
  status: string;
  startedAt: string;
  duracaoMs: number | null;
  appVersion: string | null;
  fonte: string | null;
  erro: string | null;
};

export type HistoricoExecucoes = {
  total: number;
  aprovacao: number | null;
  duracaoMediaMs: number | null;
  instavel: boolean;
  execucoes: ExecucaoResumo[];
};

export type ScriptDoCaso = { tipo: "maestro" | "playwright"; caminho: string; conteudo: string; trecho: boolean };

export const TEST_TYPE_LABELS = { funcional: "Funcional", regressao: "Regressão", smoke: "Smoke" } as const;
export const TEST_LEVEL_LABELS = { interface: "Interface (E2E)", api: "API" } as const;
