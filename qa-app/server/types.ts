export type ProjectSlug = "polygonus" | "anihype";

export type ProductChannel = "app" | "web" | "portal";

/** Fluxo de bug reportado (Discord/gestor) */
export type BugStatus =
  | "rascunho"
  | "reportado"
  | "enviado_gestor"
  | "corrigido_gestor"
  | "homologado"
  | "nao_reproduzido"
  | "arquivado";

/** Resultado do teste dentro de uma homologação */
export type TestHomologationStatus = "pendente" | "passou" | "falhou" | "homologado";

/** Ciclo da homologação (campanha) */
export type HomologationCycleStatus = "em_andamento" | "concluida" | "pausada";

/** O que mudou na release homologada */
export type HomologationChangeScope = "backend" | "frontend" | "fullstack";

/** Manual (sem flow) ou automatizado (Maestro/Playwright vinculado) */
export type ExecutionMode = "manual" | "automated";

export interface HistoryEntry {
  at: string;
  actor: string;
  action: string;
  detail?: string;
  meta?: Record<string, unknown>;
}

export interface EvidenceFile {
  fileId: string;
  type: "screenshot" | "video" | "log";
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  label?: string;
  storageKey: string;
}

export interface AutomationLink {
  type: "maestro" | "playwright";
  flowPath: string;
  label?: string;
  /** draft = ainda mapeando no Studio · ready = validado 2× no emulador */
  readiness?: "draft" | "ready";
  lastRunAt?: string;
  lastRunStatus?: "idle" | "running" | "success" | "failed" | "cancelled";
  lastRunOutput?: string;
}

export interface TestRecord {
  id: string;
  testKey?: string;
  recordType?: "teste" | "bug";
  title: string;
  description: string;
  preconditions?: string;
  steps: string[];
  expectedResult?: string;
  actualResult?: string;
  reportedAt: string;
  homologatedAt?: string;
  project: ProjectSlug;
  channel?: ProductChannel;
  platform: "web" | "android" | "ios" | "api" | "outro";
  module?: string;
  campaign?: string;
  /** Status do fluxo de bug (só relevante quando recordType = bug) */
  status: BugStatus;
  /** Resultado de homologação (só relevante quando recordType = teste) */
  homologationStatus?: TestHomologationStatus;
  executionMode?: ExecutionMode;
  /** Homologação à qual este teste pertence */
  homologationId?: string;
  priority?: "baixa" | "media" | "alta" | "critica";
  severity?: "baixa" | "media" | "alta" | "critica";
  build?: string;
  osVersion?: string;
  deviceLabel?: string;
  technicalEvidence?: string;
  evidence?: EvidenceFile[];
  automation?: AutomationLink;
  comments?: Array<{ at: string; author: string; text: string }>;
  history: HistoryEntry[];
  showInPortfolio?: boolean;
  tags?: string[];
}

export interface TestCatalog {
  meta: { version: string; updatedAt: string; project: ProjectSlug };
  reports: TestRecord[];
}

export const PROJECTS: { slug: ProjectSlug; label: string }[] = [
  { slug: "polygonus", label: "Polygonus" },
  { slug: "anihype", label: "Anihype" },
];

export interface Homologation {
  id: string;
  slug: string;
  title: string;
  description?: string;
  project: ProjectSlug;
  channel?: ProductChannel;
  /** backend | frontend | fullstack (front + back) */
  changeScope?: HomologationChangeScope;
  status: HomologationCycleStatus;
  build?: string;
  campaign?: string;
  testKeys: string[];
  startedAt: string;
  finishedAt?: string;
  history: HistoryEntry[];
}

export interface HomologationCatalog {
  meta: { version: string; updatedAt: string; project: ProjectSlug };
  homologations: Homologation[];
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
    status: TestHomologationStatus;
    runsInHomologation: number;
    lastRunAt?: string;
    found: boolean;
    hasAutomation?: boolean;
    readiness?: "draft" | "ready";
  }>;
}
