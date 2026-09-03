import type { DetailedStep } from "../lib/detailed-steps";

export type ProjectSlug = "polygonus" | "anihype" | "desk";

export type ProductChannel = "app" | "web" | "portal";

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

export type HomologationStatus =
  | "pendente"
  | "falta_evidencias"
  | "passou"
  | "falhou"
  | "homologado";

export type ExecutionMode = "manual" | "automated";

export interface HistoryEntry {
  at: string;
  actor: string;
  action: string;
  detail?: string;
  meta?: Record<string, unknown>;
}

/** Papel da evidência no relatório de homologação. */
export type EvidencePurpose =
  | "prova_ok"
  | "reproducao"
  | "antes_depois"
  | "contexto";

export const EVIDENCE_PURPOSE_LABELS: Record<EvidencePurpose, string> = {
  prova_ok: "Prova de OK",
  reproducao: "Reprodução do defeito",
  antes_depois: "Antes / depois",
  contexto: "Contexto",
};

export interface EvidenceFile {
  fileId: string;
  type: "screenshot" | "video" | "log";
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  storageKey: string;
  /** Papel no relatório (prova de OK, reprodução, etc.). */
  purpose?: EvidencePurpose;
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
  /** draft = ainda mapeando · ready = validado */
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
  platform: "web" | "android" | "ios" | "app_web" | "api" | "outro";
  module?: string;
  campaign?: string;
  status: BugStatus;
  homologationStatus?: HomologationStatus;
  executionMode?: ExecutionMode;
  homologationId?: string;
  priority?: "baixa" | "media" | "alta" | "critica";
  severity?: "baixa" | "media" | "alta" | "critica";
  build?: string;
  /** Ex.: API 33 — emulador Medium_Phone */
  osVersion?: string;
  /** Ex.: emulador, celular físico, emulador + celular */
  deviceLabel?: string;
  /** Amostra (CQ) vs app/portal em produção na unidade do cliente. */
  runtimeEnv?: "amostra" | "producao";
  /** Escola / unidade (produção ou demonstração). */
  unitLabel?: string;
  /** Ex.: Chrome, Edge, Playwright Chromium — report Web */
  browser?: string;
  /** Login do acesso (PHJESUS, CPF da responsável…). Desk mascara na UI; Repasse manda inteiro. */
  testLogin?: string;
  /**
   * Código público do bug por canal (APP-01, WEB-02…).
   * Distinto do `id` interno (BUG-2026-xxx) usado em storage/uploads.
   */
  bugCode?: string;
  /** Logs, JSON da API, stack — substitui "Console" no report mobile */
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
  /** Último comentário do gestor na issue (webhook issue_comment). */
  githubIssueLastCommentAt?: string;
  githubIssueLastCommentBy?: string;
  githubIssueLastCommentBody?: string;
  githubIssueLastCommentUrl?: string;
  /** Quando o QA abriu o bug depois desse comentário. Ausente = legado (não gritar). */
  githubIssueLastCommentSeenAt?: string;
}

export interface TestCatalog {
  meta: { version: string; updatedAt: string; project: ProjectSlug };
  reports: TestRecord[];
}

export const BUG_STATUS_LABELS: Record<BugStatus, string> = {
  rascunho: "Rascunho",
  reportado: "Reportado",
  enviado_gestor: "Enviado ao gestor",
  em_tratamento: "Em tratamento",
  corrigido_gestor: "Corrigido (gestor)",
  sem_correcao: "Sem correção agora",
  cancelado: "Cancelado",
  homologado: "Homologado",
  nao_reproduzido: "Não reproduzido",
  arquivado: "Arquivado",
};

export const RUNTIME_ENV_LABELS: Record<
  NonNullable<TestRecord["runtimeEnv"]>,
  string
> = {
  amostra: "Amostra",
  producao: "Produção",
};

export const SEVERITY_LABELS: Record<
  NonNullable<TestRecord["severity"]>,
  string
> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

export const PRIORITY_LABELS: Record<
  NonNullable<TestRecord["priority"]>,
  string
> = SEVERITY_LABELS;

export const HOMOLOGATION_LABELS: Record<HomologationStatus, string> = {
  pendente: "Pendente",
  falta_evidencias: "Falta evidências",
  passou: "Passou",
  falhou: "Falhou",
  homologado: "Homologado",
};

/** Default do papel da evidência a partir do status do CT. */
export function defaultEvidencePurpose(
  status?: HomologationStatus,
): EvidencePurpose {
  if (status === "passou" || status === "homologado") return "prova_ok";
  if (status === "falhou") return "reproducao";
  return "contexto";
}

export function evidencePurposeLabel(
  purpose: EvidencePurpose | undefined,
  fallbackStatus?: HomologationStatus,
): string {
  const resolved = purpose ?? defaultEvidencePurpose(fallbackStatus);
  return EVIDENCE_PURPOSE_LABELS[resolved];
}

export const RECORD_TYPE_LABELS: Record<NonNullable<TestRecord["recordType"]>, string> = {
  teste: "Teste",
  bug: "Bug encontrado",
};

export const CHANNEL_LABELS: Record<ProductChannel, string> = {
  app: "App",
  web: "WEB",
  portal: "PORTAL",
};

