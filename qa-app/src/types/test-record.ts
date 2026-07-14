export type ProjectSlug = "polygonus" | "anihype";

export type ProductChannel = "app" | "web" | "portal";

export type BugStatus =
  | "rascunho"
  | "reportado"
  | "enviado_gestor"
  | "corrigido_gestor"
  | "homologado"
  | "nao_reproduzido"
  | "arquivado";

export type HomologationStatus = "pendente" | "passou" | "falhou" | "homologado";

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
  storageKey: string;
}

export interface AutomationLink {
  type: "maestro" | "playwright";
  flowPath: string;
  label?: string;
  /** draft = ainda mapeando no Studio · ready = validado 2× no emulador */
  readiness?: "draft" | "ready";
  lastRunAt?: string;
  lastRunStatus?: "idle" | "running" | "success" | "failed";
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
  status: BugStatus;
  homologationStatus?: HomologationStatus;
  executionMode?: ExecutionMode;
  homologationId?: string;
  priority?: "baixa" | "media" | "alta" | "critica";
  severity?: "baixa" | "media" | "alta" | "critica";
  build?: string;
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

export const BUG_STATUS_LABELS: Record<BugStatus, string> = {
  rascunho: "Rascunho",
  reportado: "Reportado",
  enviado_gestor: "Enviado ao gestor",
  corrigido_gestor: "Corrigido (gestor)",
  homologado: "Homologado",
  nao_reproduzido: "Não reproduzido",
  arquivado: "Arquivado",
};

export const HOMOLOGATION_LABELS: Record<HomologationStatus, string> = {
  pendente: "Pendente",
  passou: "Passou",
  falhou: "Falhou",
  homologado: "Homologado",
};

export const RECORD_TYPE_LABELS: Record<NonNullable<TestRecord["recordType"]>, string> = {
  teste: "Teste",
  bug: "Bug encontrado",
};

export const CHANNEL_LABELS: Record<ProductChannel, string> = {
  app: "App",
  web: "WEB",
  portal: "PORTAL",
};

export const EXECUTION_MODE_LABELS: Record<ExecutionMode, string> = {
  manual: "Manual",
  automated: "Automatizado",
};

export type AutomationReadiness = "draft" | "ready";

export const AUTOMATION_READINESS_LABELS: Record<AutomationReadiness, string> = {
  draft: "Flow em construção",
  ready: "Flow pronto",
};

export function getAutomationReadiness(
  record: Pick<TestRecord, "automation">,
): AutomationReadiness | null {
  if (!record.automation?.flowPath) return null;
  return record.automation.readiness === "ready" ? "ready" : "draft";
}

export function getExecutionMode(record: Pick<TestRecord, "executionMode" | "automation">): ExecutionMode {
  if (record.executionMode) return record.executionMode;
  return record.automation?.flowPath ? "automated" : "manual";
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
  if (report.platform === "android" || report.platform === "ios") return "app";
  if (report.platform === "web") return "web";
  return "app";
}

export function isTestCase(record: Pick<TestRecord, "recordType" | "campaign">): boolean {
  return (record.recordType ?? (record.campaign ? "teste" : "bug")) === "teste";
}

export function displayStatus(record: TestRecord): {
  label: string;
  tone: "neutral" | "ok" | "fail" | "warn";
} {
  if (isTestCase(record)) {
    const h = record.homologationStatus ?? "pendente";
    const tone =
      h === "passou" || h === "homologado" ? "ok" : h === "falhou" ? "fail" : "neutral";
    return { label: HOMOLOGATION_LABELS[h], tone };
  }
  const s = record.status;
  const tone =
    s === "homologado" ? "ok" : s === "reportado" || s === "enviado_gestor" ? "warn" : "neutral";
  return { label: BUG_STATUS_LABELS[s], tone };
}
