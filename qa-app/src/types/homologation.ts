import type { HistoryEntry, HomologationStatus, ProductChannel, ProjectSlug } from "./test-record";

export type HomologationCycleStatus = "em_andamento" | "concluida" | "pausada";

export type HomologationChangeScope = "backend" | "frontend" | "fullstack";

export interface Homologation {
  id: string;
  slug: string;
  title: string;
  description?: string;
  project: ProjectSlug;
  channel?: ProductChannel;
  changeScope?: HomologationChangeScope;
  status: HomologationCycleStatus;
  build?: string;
  campaign?: string;
  testKeys: string[];
  startedAt: string;
  finishedAt?: string;
  history: HistoryEntry[];
}

export interface HomologationProgress {
  homologationId: string;
  total: number;
  registered: number;
  passed: number;
  failed: number;
  pending: number;
  homologated: number;
  items: Array<{
    testKey: string;
    testId?: string;
    title: string;
    status: HomologationStatus;
    runsInHomologation: number;
    lastRunAt?: string;
    found: boolean;
    hasAutomation?: boolean;
    readiness?: "draft" | "ready";
  }>;
}

export interface HomologationWithProgress extends Homologation {
  progress: HomologationProgress;
}

export const HOMOLOGATION_CYCLE_LABELS: Record<HomologationCycleStatus, string> = {
  em_andamento: "Em andamento",
  concluida: "Concluída",
  pausada: "Pausada",
};

export const CHANGE_SCOPE_LABELS: Record<HomologationChangeScope, string> = {
  backend: "Backend",
  frontend: "Frontend",
  fullstack: "Front e back",
};

export function changeScopeBadgeClass(scope: HomologationChangeScope = "backend"): string {
  if (scope === "backend") {
    return "border-sky-500/40 bg-sky-500/15 text-sky-300";
  }
  if (scope === "frontend") {
    return "border-amber-500/40 bg-amber-500/15 text-amber-300";
  }
  return "border-violet-500/40 bg-violet-500/15 text-violet-200";
}
