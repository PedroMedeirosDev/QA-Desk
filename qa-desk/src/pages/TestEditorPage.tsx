import { type ReactNode, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Bug, Copy, Play, Plus, Smartphone, Sparkles, Trash2, Upload, Video } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { ExecutionModeBadge } from "@/components/ExecutionModeBadge";
import { AutomationReadinessBadge } from "@/components/AutomationReadinessBadge";
import { DesignCheckbox } from "@/components/DesignCheckbox";
import { api, type AutomationFlow, type AutomationSpec, type AndroidDeviceStatus } from "@/lib/api";
import { toastErrorMessage, useToast } from "@/lib/toast";
import { useRunProgress, QA_RUN_FINISHED_EVENT, type LiveRunState } from "@/lib/run-progress";
import { actionBtn, actionBtnBase } from "@/lib/button-styles";
import { HistoryTimeline } from "@/components/HistoryTimeline";
import { countTestRuns, historyRunFailure, activeFailedRun } from "@/lib/history";
import {
  projectBugDetailPath,
  projectBugsListPath,
  projectDetailPath,
  projectListPath,
  projectNewBugPath,
} from "@/lib/project-paths";
import { cn } from "@/lib/utils";
import { getProjectChannels, type ProductChannel } from "@/config/channels";
import type { BugStatus, ProjectSlug, TestRecord } from "@/types/test-record";
import {
  BUG_STATUS_LABELS,
  CHANNEL_LABELS,
  HOMOLOGATION_LABELS,
  RECORD_TYPE_LABELS,
  formatRecordId,
  isBugReport,
  isTestCase,
} from "@/types/test-record";
import { copyDiscordReport, formatDiscordReport } from "@/lib/discord-report";
import { polishTestForm } from "@/lib/text-corrector";
import {
  detailedStepsForSave,
  detailedStepsFromRecord,
  type DetailedStep,
} from "@/lib/detailed-steps";

const emptyDraft = (
  project: ProjectSlug,
  channel?: ProductChannel,
  kind: "teste" | "bug" = "teste",
): Partial<TestRecord> => ({
  project,
  channel: channel ?? (project === "polygonus" ? "app" : undefined),
  recordType: kind,
  homologationStatus: kind === "teste" ? "pendente" : undefined,
  executionMode: "manual",
  title: "",
  description: "",
  preconditions: "",
  steps: [""],
  stepsDetailed: [],
  expectedResult: "",
  actualResult: "",
  platform: channel === "app" ? "android" : "web",
  module: "",
  status: kind === "bug" ? "reportado" : "rascunho",
  priority: "media",
  build: "",
  osVersion: "",
  deviceLabel: "emulador",
  technicalEvidence: "",
  showInPortfolio: false,
});

