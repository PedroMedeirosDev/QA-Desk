import type { TestCatalog, TestRecord, ProjectSlug } from "@/types/test-record";
import type { Homologation, HomologationProgress, HomologationWithProgress } from "@/types/homologation";

export interface AutomationFlow {
  id: string;
  label: string;
  type: "maestro" | "playwright";
  flowPath: string;
  module?: string;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
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

  createMuralChecklist: (project: ProjectSlug) =>
    request<{
      created: number;
      skipped?: number;
      reports: TestRecord[];
      message?: string;
      homologation?: { id: string; slug: string; title: string };
      progress?: { passed: number; total: number };
    }>(
      `/api/projects/${project}/automation/mural-checklist`,
      { method: "POST" },
    ),

  runAutomation: (project: ProjectSlug, id: string, homologationId?: string) =>
    request<{
      ok: boolean;
      exitCode: number | null;
      runNumber: number;
      output?: string;
      appVersion?: string;
      failure?: {
        failedAction?: string;
        failedFlow?: string;
        errorSummary?: string;
        failedStepIndex?: number;
        failedStepLabel?: string;
      };
      homologationId?: string;
      report: TestRecord;
    }>(`/api/projects/${project}/automation/tests/${id}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(homologationId ? { homologationId } : {}),
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
};
