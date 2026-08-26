import type {
  BugStatus,
  ExecutionMode,
  HistoryEntry,
  HomologationStatus,
  ProductChannel,
  ProjectSlug,
} from "./test-record";

export type HomologationCycleStatus = "em_andamento" | "concluida" | "pausada";

export type HomologationChangeScope = "backend" | "frontend" | "fullstack";

export interface Homologation {
  id: string;
  slug: string;
  title: string;
  description?: string;
  /** Briefing da campanha (markdown leve) — exporta no HTML do escopo. */
  scope?: string;
  project: ProjectSlug;
  channel?: ProductChannel;
  changeScope?: HomologationChangeScope;
  status: HomologationCycleStatus;
  build?: string;
  campaign?: string;
  /** Chaves de CT (não incluir bugs — bugs vão em bugs[] do progresso / homologationId). */
  testKeys: string[];
  startedAt: string;
  finishedAt?: string;
  history: HistoryEntry[];
}

/** Bug encontrado durante a campanha (lista separada dos CTs). */
export interface HomologationLinkedBug {
  bugId: string;
  bugCode?: string;
  title: string;
  status: BugStatus;
  channel?: ProductChannel;
  priority?: "baixa" | "media" | "alta" | "critica";
  testKey?: string;
}

export interface HomologationProgress {
  homologationId: string;
  total: number;
  registered: number;
  passed: number;
  failed: number;
  pending: number;
  /** CT testado, mas ainda sem prova suficiente para fechar. */
  needsEvidence: number;
  homologated: number;
  items: Array<{
    testKey: string;
    testId?: string;
    title: string;
    /** Bloco/suite (ex.: CRUD, Anexos) — para agrupar na UI */
    suite?: string;
    status: HomologationStatus;
    /** Modo do CT (manual × automatizado) — para badge na lista. */
    executionMode?: ExecutionMode;
    runsInHomologation: number;
    lastRunAt?: string;
    playwrightLastRunAt?: string;
    maestroLastRunStatus?: "idle" | "running" | "success" | "failed" | "cancelled";
    playwrightLastRunStatus?: "idle" | "running" | "success" | "failed" | "cancelled";
    found: boolean;
    hasAutomation?: boolean;
    hasMaestro?: boolean;
    hasPlaywright?: boolean;
    readiness?: "draft" | "ready";
    playwrightReadiness?: "draft" | "ready";
  }>;
  /** Bugs vinculados à campanha (não entram no contador de CTs). */
  bugs: HomologationLinkedBug[];
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