export function TestEditorPage({
  project,
  channel,
  id,
  isNew = !id,
  editorKind = "teste",
}: {
  project: ProjectSlug;
  channel?: ProductChannel;
  id?: string;
  isNew?: boolean;
  editorKind?: "teste" | "bug";
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { isAdmin } = useAuth();
  const { runAutomation, running: liveRunning } = useRunProgress();
  const [tab, setTab] = useState<"detalhes" | "historico">("detalhes");
  const [stepsMode, setStepsMode] = useState<"resumo" | "detalhado">("resumo");
  const [form, setForm] = useState<Partial<TestRecord>>(emptyDraft(project, channel, editorKind));
  const [saving, setSaving] = useState(false);
  const [flows, setFlows] = useState<AutomationFlow[]>([]);
  const [specs, setSpecs] = useState<AutomationSpec[]>([]);
  const [running, setRunning] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState<AndroidDeviceStatus | null>(null);
  const [startingEmulator, setStartingEmulator] = useState(false);
  const [recordVideo, setRecordVideo] = useState(() => {
    try {
      return sessionStorage.getItem("qa-record-video") === "1";
    } catch {
      return false;
    }
  });
  const busyRun = running || liveRunning;

  const isHomologation = isTestCase(form);

  useEffect(() => {
    if (project === "polygonus") {
      api.listFlows(project, "mural").then(setFlows).catch(() => setFlows([]));
      api.listSpecs(project).then(setSpecs).catch(() => setSpecs([]));
    }
  }, [project]);

  useEffect(() => {
    if (!isHomologation || !form.automation?.flowPath || isNew) {
      setDeviceStatus(null);
      return;
    }

    let cancelled = false;
    const poll = () => {
      api
        .getDeviceStatus(project)
        .then((status) => {
          if (!cancelled) setDeviceStatus(status);
        })
        .catch(() => {
          if (!cancelled) {
            setDeviceStatus({
              ready: false,
              devices: [],
              avdName: "Medium_Phone",
              booting: false,
              message: "Não foi possível consultar adb (API local)",
            });
          }
        });
    };

    poll();
    const timer = window.setInterval(poll, startingEmulator ? 2000 : 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [project, isHomologation, form.automation?.flowPath, isNew, startingEmulator]);

  async function startEmulator() {
    setStartingEmulator(true);
    try {
      const res = await api.startEmulator(project, true);
      if (res.status) setDeviceStatus(res.status);
      toast.success(res.message);
    } catch (e) {
      toast.error(toastErrorMessage(e, "Falha ao ligar emulador"));
    } finally {
      setStartingEmulator(false);
    }
  }

  useEffect(() => {
    if (!isNew && id) {
      api.getTest(project, id).then(setForm).catch(() => toast.error("Registro não encontrado"));
    } else {
      const fromTest = (location.state as { draft?: Partial<TestRecord> } | null)?.draft;
      setForm(fromTest ?? emptyDraft(project, channel, editorKind));
    }
  }, [project, id, isNew, channel, editorKind, location.state]);

  useEffect(() => {
    if (isNew || !id) return;
    const onFinished = (event: Event) => {
      const detail = (event as CustomEvent<LiveRunState>).detail;
      if (detail.testId && detail.testId !== id) return;
      void api.getTest(project, id).then(setForm);
      if (detail.result) setTab("historico");
    };
    window.addEventListener(QA_RUN_FINISHED_EVENT, onFinished);
    return () => window.removeEventListener(QA_RUN_FINISHED_EVENT, onFinished);
  }, [project, id, isNew]);

  useEffect(() => {
    if (isNew || !id || !form.id) return;
    const ch = form.channel ?? channel;
    if (editorKind === "bug" && isTestCase(form)) {
      navigate(projectDetailPath(project, id, ch), { replace: true });
    } else if (editorKind === "teste" && isBugReport(form)) {
      navigate(projectBugDetailPath(project, id, ch), { replace: true });
    }
  }, [form.id, form.recordType, form.campaign, editorKind, id, isNew, navigate, project, channel]);

  function listPathFor(record: Partial<TestRecord>) {
    const ch = record.channel ?? channel;
    return isBugReport(record as TestRecord)
      ? projectBugsListPath(project, ch)
      : projectListPath(project, ch);
  }

  function detailPathFor(recordId: string, record: Partial<TestRecord>) {
    const ch = record.channel ?? channel;
    return isBugReport(record as TestRecord)
      ? projectBugDetailPath(project, recordId, ch)
      : projectDetailPath(project, recordId, ch);
  }

  function update<K extends keyof TestRecord>(key: K, value: TestRecord[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const payload: Partial<TestRecord> = {
        ...form,
        recordType: editorKind,
        stepsDetailed: detailedStepsForSave(
          detailedStepsFromRecord(form).length
            ? detailedStepsFromRecord(form)
            : form.stepsDetailed ?? [],
        ),
        stepsManual: undefined,
      };
      if (isNew) {
        const created = await api.createTest(project, payload);
        navigate(detailPathFor(created.id, created), { replace: true });
      } else if (id) {
        const updated = await api.updateTest(project, id, payload);
        setForm(updated);
      }
    } catch (e) {
      toast.error(toastErrorMessage(e, "Erro ao salvar"));
    } finally {
      setSaving(false);
    }
  }

  async function confirmHomologation() {
    if (!id || !isHomologation) return;
    setSaving(true);
    try {
      const updated = await api.updateTest(project, id, {
        ...form,
        homologationStatus: "homologado",
      });
      setForm(updated);
    } finally {
      setSaving(false);
    }
  }

  async function runAutomationStage(
    stage: "all" | "prep" | "maestro" = "all",
    runner: "maestro" | "playwright" = "maestro",
  ) {
    if (!id || isNew) return;
    setRunning(true);
    try {
      const res = await runAutomation({
        project,
        testId: id,
        title: form.title || formatRecordId(id, form as TestRecord),
        recordVideo: runner === "playwright" || stage === "prep" ? false : recordVideo,
        stage: runner === "playwright" ? "all" : stage,
        runner,
      });
      setForm(res.report);
      const ver = res.appVersion ? ` · v${res.appVersion}` : "";
      const vids = (res.report.evidence ?? []).filter((e) => e.type === "video");
      const stageHint =
        runner === "playwright"
          ? " (Playwright Web)"
          : stage === "prep"
            ? " (seed)"
            : stage === "maestro"
              ? " (só app)"
              : res.stages?.includes("playwright")
                ? " (PW→Maestro)"
                : "";
      if (res.ok) {
        toast.success(
          `Execução #${res.runNumber} passou${stageHint}${ver}${vids.length ? ` · ${vids.length} vídeo(s)` : ""}`,
        );
      } else {
        const where =
          res.failedStage === "playwright"
            ? runner === "playwright"
              ? "Playwright Web"
              : "Playwright seed"
            : (res.failure?.failedStepLabel ??
              res.failure?.failedAction ??
              "veja o painel / histórico");
        toast.error(`Execução #${res.runNumber} falhou${stageHint}${ver} — ${where}`, {
          title: runner === "playwright" || stage === "prep" ? "Playwright" : "Automação",
        });
      }
    } catch (e) {
      toast.error(toastErrorMessage(e, "Erro ao executar"));
    } finally {
      setRunning(false);
    }
  }

  function attachFlow(flowPath: string, label: string) {
    update("automation", {
      type: "maestro",
      flowPath,
      label,
      readiness: form.automation?.readiness ?? "draft",
      prep: form.automation?.prep,
      playwright: form.automation?.playwright,
      lastRunAt: form.automation?.lastRunAt,
      lastRunStatus: form.automation?.lastRunStatus,
      lastRunOutput: form.automation?.lastRunOutput,
    });
    update("executionMode", "automated");
  }

  function attachPlaywrightSpec(specPath: string) {
    const prev = form.automation;
    update("automation", {
      type: prev?.flowPath ? (prev.type ?? "maestro") : "playwright",
      flowPath: prev?.flowPath,
      label: prev?.label,
      readiness: prev?.readiness,
      prep: prev?.prep,
      playwright: {
        specPath,
        headed: prev?.playwright?.headed !== false,
        readiness: prev?.playwright?.readiness ?? "draft",
        lastRunAt: prev?.playwright?.lastRunAt,
        lastRunStatus: prev?.playwright?.lastRunStatus,
        lastRunOutput: prev?.playwright?.lastRunOutput,
      },
      lastRunAt: prev?.lastRunAt,
      lastRunStatus: prev?.lastRunStatus,
      lastRunOutput: prev?.lastRunOutput,
    });
    update("executionMode", "automated");
  }

  async function onUpload(file: File) {
    if (!id || isNew) {
      toast.error("Salve o teste antes de anexar print");
      return;
    }
    await api.uploadEvidence(project, id, file);
    setForm(await api.getTest(project, id));
  }

  function applyTextPolish() {
    const polished = polishTestForm({
      title: form.title,
      steps: form.steps,
      stepsDetailed: form.stepsDetailed,
      stepsManual: form.stepsManual,
      expectedResult: form.expectedResult,
      actualResult: form.actualResult,
      description: form.description,
      preconditions: form.preconditions,
    });
    setForm((f) => ({
      ...f,
      steps: polished.steps.length ? polished.steps : f.steps,
      stepsDetailed: polished.stepsDetailed.length
        ? polished.stepsDetailed
        : f.stepsDetailed,
      expectedResult: polished.expectedResult || f.expectedResult,
      actualResult: polished.actualResult || f.actualResult,
      description: polished.description || f.description,
      preconditions: polished.preconditions || f.preconditions,
    }));
    if (polished.changes.length) {
      toast.success(`Texto ajustado: ${polished.changes.join("; ")}`);
    } else if (polished.warnings.length) {
      toast.info(`Campos incompletos: ${polished.warnings[0]}`);
    } else {
      toast.success("Nenhuma alteração necessária");
    }
    if (polished.warnings.length > 1) {
      console.info("[ct-fields]", polished.warnings);
    }
  }

  async function copyReportForDiscord() {
    const text = formatDiscordReport(form, {
      osVersion: form.osVersion,
      deviceLabel: form.deviceLabel,
      technicalEvidence: form.technicalEvidence,
    });
    const ok = await copyDiscordReport(text);
    if (ok) toast.success("Report copiado — cole no Discord");
    else toast.error("Não foi possível copiar (permissão do navegador)");
  }

  function reportBugFromTest() {
    if (!form.id || !isTestCase(form)) return;
    const failed = activeFailedRun(form.history ?? []);
    navigate(projectNewBugPath(project, channel ?? form.channel), {
      state: {
        draft: {
          ...emptyDraft(project, channel ?? form.channel, "bug"),
          title: form.title ? `Bug: ${form.title}` : "Bug encontrado",
          description:
            failed?.detail ??
            form.actualResult ??
            "Defeito observado durante execução do caso de teste.",
          preconditions: form.preconditions,
          steps: form.steps?.filter(Boolean).length ? form.steps : [""],
          stepsDetailed: form.stepsDetailed?.length
            ? detailedStepsForSave(form.stepsDetailed)
            : undefined,
          expectedResult: form.expectedResult,
          actualResult: form.actualResult ?? failed?.detail,
          module: form.module,
          platform: form.platform,
          build: form.build,
          osVersion: form.osVersion,
          deviceLabel: form.deviceLabel,
          technicalEvidence: form.technicalEvidence,
          tags: [`origem:${form.id}`],
        },
      },
    });
  }

  const isMobileChannel =
    form.channel === "app" || form.platform === "android" || form.platform === "ios";
  const editingBug = editorKind === "bug" || isBugReport(form as TestRecord);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          to={listPathFor(form)}
          className={cn(actionBtnBase, actionBtn.back, "size-9 px-0")}
          title="Voltar à lista"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <p className="font-mono text-xs text-muted-foreground">
            {isNew
              ? editingBug
                ? "Novo bug"
                : "Novo teste"
              : formatRecordId(form.id ?? "", form as TestRecord)}
          </p>
          {!isNew && isTestCase(form) && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <ExecutionModeBadge record={form} />
              <AutomationReadinessBadge record={form} />
              <span className="text-xs text-muted-foreground">
                {countTestRuns(form.history ?? [])} rodada(s)
              </span>
              {form.build && (
                <span className="rounded-full border border-border px-2 py-0.5 text-[0.65rem] text-muted-foreground">
                  App {form.build}
                </span>
              )}
            </div>
          )}
          <h2 className="text-lg font-semibold">{form.title || "Sem título"}</h2>
        </div>
      </div>

      <div className="flex gap-2 border-b">
        {(["detalhes", "historico"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "border-b-2 px-4 py-2 text-sm capitalize transition-colors",
              tab === t ? actionBtn.tabActive : actionBtn.tabIdle,
            )}
          >
            {t === "detalhes" ? "Detalhes" : "Histórico"}
          </button>
        ))}
      </div>

      {tab === "detalhes" ? (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_17.5rem]">
          <div className="min-w-0 space-y-4 rounded-xl border bg-card p-6">
            <Field label="Título *">
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={form.title ?? ""}
                onChange={(e) => update("title", e.target.value)}
              />
            </Field>
            <Field label="Descrição">
              <textarea
                className="min-h-24 w-full rounded-md border px-3 py-2 text-sm"
                value={form.description ?? ""}
                onChange={(e) => update("description", e.target.value)}
              />
            </Field>
            <Field label="Pré-condições">
              <textarea
                className="min-h-16 w-full rounded-md border px-3 py-2 text-sm"
                value={form.preconditions ?? ""}
                onChange={(e) => update("preconditions", e.target.value)}
              />
            </Field>
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">Passos do teste</span>
                  <div className="inline-flex rounded-md border p-0.5 text-xs">
                    <button
                      type="button"
                      className={cn(
                        "rounded px-2 py-0.5",
                        stepsMode === "resumo"
                          ? "bg-muted font-medium text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => setStepsMode("resumo")}
                      title="Atalho QA / Discord"
                    >
                      Resumo
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "rounded px-2 py-0.5",
                        stepsMode === "detalhado"
                          ? "bg-muted font-medium text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => setStepsMode("detalhado")}
                      title="Roteiro detalhado + âncoras Maestro"
                    >
                      Detalhado
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted/50"
                    onClick={applyTextPolish}
                    title="Normaliza numeração, espaços e unicode"
                  >
                    <Sparkles className="size-3" /> Corrigir texto
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                    onClick={() => {
                      if (stepsMode === "detalhado") {
                        const cur = detailedStepsFromRecord(form);
                        update("stepsDetailed", [
                          ...cur,
                          { text: "", flows: [], actions: [] },
                        ]);
                      } else {
                        update("steps", [...(form.steps ?? []), ""]);
                      }
                    }}
                  >
                    <Plus className="size-3" /> Adicionar passo
                  </button>
                </div>
              </div>
              <p className="mb-2 text-[0.7rem] text-muted-foreground">
                {stepsMode === "resumo"
                  ? "Enxuto — atalho para você e reports curtos."
                  : "1 toque por linha. Âncoras Maestro (flow/ação) ligam a falha da automação a este passo."}
              </p>
              {stepsMode === "resumo" ? (
                (() => {
                  const failed = activeFailedRun(form.history ?? []);
                  const failInfo = failed ? historyRunFailure(failed) : undefined;
                  const list = form.steps?.length ? form.steps : [""];
                  const highlight =
                    failInfo?.stepIndex != null && failInfo.stepSource === "steps";
                  const failedIdx = highlight ? failInfo?.stepIndex : undefined;
                  return (
                    <div className="space-y-2">
                      {list.map((step, i) => {
                        const isFailedStep = failedIdx === i;
                        return (
                          <div
                            key={`steps-${i}`}
                            className={cn(
                              "flex gap-2 rounded-md",
                              isFailedStep &&
                                "border border-red-500/40 bg-red-500/10 p-1.5",
                            )}
                          >
                            <span
                              className={cn(
                                "mt-2 w-6 text-xs",
                                isFailedStep
                                  ? "font-semibold text-red-400"
                                  : "text-muted-foreground",
                              )}
                            >
                              {i + 1}.
                            </span>
                            <div className="min-w-0 flex-1">
                              <input
                                className={cn(
                                  "w-full rounded-md border px-3 py-2 text-sm",
                                  isFailedStep && "border-red-500/50",
                                )}
                                value={step}
                                onChange={(e) => {
                                  const next = [...list];
                                  next[i] = e.target.value;
                                  update("steps", next);
                                }}
                              />
                              {isFailedStep && failInfo && (
                                <p className="mt-1 text-[0.7rem] text-red-300">
                                  Falhou aqui
                                  {failInfo.action ? ` · ${failInfo.action}` : ""}
                                  {failInfo.flow ? ` · ${failInfo.flow}` : ""}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              className="mt-1 rounded p-1 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
                              title="Remover passo"
                              onClick={() =>
                                update(
                                  "steps",
                                  list.filter((_, j) => j !== i),
                                )
                              }
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              ) : (
                (() => {
                  const failed = activeFailedRun(form.history ?? []);
                  const failInfo = failed ? historyRunFailure(failed) : undefined;
                  const list: DetailedStep[] = (() => {
                    const cur = detailedStepsFromRecord(form);
                    return cur.length ? cur : [{ text: "" }];
                  })();
                  const highlight =
                    failInfo?.stepIndex != null &&
                    failInfo.stepSource === "stepsDetailed";
                  const failedIdx = highlight ? failInfo?.stepIndex : undefined;
                  const setDetailed = (next: DetailedStep[]) =>
                    update("stepsDetailed", next);
                  return (
                    <div className="space-y-3">
                      {list.map((step, i) => {
                        const isFailedStep = failedIdx === i;
                        return (
                          <div
                            key={`detailed-${i}`}
                            className={cn(
                              "rounded-md",
                              isFailedStep &&
                                "border border-red-500/40 bg-red-500/10 p-1.5",
                            )}
                          >
                            <div className="flex gap-2">
                              <span
                                className={cn(
                                  "mt-2 w-6 text-xs",
                                  isFailedStep
                                    ? "font-semibold text-red-400"
                                    : "text-muted-foreground",
                                )}
                              >
                                {i + 1}.
                              </span>
                              <div className="min-w-0 flex-1 space-y-1.5">
                                <input
                                  className={cn(
                                    "w-full rounded-md border px-3 py-2 text-sm",
                                    isFailedStep && "border-red-500/50",
                                  )}
                                  value={step.text}
                                  placeholder="Ex.: Toque no ícone de funil na barra do composer"
                                  onChange={(e) => {
                                    const next = [...list];
                                    next[i] = { ...step, text: e.target.value };
                                    setDetailed(next);
                                  }}
                                />
                                <div className="grid gap-1.5 sm:grid-cols-2">
                                  <input
                                    className="w-full rounded-md border border-dashed px-2 py-1 text-[0.7rem] text-muted-foreground"
                                    value={(step.flows ?? []).join(", ")}
                                    placeholder="Flows YAML (vírgula) — ex. abrir_filtro_extras_composer.yaml"
                                    title="Basename do flow Maestro que corresponde a este passo"
                                    onChange={(e) => {
                                      const flows = e.target.value
                                        .split(",")
                                        .map((s) => s.trim())
                                        .filter(Boolean);
                                      const next = [...list];
                                      next[i] = { ...step, flows };
                                      setDetailed(next);
                                    }}
                                  />
                                  <input
                                    className="w-full rounded-md border border-dashed px-2 py-1 text-[0.7rem] text-muted-foreground"
                                    value={(step.actions ?? []).join(", ")}
                                    placeholder="Ações (vírgula) — ex. mural_composer_filtro"
                                    title="Trecho da ação Maestro (Tap on …) que casa com este passo"
                                    onChange={(e) => {
                                      const actions = e.target.value
                                        .split(",")
                                        .map((s) => s.trim())
                                        .filter(Boolean);
                                      const next = [...list];
                                      next[i] = { ...step, actions };
                                      setDetailed(next);
                                    }}
                                  />
                                </div>
                                {isFailedStep && failInfo && (
                                  <p className="text-[0.7rem] text-red-300">
                                    Falhou aqui
                                    {failInfo.action ? ` · ${failInfo.action}` : ""}
                                    {failInfo.flow ? ` · ${failInfo.flow}` : ""}
                                  </p>
                                )}
                              </div>
                              <button
                                type="button"
                                className="mt-1 rounded p-1 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
                                title="Remover passo"
                                onClick={() =>
                                  setDetailed(list.filter((_, j) => j !== i))
                                }
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
            <Field label="Resultado esperado">
              <textarea
                className="min-h-16 w-full rounded-md border px-3 py-2 text-sm"
                value={form.expectedResult ?? ""}
                onChange={(e) => update("expectedResult", e.target.value)}
              />
            </Field>
            {!isHomologation && (
              <Field label="Resultado observado">
                <textarea
                  className="min-h-16 w-full rounded-md border px-3 py-2 text-sm"
                  value={form.actualResult ?? ""}
                  onChange={(e) => update("actualResult", e.target.value)}
                />
              </Field>
            )}
            {isHomologation && form.homologationStatus === "falhou" && (
              <Field label="Observações (falha / bug encontrado)">
                <textarea
                  className="min-h-16 w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Descreva o que falhou ou converta para Bug encontrado no painel lateral"
                  value={form.actualResult ?? ""}
                  onChange={(e) => update("actualResult", e.target.value)}
                />
              </Field>
            )}

            <div>
              <span className="text-sm font-medium">Evidência (prints / vídeos)</span>
              <div className="mt-2 flex flex-wrap gap-3">
                {(form.evidence ?? []).map((ev) => (
                  <a
                    key={ev.fileId}
                    href={api.evidenceUrl(ev.storageKey)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block overflow-hidden rounded-md border"
                    title={ev.filename}
                  >
                    {ev.type === "video" ? (
                      <span className="flex h-24 w-36 flex-col items-center justify-center gap-1 bg-muted/40 text-xs text-muted-foreground">
                        <Video className="size-6" />
                        Vídeo
                      </span>
                    ) : (
                      <img
                        src={api.evidenceUrl(ev.storageKey)}
                        alt={ev.filename}
                        className="h-24 w-auto object-cover"
                      />
                    )}
                  </a>
                ))}
              </div>
              <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm surface-brand hover:brightness-110">
                <Upload className="size-4" />
                Anexar print
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onUpload(f);
                  }}
                />
              </label>
            </div>
          </div>

          <aside className="sticky top-8 max-h-[calc(100vh-4rem)] space-y-4 self-start overflow-y-auto rounded-xl border bg-card p-4">
            {getProjectChannels(project).length > 0 && (
              <PropSelect
                label="Canal"
                value={form.channel ?? "app"}
                options={(Object.keys(CHANNEL_LABELS) as ProductChannel[]).map((k) => ({
                  value: k,
                  label: CHANNEL_LABELS[k],
                }))}
                onChange={(v) => update("channel", v as ProductChannel)}
              />
            )}
            <PropSelect
              label="Natureza"
              value={form.recordType ?? editorKind}
              options={Object.entries(RECORD_TYPE_LABELS).map(([k, v]) => ({
                value: k,
                label: v,
              }))}
              onChange={(v) => {
                update("recordType", v as TestRecord["recordType"]);
                if (v === "teste") update("homologationStatus", "pendente");
              }}
              disabled={editorKind === "bug" || (!isNew && isTestCase(form))}
            />

            {isHomologation ? (
              <div className="rounded-md border bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">Homologação</p>
                <p className="text-sm font-medium">
                  {HOMOLOGATION_LABELS[form.homologationStatus ?? "pendente"]}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Atualizado automaticamente ao executar Maestro
                </p>
              </div>
            ) : (
              <PropSelect
                label="Status do bug"
                value={form.status ?? "rascunho"}
                options={Object.entries(BUG_STATUS_LABELS).map(([k, v]) => ({
                  value: k,
                  label: v,
                }))}
                onChange={(v) => update("status", v as BugStatus)}
              />
            )}

            <PropSelect
              label="Plataforma"
              value={form.platform ?? "web"}
              options={[
                { value: "web", label: "Web" },
                { value: "android", label: "Android" },
                { value: "ios", label: "iOS" },
                { value: "api", label: "API" },
                { value: "outro", label: "Outro" },
              ]}
              onChange={(v) => update("platform", v as TestRecord["platform"])}
              disabled={!isAdmin}
            />
            <DesignCheckbox
              className="rounded-md border border-border bg-muted/20 px-3 py-2"
              checked={Boolean(form.showInPortfolio)}
              disabled={!isAdmin}
              onChange={(e) => update("showInPortfolio", e.target.checked)}
              label={<span className="font-medium text-[var(--foreground)]">Mostrar no portfólio</span>}
              description="Visitantes autenticados só veem itens marcados aqui."
            />
            <Field label="Módulo">
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={form.module ?? ""}
                onChange={(e) => update("module", e.target.value)}
              />
            </Field>
            <Field label="Versão do app (login)">
              <input
                className="w-full rounded-md border px-3 py-2 font-mono text-sm"
                value={form.build ?? ""}
                onChange={(e) => update("build", e.target.value)}
                placeholder="Preenchida ao rodar o Maestro"
                title="Mesma versão exibida na tela de login; atualizada a cada execução"
              />
            </Field>
            {isMobileChannel && (
              <>
                <Field label="SO / API (report)">
                  <input
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={form.osVersion ?? ""}
                    onChange={(e) => update("osVersion", e.target.value)}
                    placeholder="Ex.: Android API 33 — Medium_Phone"
                  />
                </Field>
                <Field label="Dispositivo (report)">
                  <input
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={form.deviceLabel ?? ""}
                    onChange={(e) => update("deviceLabel", e.target.value)}
                    placeholder="emulador, celular, emulador + celular"
                  />
                </Field>
                {!isHomologation && (
                  <Field label="Evidência técnica (report)">
                    <textarea
                      className="min-h-16 w-full rounded-md border px-3 py-2 text-sm"
                      value={form.technicalEvidence ?? ""}
                      onChange={(e) => update("technicalEvidence", e.target.value)}
                      placeholder="JSON datEnvio, log Maestro, stack…"
                    />
                  </Field>
                )}
              </>
            )}

            {isHomologation && isAdmin && (
            <div className="space-y-4 border-t pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">Automação</span>
                {form.automation?.prep?.type === "playwright" && (
                  <span className="rounded border px-1.5 py-0.5 text-[0.65rem] text-muted-foreground">
                    Seed PW → Maestro
                  </span>
                )}
                {form.automation?.playwright?.specPath && (
                  <span className="rounded border border-sky-500/40 px-1.5 py-0.5 text-[0.65rem] text-sky-300">
                    Web / Playwright
                  </span>
                )}
              </div>

              <div className="space-y-2 rounded-lg border border-border/70 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Emulador / Maestro
                </p>
                {form.automation?.flowPath ? (
                  <>
                    <p className="rounded-md border bg-muted/30 p-2 font-mono text-xs break-all">
                      {form.automation.label ?? form.automation.flowPath}
                    </p>
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                      Seed Playwright (opcional, antes do Maestro)
                      <input
                        className="h-9 rounded-md border bg-background px-2 font-mono text-[0.7rem] text-foreground"
                        value={form.automation.prep?.specPath ?? ""}
                        placeholder="projects/.../playwright/mural/ajustar-dn-aniversariante.spec.ts"
                        onChange={(e) => {
                          const specPath = e.target.value.trim();
                          update("automation", {
                            ...form.automation!,
                            prep: specPath
                              ? {
                                  type: "playwright",
                                  specPath,
                                  headed: form.automation?.prep?.headed !== false,
                                }
                              : undefined,
                          });
                        }}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                      Status do flow
                      <select
                        className="h-9 rounded-md border bg-background px-2 text-sm text-foreground"
                        value={form.automation.readiness === "ready" ? "ready" : "draft"}
                        onChange={(e) =>
                          update("automation", {
                            ...form.automation!,
                            readiness: e.target.value as "draft" | "ready",
                          })
                        }
                      >
                        <option value="draft">Rascunho (ainda mapeando)</option>
                        <option value="ready">Estável (validado)</option>
                      </select>
                    </label>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Nenhum flow Maestro vinculado</p>
                )}
                {flows.length > 0 && (
                  <select
                    className="w-full rounded-md border px-2 py-1.5 text-xs"
                    value={form.automation?.flowPath ?? ""}
                    onChange={(e) => {
                      const f = flows.find((x) => x.flowPath === e.target.value);
                      if (f) attachFlow(f.flowPath, f.label);
                    }}
                  >
                    <option value="">Vincular flow Maestro…</option>
                    {flows.map((f) => (
                      <option key={f.flowPath} value={f.flowPath}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-2 rounded-lg border border-sky-500/25 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-300/90">
                  Web / Playwright
                </p>
                <p className="text-[0.7rem] text-muted-foreground">
                  Mesmo CT, executor alternativo (App no navegador). Separado do seed acima.
                </p>
                {form.automation?.playwright?.specPath ? (
                  <>
                    <p className="rounded-md border bg-muted/30 p-2 font-mono text-xs break-all">
                      {form.automation.playwright.specPath}
                    </p>
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                      Status do spec
                      <select
                        className="h-9 rounded-md border bg-background px-2 text-sm text-foreground"
                        value={
                          form.automation.playwright.readiness === "ready"
                            ? "ready"
                            : "draft"
                        }
                        onChange={(e) =>
                          update("automation", {
                            ...form.automation!,
                            playwright: {
                              ...form.automation!.playwright!,
                              readiness: e.target.value as "draft" | "ready",
                            },
                          })
                        }
                      >
                        <option value="draft">Rascunho</option>
                        <option value="ready">Estável</option>
                      </select>
                    </label>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Nenhum spec Playwright vinculado</p>
                )}
                {specs.length > 0 ? (
                  <select
                    className="w-full rounded-md border px-2 py-1.5 text-xs"
                    value={form.automation?.playwright?.specPath ?? ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (!value) {
                        if (!form.automation) return;
                        const { playwright: _pw, ...rest } = form.automation;
                        update("automation", {
                          ...rest,
                          playwright: undefined,
                          type: rest.flowPath ? "maestro" : "playwright",
                        });
                        return;
                      }
                      attachPlaywrightSpec(value);
                    }}
                  >
                    <option value="">Vincular spec Playwright…</option>
                    {specs.map((s) => (
                      <option key={s.specPath} value={s.specPath}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    Spec (caminho relativo ao repo)
                    <input
                      className="h-9 rounded-md border bg-background px-2 font-mono text-[0.7rem] text-foreground"
                      value={form.automation?.playwright?.specPath ?? ""}
                      placeholder="projects/polygonus/automation/playwright/mural/exemplo.spec.ts"
                      onChange={(e) => {
                        const specPath = e.target.value.trim();
                        if (!specPath) {
                          if (!form.automation) return;
                          update("automation", {
                            ...form.automation,
                            playwright: undefined,
                          });
                          return;
                        }
                        attachPlaywrightSpec(specPath);
                      }}
                    />
                  </label>
                )}
                {!isNew && form.automation?.playwright?.specPath && (
                  <button
                    type="button"
                    onClick={() => void runAutomationStage("all", "playwright")}
                    disabled={busyRun || saving}
                    className={cn(actionBtnBase, actionBtn.run, "w-full")}
                    title="Rodar só o spec Playwright (Web)"
                  >
                    <Play className="size-4" />
                    {busyRun ? "Executando…" : "Executar Playwright (Web)"}
                  </button>
                )}
              </div>

              {!isNew && form.automation?.flowPath && (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 rounded-md border bg-muted/20 px-2.5 py-2 text-xs text-muted-foreground">
                    <span
                      className={cn(
                        "mt-1 size-2 shrink-0 rounded-full",
                        deviceStatus?.ready
                          ? "bg-emerald-500"
                          : deviceStatus?.booting || startingEmulator
                            ? "bg-amber-400 animate-pulse"
                            : "bg-muted-foreground/40",
                      )}
                      aria-hidden
                    />
                    <span>
                      {startingEmulator
                        ? `Ligando ${deviceStatus?.avdName ?? "emulador"}…`
                        : (deviceStatus?.message ?? "Consultando device Android…")}
                    </span>
                  </div>
                  {!deviceStatus?.ready && (
                    <button
                      type="button"
                      onClick={() => void startEmulator()}
                      disabled={
                        startingEmulator ||
                        busyRun ||
                        saving ||
                        deviceStatus?.agentOnline === false
                      }
                      className={cn(actionBtnBase, actionBtn.back, "w-full")}
                      title={
                        deviceStatus?.agentOnline
                          ? "Envia pedido ao agente no PC para ligar o AVD"
                          : `Inicia o AVD ${deviceStatus?.avdName ?? "Medium_Phone"} via Android SDK`
                      }
                    >
                      <Smartphone className="size-4" />
                      {startingEmulator ? "Aguardando boot…" : "Ligar emulador"}
                    </button>
                  )}
                  <DesignCheckbox
                    className="rounded-md border px-2.5 py-2"
                    checked={recordVideo}
                    disabled={busyRun}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setRecordVideo(on);
                      try {
                        sessionStorage.setItem("qa-record-video", on ? "1" : "0");
                      } catch {
                        /* ignore */
                      }
                    }}
                    label={<span className="font-medium text-[var(--foreground)]">Gravar vídeo</span>}
                    description="adb screenrecord em paralelo (chunks de ~3 min). Arquivos ficam em Evidência."
                  />
                  <button
                    type="button"
                    onClick={() => void runAutomationStage("all", "maestro")}
                    disabled={busyRun || saving || startingEmulator}
                    className={cn(actionBtnBase, actionBtn.run, "w-full")}
                    title={
                      form.automation?.prep
                        ? "Playwright (seed) e depois Maestro"
                        : "Rodar flow Maestro"
                    }
                  >
                    {recordVideo ? <Video className="size-4" /> : <Play className="size-4" />}
                    {busyRun
                      ? "Executando…"
                      : form.automation?.prep
                        ? recordVideo
                          ? "Play PW→Maestro + vídeo"
                          : "Play (PW → Maestro)"
                        : recordVideo
                          ? "Executar com vídeo"
                          : "Executar Maestro"}
                  </button>
                  {form.automation?.prep?.type === "playwright" && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => void runAutomationStage("prep", "maestro")}
                        disabled={busyRun || saving}
                        className={cn(actionBtnBase, actionBtn.back, "w-full text-xs")}
                        title="Só ajusta DN no web (Chrome headed)"
                      >
                        Seed DN
                      </button>
                      <button
                        type="button"
                        onClick={() => void runAutomationStage("maestro", "maestro")}
                        disabled={busyRun || saving || startingEmulator}
                        className={cn(actionBtnBase, actionBtn.back, "w-full text-xs")}
                        title="Só Maestro (DN já ok)"
                      >
                        Só app
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              {isAdmin && isHomologation && !isNew && (
                <button
                  type="button"
                  onClick={reportBugFromTest}
                  className={cn(actionBtnBase, actionBtn.ghost, "w-full")}
                  title="Abre um novo bug com dados deste caso de teste"
                >
                  <Bug className="size-4" />
                  Reportar bug deste teste
                </button>
              )}
              <button
                type="button"
                onClick={() => void copyReportForDiscord()}
                className={cn(actionBtnBase, actionBtn.ghost, "w-full")}
                title="Formato enxuto para Discord"
              >
                <Copy className="size-4" />
                Copiar report Discord
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving}
                  className={cn(actionBtnBase, actionBtn.save, "w-full")}
                >
                  {saving ? "Salvando…" : "Salvar"}
                </button>
              )}
              {isAdmin && isHomologation && form.homologationStatus === "passou" && !isNew && (
                <button
                  type="button"
                  onClick={() => void confirmHomologation()}
                  disabled={saving}
                  className={cn(actionBtnBase, actionBtn.homologate, "w-full")}
                >
                  Confirmar homologação manual
                </button>
              )}
              {isAdmin && !isHomologation && form.status === "corrigido_gestor" && !isNew && (
                <button
                  type="button"
                  onClick={() =>
                    void api
                      .updateTest(project, id!, { ...form, status: "homologado" })
                      .then(setForm)
                  }
                  disabled={saving}
                  className={cn(actionBtnBase, actionBtn.homologate, "w-full")}
                >
                  Confirmar homologação (bug)
                </button>
              )}
              {!isAdmin && (
                <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  Modo visitante: somente leitura do portfólio.
                </p>
              )}
            </div>
          </aside>
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-6">
          <HistoryTimeline entries={form.history ?? []} />
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function PropSelect({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      <select
        className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-60"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
