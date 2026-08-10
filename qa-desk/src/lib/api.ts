import { authHeaders, getAccessToken } from "@/lib/auth-token";
import type {
  EvidenceFile,
  TestCatalog,
  TestRecord,
  ProjectSlug,
} from "@/types/test-record";
import type { Homologation, HomologationProgress, HomologationWithProgress } from "@/types/homologation";
import type {
  KbCurationCatalog,
  KbCurationMetrics,
  KbCurationRecord,
  KbCurationStatus,
  KbCurationVerdict,
} from "@/types/kb-curation";
import type {
  ImplantacaoCatalog,
  ImplantacaoExecutor,
  ImplantacaoRequisitoTipo,
  ImplantacaoTipo,
} from "@/types/implantacao";
import type {
  DailyIntent,
  DailyPortfolioCard,
  DailySummary,
} from "@/types/daily-summary";

export interface AutomationFlow {
  id: string;
  label: string;
  type: "maestro" | "playwright";
  flowPath: string;
  module?: string;
}

export interface AutomationSpec {
  id: string;
  label: string;
  type: "playwright";
  specPath: string;
  module?: string;
}

export interface AndroidDeviceStatus {
  ready: boolean;
  devices: Array<{ serial: string; state: string; kind: "emulator" | "physical" }>;
  primarySerial?: string;
  avdName: string;
  booting: boolean;
  message: string;
  agentOnline?: boolean;
  agentHostname?: string;
}

export interface HealthStatus {
  ok: boolean;
  automationRun?: boolean;
  agentConfigured?: boolean;
  agentOnline?: boolean;
  agentHostname?: string;
  mode?: string;
  storage?: string;
  auth?: string;
}

export interface ApiSuiteFailure {
  name: string;
  assertion?: string;
  error?: string;
}

export interface ApiSuiteRunResult {
  ok: boolean;
  suiteId: string;
  label: string;
  summary: {
    requests: number;
    assertions: number;
    failed: number;
    durationMs: number;
  };
  failures: ApiSuiteFailure[];
  rawCli: string;
  ranAt: string;
  exitCode: number;
}

