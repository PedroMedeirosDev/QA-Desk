import { authHeaders } from "@/lib/auth-token";
import type { TestCatalog, TestRecord, ProjectSlug } from "@/types/test-record";
import type { Homologation, HomologationProgress, HomologationWithProgress } from "@/types/homologation";
import type {
  KbCurationCatalog,
  KbCurationMetrics,
  KbCurationRecord,
  KbCurationStatus,
  KbCurationVerdict,
} from "@/types/kb-curation";

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

  uploadEvidence: async (project: ProjectSlug, id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/projects/${project}/tests/${id}/evidence`, {
      method: "POST",
      headers: authHeaders(),
      body: form,
    });
    if (!res.ok) throw new Error("Falha no upload");
    return res.json();
  },

  evidenceUrl: (storageKey: string) =>
    `/api/evidence/${storageKey.replace(/^uploads\//, "")}`,

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
};