export const PLATFORM_LABELS: Record<TestRecord["platform"], string> = {
  android: "Android",
  ios: "iOS",
  web: "Web",
  app_web: "App nativo e APP WEB",
  api: "API",
  outro: "Outro",
};

export const EXECUTION_MODE_LABELS: Record<ExecutionMode, string> = {
  manual: "Manual",
  automated: "Automatizado",
};

export type AutomationReadiness = "draft" | "ready";

export const AUTOMATION_READINESS_LABELS: Record<AutomationReadiness, string> = {
  draft: "Rascunho",
  ready: "Estável",
};

export function getAutomationReadiness(
  record: Pick<TestRecord, "automation">,
  runner?: "maestro" | "playwright",
): AutomationReadiness | null {
  if (runner === "playwright") {
    if (!record.automation?.playwright?.specPath?.trim()) return null;
    return record.automation.playwright.readiness === "ready" ? "ready" : "draft";
  }
  if (runner === "maestro") {
    if (!record.automation?.flowPath?.trim()) return null;
    return record.automation.readiness === "ready" ? "ready" : "draft";
  }
  if (record.automation?.flowPath?.trim()) {
    return record.automation.readiness === "ready" ? "ready" : "draft";
  }
  if (record.automation?.playwright?.specPath?.trim()) {
    return record.automation.playwright.readiness === "ready" ? "ready" : "draft";
  }
  return null;
}

export function getExecutionMode(record: Pick<TestRecord, "executionMode" | "automation">): ExecutionMode {
  if (record.executionMode) return record.executionMode;
  const auto = record.automation;
  if (auto?.flowPath?.trim() || auto?.playwright?.specPath?.trim()) return "automated";
  return "manual";
}

/** Ex.: BUG-2026-001 → TEST-2026-001 */
export function formatTestId(id: string): string {
  return id.replace(/^BUG-/, "TEST-");
}

export function inferChannel(
  report: Pick<TestRecord, "channel" | "platform" | "project">,
): ProductChannel | undefined {
  if (report.channel) return report.channel;
  if (report.project !== "polygonus") return undefined;
  if (report.platform === "android" || report.platform === "ios" || report.platform === "app_web")
    return "app";
  if (report.platform === "web") return "web";
  return "app";
}

export function isTestCase(record: Pick<TestRecord, "recordType" | "campaign">): boolean {
  return (record.recordType ?? (record.campaign ? "teste" : "bug")) === "teste";
}

export function isBugReport(record: Pick<TestRecord, "recordType" | "campaign">): boolean {
  return !isTestCase(record);
}

/** Comentário novo do gestor ainda não aberto no Desk. */
export function isGestorReplyUnread(
  r: Pick<TestRecord, "githubIssueLastCommentAt" | "githubIssueLastCommentSeenAt">,
): boolean {
  const at = r.githubIssueLastCommentAt;
  if (!at) return false;
  const seen = r.githubIssueLastCommentSeenAt;
  if (!seen) return false;
  return seen < at;
}

/** Exibe BUG-… para bugs e TEST-… para casos de teste */
export function formatRecordId(
  id: string,
  record?: Pick<TestRecord, "recordType" | "campaign" | "bugCode">,
): string {
  if (record?.bugCode?.trim()) return record.bugCode.trim();
  const asBug = record ? isBugReport(record) : id.startsWith("BUG-");
  if (asBug) return id.replace(/^TEST-/, "BUG-");
  return id.replace(/^BUG-/, "TEST-");
}

/** Prefixo do código público do bug (APP / WEB / PORTAL / API). */
export function bugCodePrefix(
  channel?: ProductChannel,
  platform?: TestRecord["platform"],
): string {
  if (channel === "app") return "APP";
  if (channel === "web") return "WEB";
  if (channel === "portal") return "PORTAL";
  if (platform === "android" || platform === "ios" || platform === "app_web") return "APP";
  if (platform === "web") return "WEB";
  if (platform === "api") return "API";
  return "BUG";
}

export function displayStatus(
  record: TestRecord,
  runner?: "maestro" | "playwright",
): {
  label: string;
  tone: "neutral" | "ok" | "fail" | "warn";
} {
  if (isTestCase(record)) {
    if (runner === "playwright") {
      const st = record.automation?.playwright?.lastRunStatus;
      if (st === "success") return { label: "Passou", tone: "ok" };
      if (st === "failed") return { label: "Falhou", tone: "fail" };
      return { label: "Pendente", tone: "neutral" };
    }
    if (runner === "maestro") {
      const st = record.automation?.lastRunStatus;
      if (st === "success") return { label: "Passou", tone: "ok" };
      if (st === "failed") return { label: "Falhou", tone: "fail" };
    }
    const h = record.homologationStatus ?? "pendente";
    const tone =
      h === "passou" || h === "homologado"
        ? "ok"
        : h === "falhou"
          ? "fail"
          : h === "falta_evidencias"
            ? "warn"
            : "neutral";
    return { label: HOMOLOGATION_LABELS[h], tone };
  }
  const s = record.status;
  const tone =
    s === "homologado" || s === "corrigido_gestor"
      ? "ok"
      : s === "reportado" || s === "enviado_gestor" || s === "em_tratamento"
        ? "warn"
        : "neutral";
  return { label: BUG_STATUS_LABELS[s], tone };
}
