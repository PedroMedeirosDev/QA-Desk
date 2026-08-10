import type { DetailedStep } from "./detailed-steps.js";

export type ProjectSlug = "polygonus" | "anihype" | "desk";

export type ProductChannel = "app" | "web" | "portal";

/** Fluxo de bug reportado (Discord/gestor) */
export type BugStatus =
  | "rascunho"
  | "reportado"
  | "enviado_gestor"
  | "em_tratamento"
  | "corrigido_gestor"
  | "sem_correcao"
  | "cancelado"
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

export interface AutomationPrep {
  type: "playwright";
  /** Relativo à raiz do repo */
  specPath: string;
  /** Default true (Turnstile / amostra) */
  headed?: boolean;
}

/** Alvo Playwright completo (alternativa ao Maestro no mesmo CT). */
export interface AutomationPlaywrightTarget {
  /** Relativo à raiz do repo */
  specPath: string;
  /** Default true */
  headed?: boolean;
  readiness?: "draft" | "ready";
  lastRunAt?: string;
  lastRunStatus?: "idle" | "running" | "success" | "failed" | "cancelled";
  lastRunOutput?: string;
}

export interface AutomationLink {
  type: "maestro" | "playwright";
  /** Flow Maestro (emulador). Opcional se só houver alvo Playwright. */
  flowPath?: string;
  label?: string;
  /** Seed web antes do Maestro (ex.: DN Aniversariante) — não é o teste Web completo */
  prep?: AutomationPrep;
  /** Spec Playwright como executor alternativo (Web / Flutter Web) */
  playwright?: AutomationPlaywrightTarget;
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
  /** Resumo enxuto (QA / Discord / automação) */
  steps: string[];
  /** Passo a passo detalhado (1 ação = 1 linha) + âncoras Maestro opcionais */
  stepsDetailed?: DetailedStep[];
  /** @deprecated use stepsDetailed */
  stepsManual?: string[];
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
  /** Ex.: Chrome, Edge, Playwright Chromium — report Web */
  browser?: string;
  /** Login usado no teste (ex.: PHJESUS, ETMENEZES) — report */
  testLogin?: string;
  /**
   * Código público do bug por canal (APP-01, WEB-02…).
   * Distinto do `id` interno (BUG-2026-xxx) usado em storage/uploads.
   */
  bugCode?: string;
  technicalEvidence?: string;
  evidence?: EvidenceFile[];
  automation?: AutomationLink;
  comments?: Array<{ at: string; author: string; text: string }>;
  history: HistoryEntry[];
  showInPortfolio?: boolean;
  /**
   * QA marcou o script como confiável para falha ≈ bug de produto.
   * Manual — não confundir com `automation.readiness` (auto após 2 passes).
   */
  consolidated?: boolean;
  tags?: string[];
  /** Mensagem Discord vinculada (legado — handoff oficial é GitHub Issue) */
  discordMessageId?: string;
  discordChannelId?: string;
  discordSentAt?: string;
  /** Issue no repo KB (label bug) — handoff ao time / agente */
  githubIssueNumber?: number;
  githubIssueUrl?: string;
  githubIssueCreatedAt?: string;
  /** Quando a issue vinculada foi fechada (webhook). */
  githubIssueClosedAt?: string;
}

export interface TestCatalog {
  meta: { version: string; updatedAt: string; project: ProjectSlug };
  reports: TestRecord[];
}

export const PROJECTS: { slug: ProjectSlug; label: string }[] = [
  { slug: "desk", label: "QA Desk" },
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
    /** Bloco/suite (ex.: CRUD, Anexos) — para agrupar na UI */
    suite?: string;
    status: TestHomologationStatus;
    runsInHomologation: number;
    lastRunAt?: string;
    found: boolean;
    hasAutomation?: boolean;
    hasMaestro?: boolean;
    hasPlaywright?: boolean;
    readiness?: "draft" | "ready";
    playwrightReadiness?: "draft" | "ready";
  }>;
}