export interface ApiSuiteStatus {
  id: string;
  label: string;
  ready: boolean;
  bootMock?: boolean;
  description?: string;
  reason?: string;
  lastRun: ApiSuiteRunResult | null;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: authHeaders(init?.headers),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? "Erro na API");
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<HealthStatus>("/api/health"),

  listTests: (project: ProjectSlug) =>
    request<TestCatalog>(`/api/projects/${project}/tests`),

  getTest: (project: ProjectSlug, id: string) =>
    request<TestRecord>(`/api/projects/${project}/tests/${id}`),

  createTest: (project: ProjectSlug, data: Partial<TestRecord>) =>
    request<TestRecord>(`/api/projects/${project}/tests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  updateTest: (project: ProjectSlug, id: string, data: Partial<TestRecord>) =>
    request<TestRecord>(`/api/projects/${project}/tests/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  uploadEvidence: (
    project: ProjectSlug,
    id: string,
    file: File,
    opts?: { onProgress?: (percent: number) => void },
  ): Promise<EvidenceFile> => {
    const form = new FormData();
    form.append("file", file);
    const url = `/api/projects/${project}/tests/${id}/evidence`;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      const headers = new Headers(authHeaders());
      headers.forEach((value, key) => {
        // Browser sets multipart boundary for FormData
        if (key.toLowerCase() === "content-type") return;
        xhr.setRequestHeader(key, value);
      });

      xhr.upload.onprogress = (ev) => {
        if (!ev.lengthComputable || !opts?.onProgress) return;
        opts.onProgress(Math.min(100, Math.round((ev.loaded / ev.total) * 100)));
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          opts?.onProgress?.(100);
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error("Resposta inválida do upload"));
          }
          return;
        }
        reject(new Error("Falha no upload"));
      };
      xhr.onerror = () => reject(new Error("Falha no upload"));
      xhr.send(form);
    });
  },

  sendDiscordReport: (project: ProjectSlug, id: string) =>
    request<{
      ok: boolean;
      report: TestRecord;
      via: "bot" | "webhook";
      attached: string[];
      skipped: Array<{ filename: string; reason: string }>;
      truncatedContent: boolean;
      messageId?: string;
      channelId?: string;
    }>(`/api/projects/${project}/tests/${id}/discord-send`, { method: "POST" }),

  evidenceUrl: (storageKey: string) => {
    const path = `/api/evidence/${storageKey.replace(/^uploads\//, "")}`;
    const token = getAccessToken();
    if (!token) return path;
    const sep = path.includes("?") ? "&" : "?";
    return `${path}${sep}access_token=${encodeURIComponent(token)}`;
  },

  listFlows: (project: ProjectSlug, module?: string) => {
    const q = module ? `?module=${module}` : "";
    return request<AutomationFlow[]>(`/api/projects/${project}/automation/flows${q}`);
  },

  listSpecs: (project: ProjectSlug, module?: string) => {
    const q = module ? `?module=${module}` : "";
    return request<AutomationSpec[]>(`/api/projects/${project}/automation/specs${q}`);
  },

  getDeviceStatus: (project: ProjectSlug) =>
    request<AndroidDeviceStatus>(`/api/projects/${project}/automation/device`),

  startEmulator: (project: ProjectSlug, wait = true) =>
    request<{ started: boolean; message: string; ready?: boolean; status?: AndroidDeviceStatus }>(
      `/api/projects/${project}/automation/emulator/start${wait ? "?wait=1" : ""}`,
      { method: "POST" },
    ),

  createMuralChecklist: (project: ProjectSlug) =>
    request<{
      created: number;
      skipped?: number;
      reports: TestRecord[];
      message?: string;
      homologation?: Homologation;
      progress?: HomologationProgress;
    }>(
      `/api/projects/${project}/automation/mural-checklist`,
      { method: "POST" },
    ),

  runAutomation: (
    project: ProjectSlug,
    id: string,
    opts?: {
      homologationId?: string;
      recordVideo?: boolean;
      stage?: "all" | "prep" | "maestro";
      runner?: "maestro" | "playwright";
      headed?: boolean;
    },
  ) =>
    request<{
      ok: boolean;
      exitCode: number | null;
      runNumber: number;
      output?: string;
      appVersion?: string;
      stage?: "all" | "prep" | "maestro";
      runner?: "maestro" | "playwright";
      stages?: string[];
      prepOk?: boolean;
      failedStage?: "playwright" | "maestro";
      failure?: {
        failedAction?: string;
        failedFlow?: string;
        errorSummary?: string;
        failedStepIndex?: number;
        failedStepLabel?: string;
        failedStepSource?: "steps" | "stepsDetailed";
      };
      homologationId?: string;
      report: TestRecord;
    }>(`/api/projects/${project}/automation/tests/${id}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(opts?.homologationId ? { homologationId: opts.homologationId } : {}),
        ...(opts?.recordVideo ? { recordVideo: true } : {}),
        ...(opts?.stage && opts.stage !== "all" ? { stage: opts.stage } : {}),
        ...(opts?.runner && opts.runner !== "maestro" ? { runner: opts.runner } : {}),
        ...(typeof opts?.headed === "boolean" ? { headed: opts.headed } : {}),
      }),
    }),

  listHomologations: (project: ProjectSlug) =>
    request<{ meta: { version: string; updatedAt: string; project: ProjectSlug }; homologations: HomologationWithProgress[] }>(
      `/api/projects/${project}/homologations`,
    ),

  createHomologation: (
    project: ProjectSlug,
    data: {
      title: string;
      description?: string;
      channel?: Homologation["channel"];
      changeScope?: Homologation["changeScope"];
      testKeys?: string[];
      build?: string;
    },
  ) =>
    request<{ homologation: Homologation; linked: number; progress: HomologationProgress }>(
      `/api/projects/${project}/homologations`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    ),

  getHomologation: (project: ProjectSlug, slug: string) =>
    request<{ homologation: Homologation; progress: HomologationProgress }>(
      `/api/projects/${project}/homologations/${slug}`,
    ),

  syncHomologation: (project: ProjectSlug, slug: string) =>
    request<{
      homologation: Homologation;
      linked: number;
      progress: HomologationProgress;
      message: string;
    }>(`/api/projects/${project}/homologations/${slug}/sync`, { method: "POST" }),

  updateHomologation: (
    project: ProjectSlug,
    slug: string,
    data: {
      title?: string;
      description?: string;
      build?: string;
      status?: Homologation["status"];
      changeScope?: Homologation["changeScope"];
      testKeys?: string[];
    },
  ) =>
    request<{ homologation: Homologation; progress: HomologationProgress }>(
      `/api/projects/${project}/homologations/${slug}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    ),

  listKbCuration: (project: ProjectSlug) =>
    request<KbCurationCatalog & { metrics: KbCurationMetrics }>(
      `/api/projects/${project}/kb-curation`,
    ),

  updateKbCuration: (
    project: ProjectSlug,
    prNumber: number,
    data: {
      status?: KbCurationStatus;
      verdict?: KbCurationVerdict;
      summary?: string;
      solutionReview?: string;
      corrections?: string[];
      reviewer?: string;
    },
  ) =>
    request<{ pullRequest: KbCurationRecord; metrics: KbCurationMetrics }>(
      `/api/projects/${project}/kb-curation/${prNumber}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    ),

  syncKbCuration: (project: ProjectSlug) =>
    request<{
      pullRequests: KbCurationRecord[];
      metrics: KbCurationMetrics;
      synced: number;
      imported: number;
      authorResponses: number;
      lastSyncedAt: string;
    }>(`/api/projects/${project}/kb-curation/sync`, { method: "POST" }),

  listImplantacoes: (project: ProjectSlug) =>
    request<ImplantacaoCatalog>(`/api/projects/${project}/implantacoes`),

  getImplantacao: (project: ProjectSlug, slug: string) =>
    request<{ tipo: ImplantacaoTipo }>(
      `/api/projects/${project}/implantacoes/${slug}`,
    ),

  createImplantacao: (
    project: ProjectSlug,
    data: { title: string; description?: string; slug?: string },
  ) =>
    request<{ tipo: ImplantacaoTipo }>(`/api/projects/${project}/implantacoes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  updateImplantacao: (
    project: ProjectSlug,
    slug: string,
    data: {
      title?: string;
      description?: string;
      status?: "ativo" | "arquivado";
    },
  ) =>
    request<{ tipo: ImplantacaoTipo }>(
      `/api/projects/${project}/implantacoes/${slug}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    ),

  addImplantacaoRequisito: (
    project: ProjectSlug,
    slug: string,
    data: {
      titulo: string;
      detalhe: string;
      tipo?: ImplantacaoRequisitoTipo;
      executor?: ImplantacaoExecutor;
      obrigatorio?: boolean;
      fonte?: string;
      fonteEm?: string;
      notas?: string;
      ordem?: number;
    },
  ) =>
    request<{ tipo: ImplantacaoTipo }>(
      `/api/projects/${project}/implantacoes/${slug}/requisitos`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    ),

  getDailySummary: (project: ProjectSlug, date?: string) => {
    const q = date ? `?date=${encodeURIComponent(date)}` : "";
    return request<DailySummary>(`/api/projects/${project}/daily-summary${q}`);
  },

  listPortfolioDailySummaries: (project: ProjectSlug) =>
    request<{ project: ProjectSlug; cards: DailyPortfolioCard[] }>(
      `/api/projects/${project}/daily-summary/portfolio`,
    ),

  listApiSuites: (project: ProjectSlug) =>
    request<{ suites: ApiSuiteStatus[] }>(`/api/projects/${project}/api-suite`),

  runApiSuite: async (project: ProjectSlug, suiteId: string) => {
    const res = await fetch(`/api/projects/${project}/api-suite/${suiteId}/run`, {
      method: "POST",
      headers: authHeaders(),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 200 || res.status === 422) {
      return body as ApiSuiteRunResult;
    }
    throw new Error(
      (body as { error?: string }).error ?? `Falha ao rodar suite (${res.status})`,
    );
  },

  publishDailySummary: (
    project: ProjectSlug,
    data: {
      date: string;
      showInPortfolio: boolean;
      intents?: DailyIntent[];
      note?: string | null;
    },
  ) =>
    request<DailySummary>(`/api/projects/${project}/daily-summary`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
};
