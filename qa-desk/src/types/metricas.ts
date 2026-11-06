/** Espelho de server/metricas.ts (só agregados). */
export type MetricasQa = {
  periodoDias: number;
  casos: { total: number; automatizados: number; pctAutomatizado: number | null };
  porModulo: Array<{ modulo: string; total: number; automatizados: number }>;
  execucoes: {
    total: number;
    aprovacao: number | null;
    instaveis: number;
    duracaoMediaMs: number | null;
    duracaoTotalMs: number;
  };
  bugs: {
    total: number;
    abertos: number;
    porSeveridade: Record<"baixa" | "media" | "alta" | "critica" | "sem", number>;
    porOrigem: { automacao: number; manual: number };
    diasMedioAteHomologar: number | null;
  };
};
