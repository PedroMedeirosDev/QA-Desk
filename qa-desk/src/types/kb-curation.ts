type ProjectSlug = "polygonus" | "anihype";

interface HistoryEntry {
  at: string;
  actor: string;
  action: string;
  detail?: string;
  meta?: Record<string, unknown>;
}

export type KbCurationGithubState = "open" | "closed" | "merged";
export type KbCurationStatus =
  | "aguardando_revisao"
  | "aguardando_correcao"
  | "aguardando_rerevisao"
  | "aprovada"
  | "mesclada"
  | "bloqueada"
  /** Fechada no GitHub sem merge (ex.: empilhada / base apagada). */
  | "fechada"
  /** @deprecated legado — normalizado para aguardando_revisao */
  | "pendente"
  /** @deprecated legado — normalizado para aguardando_revisao */
  | "em_revisao";
export type KbCurationVerdict =
  | "aprovavel"
  | "precisa_correcao"
  | "bloqueado"
  | "inconclusivo";

export interface KbCurationRecord {
  id: string;
  project: ProjectSlug;
  repository: string;
  prNumber: number;
  title: string;
  url: string;
  githubState: KbCurationGithubState;
  status: KbCurationStatus;
  verdict: KbCurationVerdict;
  summary?: string;
  solutionReview?: string;
  corrections?: string[];
  reviewer?: string;
  githubCreatedAt?: string;
  githubUpdatedAt?: string;
  reviewedAt?: string;
  mergedAt?: string;
  mergeCommitSha?: string;
  lastSyncedAt?: string;
  history: HistoryEntry[];
}

export interface KbCurationCatalog {
  meta: {
    version: string;
    updatedAt: string;
    project: ProjectSlug;
    repository: string;
  };
  pullRequests: KbCurationRecord[];
}

export interface KbCurationMetrics {
  total: number;
  awaitingReview: number;
  awaitingCorrection: number;
  awaitingRereview: number;
  approved: number;
  merged: number;
  blocked: number;
  /** PRs fechadas no GitHub sem merge (`status: fechada`). */
  closedUnmerged: number;
  completionPercent: number;
  /** @deprecated use awaitingReview */
  pending?: number;
  /** @deprecated use awaitingReview */
  inReview?: number;
}
