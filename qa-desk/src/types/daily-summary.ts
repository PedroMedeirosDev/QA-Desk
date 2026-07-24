export type DailyIntent =
  | "homologacao"
  | "bugfix"
  | "smoke"
  | "exploratorio"
  | "curadoria_kb";

export const DAILY_INTENT_LABELS: Record<DailyIntent, string> = {
  homologacao: "Homologação",
  bugfix: "Bugfix",
  smoke: "Smoke",
  exploratorio: "Exploratório",
  curadoria_kb: "Curadoria KB",
};

export const DAILY_INTENTS: DailyIntent[] = [
  "homologacao",
  "bugfix",
  "smoke",
  "exploratorio",
  "curadoria_kb",
];

export type DailyTool = "maestro" | "playwright" | "manual" | "other";

export type DailySummaryHighlight = {
  kind: "automated" | "manual" | "homologation" | "kb";
  label: string;
  status?: string;
  tool?: DailyTool;
  testKey?: string;
};

export type DailySummary = {
  date: string;
  project: string;
  timezone: "America/Sao_Paulo";
  generatedAt: string;
  showInPortfolio: boolean;
  fromSnapshot: boolean;
  intents: DailyIntent[];
  note?: string;
  automated: {
    total: number;
    passed: number;
    failed: number;
    cancelled: number;
    byTool: { maestro: number; playwright: number; other: number };
  };
  manual: {
    total: number;
    passed: number;
    failed: number;
    homologated: number;
  };
  homologations: {
    created: number;
    statusChanges: number;
    titles: string[];
  };
  kbCuration: {
    reviewed: number;
    merged: number;
    blocked: number;
    imported: number;
  };
  highlights: DailySummaryHighlight[];
};

export type DailyPortfolioCard = {
  date: string;
  intents: DailyIntent[];
  note?: string;
  automatedTotal: number;
  manualTotal: number;
  kbReviewed: number;
  kbMerged: number;
  showInPortfolio: true;
};
