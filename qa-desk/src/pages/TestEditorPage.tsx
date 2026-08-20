import { type ReactNode, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Bug, CheckCircle2, Copy, ExternalLink, Loader2, Play, Plus, RefreshCw, Smartphone, Sparkles, Trash2, Upload, Video } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { ExecutionModeBadge } from "@/components/ExecutionModeBadge";
import { AutomationReadinessBadge } from "@/components/AutomationReadinessBadge";
import { DesignCheckbox } from "@/components/DesignCheckbox";
import { PremiumTooltip } from "@/components/PremiumTooltip";
import { api, type AutomationFlow, type AutomationSpec, type AndroidDeviceStatus } from "@/lib/api";
import { toastErrorMessage, useToast } from "@/lib/toast";
import { githubIssueProgressPercent } from "@/lib/github-issue-stream";
import { useConfirm } from "@/lib/confirm";
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
import { VISITOR_HOME_PATH } from "@/lib/visitor";
import { QA_GESTOR_REPLY_EVENT, type GestorReplyEvent } from "@/lib/gestor-replies-stream";
import { channelSupportsMaestro, getProjectChannels, type ProductChannel } from "@/config/channels";
import type { BugStatus, ProjectSlug, TestRecord } from "@/types/test-record";
import {
  BUG_STATUS_LABELS,
  CHANNEL_LABELS,
  PLATFORM_LABELS,
  HOMOLOGATION_LABELS,
  PRIORITY_LABELS,
  RECORD_TYPE_LABELS,
  displayStatus,
  formatRecordId,
  isBugReport,
  isGestorReplyUnread,
  isTestCase,
} from "@/types/test-record";
import { copyDiscordReport } from "@/lib/discord-report";
import {
  formatBugReportMarkdown,
  formatChamadoPolygonus,
  ambienteView,
} from "@/lib/bug-report-markdown";
import { polishTestForm } from "@/lib/text-corrector";
import {
  detailedStepsForSave,
  detailedStepsFromRecord,
  type DetailedStep,
} from "@/lib/detailed-steps";
import {
  readPlaywrightHeaded,
  writePlaywrightHeaded,
} from "@/lib/automation-runners";

const QUIET_INPUT =
  "w-full rounded-md border border-border/50 bg-muted/25 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-border focus:bg-muted/40 disabled:cursor-default disabled:opacity-100 disabled:border-transparent disabled:bg-transparent";

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
  severity: kind === "bug" ? "media" : undefined,
  build: "",
  osVersion: "",
  deviceLabel: "emulador",
  browser: "",
  testLogin: "",
  technicalEvidence: "",
  showInPortfolio: false,
  consolidated: false,
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
  const confirm = useConfirm();
  const { isAdmin, isVisitor } = useAuth();
  const { runAutomation, running: liveRunning } = useRunProgress();
  const [tab, setTab] = useState<"detalhes" | "historico">("detalhes");
  const [stepsMode, setStepsMode] = useState<"resumo" | "detalhado">("resumo");
  const [form, setForm] = useState<Partial<TestRecord>>(emptyDraft(project, channel, editorKind));
  const [saving, setSaving] = useState(false);
  const [githubBusy, setGithubBusy] = useState<"opening" | "syncing" | "closing" | null>(
    null,
  );
  const [githubProgress, setGithubProgress] = useState<{
    message: string;
    percent: number;
    filename?: string;
  } | null>(null);
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
  const [playwrightHeaded, setPlaywrightHeaded] = useState(readPlaywrightHeaded);
  const [uploadProgress, setUploadProgress] = useState<{
    filename: string;
    percent: number;
  } | null>(null);
  const [removingEvidenceId, setRemovingEvidenceId] = useState<string | null>(null);
  const busyRun = running || liveRunning;
  const deskBusy = saving || Boolean(githubBusy);

  const isHomologation = isTestCase(form);
  const editingBug = editorKind === "bug" || isBugReport(form as TestRecord);

  useEffect(() => {
    if (editingBug) setStepsMode("resumo");
  }, [editingBug]);

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
      api
        .getTest(project, id)
        .then(async (record) => {
          setForm(record);
          if (editorKind === "bug" && isAdmin && isGestorReplyUnread(record)) {
            try {
              setForm(await api.markGestorCommentSeen(project, id));
            } catch {
              /* lista ainda mostra não lido; o card continua */
            }
          }
        })
        .catch(() => {
          if (isVisitor) {
            navigate(VISITOR_HOME_PATH, { replace: true });
            return;
          }
          toast.error("Registro não encontrado");
        });
    } else {
      const fromTest = (location.state as { draft?: Partial<TestRecord> } | null)?.draft;
      setForm(fromTest ?? emptyDraft(project, channel, editorKind));
    }
    // Não incluir isAdmin / location.state: Alt+Tab e refresh de token
    // re-disparavam o GET e apagavam o texto não salvo.
  }, [project, id, isNew, channel, editorKind]);

  useEffect(() => {
    if (isNew || !id || editorKind !== "bug") return;
    const onReply = (event: Event) => {
      const detail = (event as CustomEvent<GestorReplyEvent>).detail;
      if (detail.bugId !== id) return;
      void api.getTest(project, id).then(setForm);
    };
    window.addEventListener(QA_GESTOR_REPLY_EVENT, onReply);
    return () => window.removeEventListener(QA_GESTOR_REPLY_EVENT, onReply);
  }, [project, id, isNew, editorKind]);

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
    if (!isAdmin) return;
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
        ...(runner === "playwright" ? { headed: playwrightHeaded } : {}),
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
      toast.error("Salve o registro antes de anexar evidência");
      return;
    }
    if (uploadProgress) return;
    setUploadProgress({ filename: file.name, percent: 0 });
    try {
      await api.uploadEvidence(project, id, file, {
        onProgress: (percent) =>
          setUploadProgress((prev) =>
            prev ? { ...prev, percent } : { filename: file.name, percent },
          ),
      });
      setForm(await api.getTest(project, id));
      toast.success("Evidência anexada");
    } catch (e) {
      toast.error(toastErrorMessage(e, "Falha no upload da evidência"));
    } finally {
      setUploadProgress(null);
    }
  }

  async function onRemoveEvidence(ev: { fileId: string; filename: string }) {
    if (!id || isNew) return;
    const ok = await confirm({
      title: "Remover evidência?",
      description: `Tira “${ev.filename}” deste registro. O arquivo some do Storage.`,
      confirmLabel: "Remover",
      tone: "danger",
    });
    if (!ok) return;
    setRemovingEvidenceId(ev.fileId);
    try {
      const updated = await api.deleteEvidence(project, id, ev.fileId);
      setForm(updated);
      toast.success("Evidência removida");
    } catch (e) {
      toast.error(toastErrorMessage(e, "Não foi possível remover a evidência"));
    } finally {
      setRemovingEvidenceId(null);
    }
  }

  async function markGestorSeen() {
    if (!id || isNew) return;
    try {
      setForm(await api.markGestorCommentSeen(project, id));
    } catch {
      /* ignore */
    }
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

  async function copyBugReportMarkdown() {
    const text = formatBugReportMarkdown(form);
    const ok = await copyDiscordReport(text);
    if (ok) toast.success("Report Markdown copiado");
    else toast.error("Não foi possível copiar (permissão do navegador)");
  }

  async function copyChamadoPolygonus() {
    const text = formatChamadoPolygonus(form);
    const ok = await copyDiscordReport(text);
    if (ok) {
      toast.success(
        "Texto do chamado copiado — cole título e descrição nos campos do sistema Polygonus",
      );
    } else {
      toast.error("Não foi possível copiar (permissão do navegador)");
    }
  }

  async function openGithubIssue() {
    if (!id || isNew) {
      toast.error("Salve o bug antes de abrir a issue");
      return;
    }
    setGithubBusy("opening");
    setGithubProgress({ message: "Abrindo issue no GitHub…", percent: 6 });
    const toastId = toast.info("Abrindo issue no GitHub…", {
      title: "GitHub",
      duration: 0,
      progress: 6,
    });
    try {
      const res = await api.openGithubIssue(project, id, (ev) => {
        const percent = githubIssueProgressPercent(ev);
        setGithubProgress({
          message: ev.message,
          percent,
          filename: ev.filename,
        });
        toast.update(toastId, { message: ev.message, progress: percent });
      });
      setForm(res.report);
      if (res.alreadyLinked) {
        toast.update(toastId, {
          variant: "info",
          title: "GitHub",
          message: `Issue já vinculada: #${res.number}`,
          progress: 100,
          duration: 5000,
        });
      } else {
        const n = res.evidenceUploaded ?? 0;
        const skip = res.evidenceSkipped?.length ?? 0;
        const evHint =
          n > 0
            ? ` · ${n} evidência${n === 1 ? "" : "s"}`
            : skip > 0
              ? " · sem evidências anexadas"
              : "";
        toast.update(toastId, {
          variant: "success",
          title: "GitHub",
          message: `Issue #${res.number} aberta${evHint}`,
          progress: 100,
          duration: 6000,
          action: res.url
            ? { label: "Abrir issue", onClick: () => window.open(res.url, "_blank", "noopener,noreferrer") }
            : undefined,
        });
        if (skip > 0) {
          toast.info(
            `${skip} arquivo(s) não anexado(s): ${res.evidenceSkipped
              .map((s) => s.filename)
              .join(", ")}`,
          );
        }
      }
      if (res.url) window.open(res.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.dismiss(toastId);
      toast.error(toastErrorMessage(e, "Falha ao abrir issue"), { title: "GitHub" });
    } finally {
      setGithubBusy(null);
      setGithubProgress(null);
    }
  }

  async function syncGithubIssue() {
    if (!id || isNew) {
      toast.error("Salve o bug antes de sincronizar a issue");
      return;
    }
    if (!form.githubIssueNumber || !form.githubIssueUrl) {
      toast.error("Bug sem issue vinculada — abra a issue primeiro");
      return;
    }
    const issueNo = form.githubIssueNumber;
    setGithubBusy("syncing");
    setGithubProgress({ message: "Salvando o bug no Desk…", percent: 6 });
    const toastId = toast.info(`Sincronizando issue #${issueNo}…`, {
      title: "Sync GitHub",
      duration: 0,
      progress: 6,
    });
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
      const saved = await api.updateTest(project, id, payload);
      setForm(saved);
      setGithubProgress({ message: "Enviando para o GitHub…", percent: 12 });
      toast.update(toastId, {
        message: "Enviando título, body e evidências…",
        progress: 12,
      });

      const res = await api.syncGithubIssue(project, id, (ev) => {
        const percent = githubIssueProgressPercent(ev);
        setGithubProgress({
          message: ev.message,
          percent,
          filename: ev.filename,
        });
        toast.update(toastId, { message: ev.message, progress: percent });
      });
      setForm(res.report);
      const n = res.evidenceUploaded ?? 0;
      const skip = res.evidenceSkipped?.length ?? 0;
      const parts = [`Issue #${res.number} sincronizada`];
      if (n > 0) parts.push(`${n} evidência${n === 1 ? "" : "s"}`);
      if (res.commentCatchup?.applied) {
        parts.push(
          res.commentCatchup.commentAuthor
            ? `comentário de @${res.commentCatchup.commentAuthor}`
            : "comentário do gestor",
        );
      }
      toast.update(toastId, {
        variant: "success",
        title: "Sync GitHub",
        message: parts.join(" · "),
        progress: 100,
        duration: 7000,
        action: res.url
          ? {
              label: "Abrir issue",
              onClick: () => window.open(res.url, "_blank", "noopener,noreferrer"),
            }
          : undefined,
      });
      if (skip > 0) {
        toast.info(
          `${skip} arquivo(s) não anexado(s): ${res.evidenceSkipped
            .map((s) => s.filename)
            .join(", ")}`,
        );
      }
    } catch (e) {
      toast.dismiss(toastId);
      toast.error(toastErrorMessage(e, "Falha ao sincronizar issue"), {
        title: "Sync GitHub",
      });
    } finally {
      setGithubBusy(null);
      setGithubProgress(null);
    }
  }

  async function closeGithubIssue() {
    if (!id || isNew) {
      toast.error("Salve o bug antes de fechar a issue");
      return;
    }
    if (!form.githubIssueNumber || !form.githubIssueUrl) {
      toast.error("Bug sem issue vinculada");
      return;
    }
    if (form.githubIssueClosedAt) {
      toast.info("Issue já marcada como fechada no Desk");
      return;
    }

    const build = (form.build ?? "").trim();
    const draftComment = [
      "Homologado.",
      "",
      build ? `Build: ${build}` : "Build: (informar)",
    ].join("\n");

    const comment = await confirm({
      title: `Fechar issue #${form.githubIssueNumber}?`,
      description:
        "O status do bug no Desk passa para Corrigido (gestor), salvo se já estiver homologado/arquivado.\n\n" +
        "Edite o comentário abaixo (ou apague para fechar sem comentar).",
      confirmLabel: "Fechar issue",
      cancelLabel: "Cancelar",
      tone: "default",
      input: {
        label: "Comentário na issue",
        defaultValue: draftComment,
        rows: 5,
      },
    });
    if (comment === null) return;

    setGithubBusy("closing");
    const toastId = toast.info(`Fechando issue #${form.githubIssueNumber}…`, {
      title: "GitHub",
      duration: 0,
      progress: 40,
    });
    try {
      const res = await api.closeGithubIssue(project, id, {
        comment: comment.trim() || undefined,
      });
      setForm(res.report);
      const parts = [
        res.alreadyClosed
          ? `Issue #${res.number} já estava fechada — Desk alinhado`
          : `Issue #${res.number} fechada no GitHub`,
      ];
      if (res.commentPosted) parts.push("comentário publicado");
      toast.update(toastId, {
        variant: "success",
        title: "GitHub",
        message: parts.join(" · "),
        progress: 100,
        duration: 6000,
      });
    } catch (e) {
      toast.dismiss(toastId);
      toast.error(toastErrorMessage(e, "Falha ao fechar issue"), { title: "GitHub" });
    } finally {
      setGithubBusy(null);
    }
  }

  function reportBugFromTest() {
    if (!form.id || !isTestCase(form)) return;
    if (!form.consolidated) {
      const ok = window.confirm(
        "Este caso ainda não está marcado como consolidado.\n\n" +
          "Falhas podem ser do script (mapeamento/flakiness), não do produto.\n\n" +
          "Continuar mesmo assim?",
      );
      if (!ok) return;
    }
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
          severity: form.severity ?? "media",
          osVersion: form.osVersion,
          deviceLabel: form.deviceLabel,
          browser: form.browser,
          testLogin: form.testLogin,
          technicalEvidence: form.technicalEvidence,
          tags: [`origem:${form.id}`],
        },
      },
    });
  }

  const isMobileChannel =
    form.channel === "app" ||
    form.platform === "android" ||
    form.platform === "ios" ||
    form.platform === "app_web";
  const isWebChannel =
    form.channel === "web" || form.platform === "web" || form.platform === "app_web";
  const maestroAllowed = channelSupportsMaestro(form.channel);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <PremiumTooltip label="Voltar à lista" side="bottom">
          <Link
            to={listPathFor(form)}
            className={cn(actionBtnBase, actionBtn.back, "size-9 px-0")}
            aria-label="Voltar à lista"
          >
            <ArrowLeft className="size-4" />
          </Link>
        </PremiumTooltip>
        <div>
          <p className="font-mono text-xs text-muted-foreground">
            {isNew
              ? editingBug
                ? "Novo bug · código APP/WEB-nn ao salvar"
                : "Novo teste"
              : formatRecordId(form.id ?? "", form as TestRecord)}
            {!isNew && editingBug && form.bugCode && form.id && (
              <span className="ml-2 text-muted-foreground/70">({form.id})</span>
            )}
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
          {!isNew && editingBug && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {(() => {
                const { label, tone } = displayStatus(form as TestRecord);
                return (
                  <span
                    className={cn(
                      "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
                      tone === "ok" &&
                        "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
                      tone === "warn" &&
                        "border-amber-500/40 bg-amber-500/15 text-amber-300",
                      tone === "neutral" &&
                        "border-border bg-muted text-muted-foreground",
                    )}
                  >
                    {label}
                  </span>
                );
              })()}
              {(form.priority ?? form.severity) && (
                <span className="rounded-full border border-border bg-[#1a1a1a] px-2 py-0.5 text-[0.65rem] text-muted-foreground">
                  {PRIORITY_LABELS[(form.priority ?? form.severity)!]}
                </span>
              )}
              {form.platform === "app_web" ? (
                <>
                  <span className="rounded-full border border-border bg-[#1a1a1a] px-2 py-0.5 text-[0.65rem] text-muted-foreground">
                    App nativo
                  </span>
                  <span className="rounded-full border border-border bg-[#1a1a1a] px-2 py-0.5 text-[0.65rem] text-muted-foreground">
                    APP versão WEB
                  </span>
                </>
              ) : (
                form.platform && (
                  <span className="rounded-full border border-border bg-[#1a1a1a] px-2 py-0.5 text-[0.65rem] text-muted-foreground">
                    {PLATFORM_LABELS[form.platform]}
                  </span>
                )
              )}
              {isGestorReplyUnread(form as TestRecord) && (
                <span className="rounded-full border border-amber-400/20 bg-[#1a1a1a] px-2 py-0.5 text-[0.65rem] text-amber-300">
                  Não lido
                  {form.githubIssueLastCommentBy
                    ? ` · @${form.githubIssueLastCommentBy}`
                    : ""}
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
        <fieldset
          disabled={!isAdmin}
          className={cn(
            "min-w-0 border-0 p-0",
            !isAdmin &&
              "[&_button]:pointer-events-none [&_input]:cursor-default [&_select]:cursor-default [&_select]:opacity-100 [&_textarea]:cursor-default",
          )}
        >
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_17.5rem]">
          <div className="min-w-0 space-y-6 rounded-xl border bg-card p-4 sm:p-6">
            <FormSection title={editingBug ? "Chamado" : "Caso"}>
            <Field label="Título *">
              <input
                className={QUIET_INPUT}
                placeholder={
                  editingBug
                    ? "Ex.: App — eletivas ausentes no filtro de disciplina"
                    : undefined
                }
                value={form.title ?? ""}
                onChange={(e) => update("title", e.target.value)}
              />
            </Field>
            {editingBug ? (
              isAdmin ? (
              <Field
                label="Citação do chamado"
                hint="Id ou trecho do chamado Polygonus. Não aparece no portfólio visitante."
              >
                <textarea
                  className={cn(QUIET_INPUT, "min-h-24")}
                  placeholder="Ex.: Solicitação #12345 — aluno não vê eletivas no filtro…"
                  value={form.description ?? ""}
                  onChange={(e) => update("description", e.target.value)}
                />
              </Field>
              ) : null
            ) : (
              <Field label="Descrição">
                <textarea
                  className={cn(QUIET_INPUT, "min-h-24")}
                  value={form.description ?? ""}
                  onChange={(e) => update("description", e.target.value)}
                />
              </Field>
            )}
            <Field label="Pré-condições">
              <textarea
                className={cn(QUIET_INPUT, "min-h-16")}
                placeholder={
                  editingBug ? "Ex.: Aluno autenticado na amostra CQ build 6.06.x" : undefined
                }
                value={form.preconditions ?? ""}
                onChange={(e) => update("preconditions", e.target.value)}
              />
            </Field>
            </FormSection>
            <FormSection title={editingBug ? "Reprodução" : "Passos"}>
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {!editingBug ? (
                  <div className="inline-flex rounded-md border p-0.5 text-xs">
                    <PremiumTooltip label="Atalho QA / Discord" side="bottom">
                      <button
                        type="button"
                        className={cn(
                          "rounded px-2 py-0.5",
                          stepsMode === "resumo"
                            ? "bg-muted font-medium text-foreground"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                        onClick={() => setStepsMode("resumo")}
                      >
                        Resumo
                      </button>
                    </PremiumTooltip>
                    <PremiumTooltip label="Roteiro detalhado + âncoras Maestro" side="bottom">
                      <button
                        type="button"
                        className={cn(
                          "rounded px-2 py-0.5",
                          stepsMode === "detalhado"
                            ? "bg-muted font-medium text-foreground"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                        onClick={() => setStepsMode("detalhado")}
                      >
                        Detalhado
                      </button>
                    </PremiumTooltip>
                  </div>
                  ) : (
                    <span className="text-[0.7rem] text-muted-foreground">
                      O que o gestor precisa repetir, na ordem.
                    </span>
                  )}
                </div>
                {isAdmin && (
                <div className="flex flex-wrap gap-2">
                  <PremiumTooltip label="Normaliza numeração, espaços e unicode" side="bottom" wide>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted/50"
                      onClick={applyTextPolish}
                    >
                      <Sparkles className="size-3" /> Corrigir texto
                    </button>
                  </PremiumTooltip>
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
                )}
              </div>
              {!editingBug && (
              <p className="mb-2 text-[0.7rem] text-muted-foreground">
                {stepsMode === "resumo"
                  ? "Enxuto — atalho para você e reports curtos."
                  : "1 toque por linha. Âncoras Maestro (flow/ação) ligam a falha da automação a este passo."}
              </p>
              )}
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
                                  QUIET_INPUT,
                                  isFailedStep && "border-red-500/50 bg-red-500/10",
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
                            {isAdmin && (
                            <PremiumTooltip label="Remover passo" side="top" align="end">
                              <button
                                type="button"
                                className="mt-1 rounded p-1 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
                                aria-label="Remover passo"
                                onClick={() =>
                                  update(
                                    "steps",
                                    list.filter((_, j) => j !== i),
                                  )
                                }
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </PremiumTooltip>
                            )}
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
                                    QUIET_INPUT,
                                    isFailedStep && "border-red-500/50 bg-red-500/10",
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
                                  <PremiumTooltip
                                    label="Basename do flow Maestro que corresponde a este passo"
                                    side="top"
                                    wide
                                  >
                                    <input
                                      className="w-full rounded-md border border-dashed px-2 py-1 text-[0.7rem] text-muted-foreground"
                                      value={(step.flows ?? []).join(", ")}
                                      placeholder="Flows YAML (vírgula) — ex. abrir_filtro_extras_composer.yaml"
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
                                  </PremiumTooltip>
                                  <PremiumTooltip
                                    label="Trecho da ação Maestro (Tap on …) que casa com este passo"
                                    side="top"
                                    wide
                                  >
                                    <input
                                      className="w-full rounded-md border border-dashed px-2 py-1 text-[0.7rem] text-muted-foreground"
                                      value={(step.actions ?? []).join(", ")}
                                      placeholder="Ações (vírgula) — ex. mural_composer_filtro"
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
                                  </PremiumTooltip>
                                </div>
                                {isFailedStep && failInfo && (
                                  <p className="text-[0.7rem] text-red-300">
                                    Falhou aqui
                                    {failInfo.action ? ` · ${failInfo.action}` : ""}
                                    {failInfo.flow ? ` · ${failInfo.flow}` : ""}
                                  </p>
                                )}
                              </div>
                              {isAdmin && (
                              <PremiumTooltip label="Remover passo" side="top" align="end">
                                <button
                                  type="button"
                                  className="mt-1 rounded p-1 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
                                  aria-label="Remover passo"
                                  onClick={() =>
                                    setDetailed(list.filter((_, j) => j !== i))
                                  }
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              </PremiumTooltip>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
            </FormSection>
            <FormSection title="Resultado">
            <Field label="Resultado esperado">
              <textarea
                className={cn(QUIET_INPUT, "min-h-16")}
                placeholder={
                  editingBug
                    ? "Ex.: Lista de eletivas aparece no filtro de disciplina"
                    : undefined
                }
                value={form.expectedResult ?? ""}
                onChange={(e) => update("expectedResult", e.target.value)}
              />
            </Field>
            {!isHomologation && (
              <Field label="Resultado observado">
                {isVisitor ? (
                  <VisitorRedactedNote field="O resultado observado" />
                ) : (
                <textarea
                  className={cn(QUIET_INPUT, "min-h-16")}
                  placeholder={
                    editingBug
                      ? "Ex.: Filtro abre sem as eletivas cadastradas"
                      : undefined
                  }
                  value={form.actualResult ?? ""}
                  onChange={(e) => update("actualResult", e.target.value)}
                />
                )}
              </Field>
            )}
            {isHomologation && form.homologationStatus === "falhou" && (
              <Field label="Observações (falha / bug encontrado)">
                {isVisitor ? (
                  <VisitorRedactedNote field="As observações de falha" />
                ) : (
                <textarea
                  className={cn(QUIET_INPUT, "min-h-16")}
                  placeholder="Descreva o que falhou ou converta para Bug encontrado no painel lateral"
                  value={form.actualResult ?? ""}
                  onChange={(e) => update("actualResult", e.target.value)}
                />
                )}
              </Field>
            )}
            </FormSection>

            <FormSection title="Evidências">
            <div>
            <div className="flex flex-wrap gap-3">
                {(form.evidence ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum print ainda.</p>
                )}
                {(form.evidence ?? []).map((ev) => (
                  <div key={ev.fileId} className="group relative">
                    <PremiumTooltip label={ev.filename} side="top">
                      <a
                        href={api.evidenceUrl(ev.storageKey)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block overflow-hidden rounded-md border"
                      >
                        {ev.type === "video" ? (
                          <span className="relative block h-24 w-36 overflow-hidden bg-muted/40">
                            <video
                              src={api.evidenceUrl(ev.storageKey)}
                              className="h-full w-full object-cover"
                              muted
                              preload="metadata"
                            />
                            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/55 py-1 text-[0.65rem] text-white">
                              <Video className="size-3.5" />
                              Vídeo
                            </span>
                          </span>
                        ) : (
                          <img
                            src={api.evidenceUrl(ev.storageKey)}
                            alt={ev.filename}
                            className="h-24 w-auto object-cover"
                          />
                        )}
                      </a>
                    </PremiumTooltip>
                    {isAdmin && !isNew && (
                      <PremiumTooltip label="Remover evidência" side="top" align="end">
                        <button
                          type="button"
                          aria-label={`Remover ${ev.filename}`}
                          disabled={removingEvidenceId === ev.fileId}
                          onClick={() => void onRemoveEvidence(ev)}
                          className="absolute top-1 right-1 rounded bg-black/70 p-1 text-white opacity-90 transition-opacity hover:bg-red-600 hover:opacity-100 disabled:opacity-50"
                        >
                          {removingEvidenceId === ev.fileId ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                        </button>
                      </PremiumTooltip>
                    )}
                  </div>
                ))}
              </div>
              {uploadProgress && (
                <div
                  className="mt-3 space-y-1.5 rounded-md border border-border/80 bg-muted/30 px-3 py-2"
                  role="status"
                  aria-live="polite"
                  aria-label={`Enviando ${uploadProgress.filename}: ${uploadProgress.percent}%`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Loader2 className="size-3.5 shrink-0 animate-spin" />
                      <span className="truncate">{uploadProgress.filename}</span>
                    </span>
                    <span className="shrink-0 tabular-nums font-medium text-foreground">
                      {uploadProgress.percent}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-150 ease-out"
                      style={{ width: `${uploadProgress.percent}%` }}
                    />
                  </div>
                </div>
              )}
              {isAdmin && (
              <label
                className={cn(
                  "mt-3 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm surface-brand",
                  uploadProgress
                    ? "pointer-events-none cursor-not-allowed opacity-60"
                    : "cursor-pointer hover:brightness-110",
                )}
              >
                {uploadProgress ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                {uploadProgress ? "Enviando…" : "Anexar print / vídeo"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.mkv"
                  className="hidden"
                  disabled={Boolean(uploadProgress)}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void onUpload(f);
                  }}
                />
              </label>
              )}
            </div>
            </FormSection>
          </div>

          <aside className="sticky top-8 max-h-[calc(100vh-4rem)] min-w-0 space-y-4 self-start overflow-y-auto rounded-xl border bg-card p-4 scrollbar-thin">
            {editingBug && isAdmin && (
              <div className="flex min-w-0 flex-col gap-2 border-b border-border/60 pb-4">
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={deskBusy}
                  className={cn(actionBtnBase, actionBtn.save, "w-full")}
                >
                  {saving ? "Salvando…" : githubBusy ? "Aguarde o GitHub…" : "Salvar"}
                </button>
                <PremiumTooltip
                  label="Texto puro (sem Markdown) para colar no chamado Polygonus — título e descrição separados"
                  side="left"
                  wide
                >
                  <button
                    type="button"
                    onClick={() => void copyChamadoPolygonus()}
                    className={cn(actionBtnBase, actionBtn.ghost, "w-full")}
                  >
                    <Copy className="size-4" />
                    Copiar para chamado Polygonus
                  </button>
                </PremiumTooltip>
                <PremiumTooltip
                  label="Copia o Markdown estruturado (mesmo body da issue)"
                  side="left"
                  wide
                >
                  <button
                    type="button"
                    onClick={() => void copyBugReportMarkdown()}
                    className={cn(actionBtnBase, actionBtn.ghost, "w-full")}
                  >
                    <Copy className="size-4" />
                    Copiar report Markdown
                  </button>
                </PremiumTooltip>
                {!isNew && !form.githubIssueUrl && (
                  <PremiumTooltip
                    label="Abre issue em polygonus-suporte-kb com label bug (handoff ao time)"
                    side="left"
                    wide
                  >
                    <button
                      type="button"
                      onClick={() => void openGithubIssue()}
                      disabled={deskBusy}
                      className={cn(actionBtnBase, actionBtn.create, "w-full")}
                    >
                      {githubBusy === "opening" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <ExternalLink className="size-4" />
                      )}
                      {githubBusy === "opening" ? "Abrindo issue…" : "Abrir issue GitHub"}
                    </button>
                  </PremiumTooltip>
                )}
                {!isNew && form.githubIssueUrl && (
                  <PremiumTooltip
                    label={`Envia título, body e evidências do Desk para a issue #${form.githubIssueNumber} (não cria issue nova). Também busca comentários do gestor perdidos pelo webhook.`}
                    side="left"
                    wide
                  >
                    <button
                      type="button"
                      onClick={() => void syncGithubIssue()}
                      disabled={deskBusy}
                      aria-busy={githubBusy === "syncing"}
                      className={cn(actionBtnBase, actionBtn.checklist, "w-full")}
                    >
                      {githubBusy === "syncing" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <RefreshCw className="size-4" />
                      )}
                      {githubBusy === "syncing" ? "Sincronizando…" : "Sync issue GitHub"}
                    </button>
                  </PremiumTooltip>
                )}
                {!isNew && form.githubIssueUrl && !form.githubIssueClosedAt && (
                  <PremiumTooltip
                    label={`Fecha a issue #${form.githubIssueNumber} no GitHub, com comentário editável de homologação/build, e alinha o status no Desk`}
                    side="left"
                    wide
                  >
                    <button
                      type="button"
                      onClick={() => void closeGithubIssue()}
                      disabled={deskBusy}
                      className={cn(actionBtnBase, actionBtn.ghost, "w-full")}
                    >
                      {githubBusy === "closing" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-4" />
                      )}
                      {githubBusy === "closing" ? "Fechando issue…" : "Fechar issue GitHub"}
                    </button>
                  </PremiumTooltip>
                )}
                {githubProgress && (
                  <GithubIssueProgressCard progress={githubProgress} />
                )}
                <AmbienteIssuePreview record={form} />
                {form.githubIssueUrl && (
                  <a
                    href={form.githubIssueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
                  >
                    Issue #{form.githubIssueNumber} · abrir no GitHub
                  </a>
                )}
                {form.githubIssueLastCommentAt && (
                  <div
                    className={cn(
                      "min-w-0 overflow-hidden rounded-md border px-3 py-2 text-left text-xs",
                      isGestorReplyUnread(form as TestRecord)
                        ? "border-amber-500/30 bg-amber-500/10"
                        : "border-border/70 bg-muted/20",
                    )}
                  >
                    <p
                      className={cn(
                        "font-medium",
                        isGestorReplyUnread(form as TestRecord)
                          ? "text-amber-200"
                          : "text-muted-foreground",
                      )}
                    >
                      {isGestorReplyUnread(form as TestRecord)
                        ? "Não lido"
                        : "Última resposta"}
                      {form.githubIssueLastCommentBy
                        ? ` · @${form.githubIssueLastCommentBy}`
                        : ""}
                    </p>
                    {form.githubIssueLastCommentBody && (
                      <p className="mt-1 max-h-32 overflow-y-auto wrap-anywhere text-muted-foreground">
                        {form.githubIssueLastCommentBody}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {form.githubIssueLastCommentUrl && (
                        <a
                          href={form.githubIssueLastCommentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-amber-300/90 underline-offset-2 hover:underline"
                        >
                          Ver comentário
                        </a>
                      )}
                      {isGestorReplyUnread(form as TestRecord) && (
                        <button
                          type="button"
                          className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                          onClick={() => void markGestorSeen()}
                        >
                          Marcar como lido
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {form.status === "corrigido_gestor" && !isNew && (
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
              </div>
            )}
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
            {!editingBug && (
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
            )}

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
              <>
              <PropSelect
                label="Status do bug"
                value={form.status ?? "rascunho"}
                options={Object.entries(BUG_STATUS_LABELS).map(([k, v]) => ({
                  value: k,
                  label: v,
                }))}
                onChange={(v) => update("status", v as BugStatus)}
              />
              <PropSelect
                label="Prioridade"
                value={form.priority ?? form.severity ?? "media"}
                options={(
                  Object.keys(PRIORITY_LABELS) as Array<
                    NonNullable<TestRecord["priority"]>
                  >
                ).map((k) => ({
                  value: k,
                  label: PRIORITY_LABELS[k],
                }))}
                onChange={(v) => {
                  const level = v as NonNullable<TestRecord["priority"]>;
                  setForm((f) => ({ ...f, priority: level, severity: level }));
                }}
              />
              </>
            )}

            <PropSelect
              label="Plataforma"
              value={form.platform ?? "web"}
              options={(Object.keys(PLATFORM_LABELS) as Array<TestRecord["platform"]>).map(
                (k) => ({
                  value: k,
                  label: PLATFORM_LABELS[k],
                }),
              )}
              onChange={(v) => update("platform", v as TestRecord["platform"])}
              disabled={!isAdmin}
            />
            {isAdmin && (
            <DesignCheckbox
              className="rounded-md border border-border bg-muted/20 px-3 py-2"
              checked={Boolean(form.showInPortfolio)}
              disabled={!isAdmin}
              onChange={(e) => update("showInPortfolio", e.target.checked)}
              label={<span className="font-medium text-[var(--foreground)]">Mostrar no portfólio</span>}
              description="Visitantes autenticados só veem itens marcados aqui."
            />
            )}
            {isAdmin && form.showInPortfolio && (
              <div className="rounded-md border border-dashed border-border bg-muted/15 px-3 py-2 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Preview visitante</p>
                <p className="mt-1">
                  Vê: título, passos, esperado, evidências (PII mascarada no servidor).
                </p>
                <p className="mt-1">
                  Não vê:{" "}
                  {editingBug ? "citação do chamado, " : ""}
                  resultado observado, automação, histórico, logs.
                </p>
              </div>
            )}
            <details
              className={
                editingBug ? "rounded-md border border-border/70" : "contents"
              }
            >
              <summary
                className={cn(
                  "cursor-pointer px-3 py-2 text-sm font-medium text-muted-foreground",
                  !editingBug && "hidden",
                )}
              >
                Ambiente / report
              </summary>
              <div
                className={
                  editingBug
                    ? "space-y-4 border-t border-border/60 px-3 py-3"
                    : "contents"
                }
              >
            <Field label="Módulo">
              <input
                className={QUIET_INPUT}
                value={form.module ?? ""}
                onChange={(e) => update("module", e.target.value)}
              />
            </Field>
            <Field label="Login (report)">
              <input
                className={QUIET_INPUT}
                value={form.testLogin ?? ""}
                onChange={(e) => update("testLogin", e.target.value)}
                placeholder="Ex.: PHJESUS, ETMENEZES, SUPPETER"
              />
            </Field>
            <Field
              label={
                form.channel === "web"
                  ? "Versão (login amostra CQ)"
                  : "Versão do app (tela Perfil)"
              }
            >
              <PremiumTooltip
                label={
                  form.channel === "web"
                    ? "Front/Back do rodapé do login na amostra CQ — atualizado ao rodar Playwright"
                    : "Mesma Versão da tela Perfil (APP nativo e APP WEB). Atualizada ao confirmar o perfil em cada execução."
                }
                side="top"
                wide
              >
                <input
                  className={cn(QUIET_INPUT, "font-mono")}
                  value={form.build ?? ""}
                  onChange={(e) => update("build", e.target.value)}
                  placeholder={
                    form.channel === "web"
                      ? "Front: … · Back: … — ao rodar Playwright"
                      : "Versão: 6.06.xx — ao confirmar o perfil"
                  }
                />
              </PremiumTooltip>
            </Field>
            {isMobileChannel && (
              <>
                <Field label="SO / API (report)">
                  <input
                    className={QUIET_INPUT}
                    value={form.osVersion ?? ""}
                    onChange={(e) => update("osVersion", e.target.value)}
                    placeholder="Ex.: Android API 33 — Medium_Phone"
                  />
                </Field>
                <Field label="Dispositivo (report)">
                  <input
                    className={QUIET_INPUT}
                    value={form.deviceLabel ?? ""}
                    onChange={(e) => update("deviceLabel", e.target.value)}
                    placeholder="emulador, celular, emulador + celular"
                  />
                </Field>
                {!isHomologation && (
                  <Field label="Evidência técnica (report)">
                    <textarea
                      className={cn(QUIET_INPUT, "min-h-16")}
                      value={form.technicalEvidence ?? ""}
                      onChange={(e) => update("technicalEvidence", e.target.value)}
                      placeholder="JSON datEnvio, log Maestro, stack…"
                    />
                  </Field>
                )}
              </>
            )}
            {isWebChannel && (
              <Field label="Navegador (report)">
                <input
                  className={QUIET_INPUT}
                  value={form.browser ?? ""}
                  onChange={(e) => update("browser", e.target.value)}
                  placeholder="Ex.: Chrome, Edge, Playwright Chromium"
                />
              </Field>
            )}
              </div>
            </details>

            {isHomologation && isAdmin && (
            <div className="space-y-4 border-t pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">Automação</span>
                {maestroAllowed && form.automation?.prep?.type === "playwright" && (
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

              <DesignCheckbox
                className="rounded-md border border-border bg-muted/20 px-3 py-2"
                checked={Boolean(form.consolidated)}
                onChange={(e) => update("consolidated", e.target.checked)}
                label={
                  <span className="font-medium text-foreground">Script consolidado</span>
                }
                description="Manual: falha deste CT pode ser tratada como bug de produto. Diferente de “Estável” (ready após 2 passes na suite)."
              />

              {maestroAllowed && (
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
                        <option value="ready">Estável na suite (2 passes)</option>
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
              )}

              <div className="space-y-2 rounded-lg border border-sky-500/25 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-300/90">
                  Web / Playwright
                </p>
                <p className="text-[0.7rem] text-muted-foreground">
                  {maestroAllowed
                    ? "Mesmo CT, executor alternativo (App no navegador). Separado do seed acima."
                    : "Executor Web/Portal — specs Playwright na amostra CQ."}
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
                        <option value="ready">Estável na suite</option>
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
                  <>
                    <DesignCheckbox
                      className="rounded-md border px-2.5 py-2"
                      checked={!playwrightHeaded}
                      disabled={busyRun}
                      onChange={(e) => {
                        const headless = e.target.checked;
                        writePlaywrightHeaded(!headless);
                        setPlaywrightHeaded(!headless);
                      }}
                      label={
                        <span className="font-medium text-foreground">
                          Headless
                        </span>
                      }
                      description="Sem janela Chrome. Na amostra, Cloudflare pode exigir headed."
                    />
                    <PremiumTooltip
                      label={
                        playwrightHeaded
                          ? "Rodar só o spec Playwright (Chrome visível)"
                          : "Rodar Playwright em headless"
                      }
                      side="left"
                      wide
                      className="w-full"
                    >
                      <button
                        type="button"
                        onClick={() => void runAutomationStage("all", "playwright")}
                        disabled={busyRun || saving}
                        className={cn(actionBtnBase, actionBtn.run, "w-full")}
                      >
                        <Play className="size-4" />
                        {busyRun
                          ? "Executando…"
                          : playwrightHeaded
                            ? "Executar Playwright (Web)"
                            : "Executar Playwright (headless)"}
                      </button>
                    </PremiumTooltip>
                  </>
                )}
              </div>

              {!isNew && maestroAllowed && form.automation?.flowPath && (
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
                    <PremiumTooltip
                      label={
                        deviceStatus?.agentOnline
                          ? "Envia pedido ao agente no PC para ligar o AVD"
                          : `Inicia o AVD ${deviceStatus?.avdName ?? "Medium_Phone"} via Android SDK`
                      }
                      side="left"
                      wide
                      className="w-full"
                    >
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
                    >
                      <Smartphone className="size-4" />
                      {startingEmulator ? "Aguardando boot…" : "Ligar emulador"}
                    </button>
                    </PremiumTooltip>
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
                  <PremiumTooltip
                    label={
                      form.automation?.prep
                        ? "Playwright (seed) e depois Maestro"
                        : "Rodar flow Maestro"
                    }
                    side="left"
                    wide
                    className="w-full"
                  >
                  <button
                    type="button"
                    onClick={() => void runAutomationStage("all", "maestro")}
                    disabled={busyRun || saving || startingEmulator}
                    className={cn(actionBtnBase, actionBtn.run, "w-full")}
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
                  </PremiumTooltip>
                  {form.automation?.prep?.type === "playwright" && (
                    <div className="grid grid-cols-2 gap-2">
                      <PremiumTooltip label="Só ajusta DN no web (Chrome headed)" side="top" wide>
                      <button
                        type="button"
                        onClick={() => void runAutomationStage("prep", "maestro")}
                        disabled={busyRun || saving}
                        className={cn(actionBtnBase, actionBtn.back, "w-full text-xs")}
                      >
                        Seed DN
                      </button>
                      </PremiumTooltip>
                      <PremiumTooltip label="Só Maestro (DN já ok)" side="top" wide>
                      <button
                        type="button"
                        onClick={() => void runAutomationStage("maestro", "maestro")}
                        disabled={busyRun || saving || startingEmulator}
                        className={cn(actionBtnBase, actionBtn.back, "w-full text-xs")}
                      >
                        Só app
                      </button>
                      </PremiumTooltip>
                    </div>
                  )}
                </div>
              )}
            </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              {isAdmin && isHomologation && !isNew && (
                <PremiumTooltip
                  label={
                    form.consolidated
                      ? "Abre um novo bug com dados deste caso de teste"
                      : "CT não consolidado — pedirá confirmação (falha pode ser do script)"
                  }
                  side="left"
                  wide
                >
                <button
                  type="button"
                  onClick={reportBugFromTest}
                  className={cn(actionBtnBase, actionBtn.ghost, "w-full")}
                >
                  <Bug className="size-4" />
                  Reportar bug deste teste
                  {!form.consolidated && (
                    <span className="text-[0.65rem] text-muted-foreground">(não consolidado)</span>
                  )}
                </button>
                </PremiumTooltip>
              )}
              {!editingBug && (
              <>
              <PremiumTooltip label="Copia o Markdown estruturado (mesmo body da issue)" side="left" wide>
              <button
                type="button"
                onClick={() => void copyBugReportMarkdown()}
                className={cn(actionBtnBase, actionBtn.ghost, "w-full")}
              >
                <Copy className="size-4" />
                Copiar report Markdown
              </button>
              </PremiumTooltip>
              {isAdmin && !isNew && isBugReport(form) && !form.githubIssueUrl && (
                <PremiumTooltip
                  label="Abre issue em polygonus-suporte-kb com label bug (handoff ao time)"
                  side="left"
                  wide
                >
                  <button
                    type="button"
                    onClick={() => void openGithubIssue()}
                    disabled={deskBusy}
                    className={cn(actionBtnBase, actionBtn.create, "w-full")}
                  >
                    {githubBusy === "opening" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ExternalLink className="size-4" />
                    )}
                    {githubBusy === "opening" ? "Abrindo issue…" : "Abrir issue GitHub"}
                  </button>
                </PremiumTooltip>
              )}
              {isAdmin && !isNew && isBugReport(form) && form.githubIssueUrl && (
                <PremiumTooltip
                  label={`Envia título, body e evidências do Desk para a issue #${form.githubIssueNumber} (não cria issue nova). Também busca comentários do gestor perdidos pelo webhook.`}
                  side="left"
                  wide
                >
                  <button
                    type="button"
                    onClick={() => void syncGithubIssue()}
                    disabled={deskBusy}
                    aria-busy={githubBusy === "syncing"}
                    className={cn(actionBtnBase, actionBtn.checklist, "w-full")}
                  >
                    {githubBusy === "syncing" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <RefreshCw className="size-4" />
                    )}
                    {githubBusy === "syncing" ? "Sincronizando…" : "Sync issue GitHub"}
                  </button>
                </PremiumTooltip>
              )}
              {isAdmin &&
                !isNew &&
                isBugReport(form) &&
                form.githubIssueUrl &&
                !form.githubIssueClosedAt && (
                  <PremiumTooltip
                    label={`Fecha a issue #${form.githubIssueNumber} no GitHub, com comentário editável de homologação/build, e alinha o status no Desk`}
                    side="left"
                    wide
                  >
                    <button
                      type="button"
                      onClick={() => void closeGithubIssue()}
                      disabled={deskBusy}
                      className={cn(actionBtnBase, actionBtn.ghost, "w-full")}
                    >
                      {githubBusy === "closing" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-4" />
                      )}
                      {githubBusy === "closing" ? "Fechando issue…" : "Fechar issue GitHub"}
                    </button>
                  </PremiumTooltip>
                )}
              {githubProgress && !editingBug && (
                <GithubIssueProgressCard progress={githubProgress} />
              )}
              {form.githubIssueUrl && (
                <a
                  href={form.githubIssueUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  Issue #{form.githubIssueNumber} · abrir no GitHub
                </a>
              )}
              {form.githubIssueLastCommentAt && (
                <div
                  className={cn(
                    "min-w-0 overflow-hidden rounded-md border px-3 py-2 text-left text-xs",
                    isGestorReplyUnread(form as TestRecord)
                      ? "border-amber-500/30 bg-amber-500/10"
                      : "border-border/70 bg-muted/20",
                  )}
                >
                  <p
                    className={cn(
                      "font-medium",
                      isGestorReplyUnread(form as TestRecord)
                        ? "text-amber-200"
                        : "text-muted-foreground",
                    )}
                  >
                    {isGestorReplyUnread(form as TestRecord)
                      ? "Não lido"
                      : "Última resposta"}
                    {form.githubIssueLastCommentBy
                      ? ` · @${form.githubIssueLastCommentBy}`
                      : ""}
                  </p>
                  {form.githubIssueLastCommentBody && (
                    <p className="mt-1 max-h-32 overflow-y-auto wrap-anywhere text-muted-foreground">
                      {form.githubIssueLastCommentBody}
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {form.githubIssueLastCommentUrl && (
                      <a
                        href={form.githubIssueLastCommentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-300/90 underline-offset-2 hover:underline"
                      >
                        Ver comentário
                      </a>
                    )}
                    {isGestorReplyUnread(form as TestRecord) && (
                      <button
                        type="button"
                        className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                        onClick={() => void markGestorSeen()}
                      >
                        Marcar como lido
                      </button>
                    )}
                  </div>
                </div>
              )}
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
              </>
              )}
              {!isAdmin && (
                <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  Modo visitante: somente leitura. Nada é gravado nem executado.
                </p>
              )}
            </div>
          </aside>
        </div>
        </fieldset>
      ) : (
        <div className="rounded-xl border bg-card p-4 sm:p-6">
          {isVisitor ? (
            <VisitorRedactedNote field="O histórico" />
          ) : (
            <HistoryTimeline entries={form.history ?? []} />
          )}
        </div>
      )}
    </div>
  );
}

function AmbienteIssuePreview({ record }: { record: Partial<TestRecord> }) {
  const view = ambienteView(record);
  if (!view.headline && view.fields.length === 0) return null;

  return (
    <div className="space-y-2 rounded-md border border-border/70 bg-muted/20 px-3 py-2">
      <p className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">
        Ambiente na issue
      </p>
      {view.dual ? (
        <p className="text-xs font-medium text-foreground">{view.headline}</p>
      ) : view.headline ? (
        <p className="text-xs text-foreground">
          <span className="text-muted-foreground">Onde · </span>
          {view.headline}
        </p>
      ) : null}
      {view.dual && view.surfaces.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {view.surfaces.map((surface) => (
            <span
              key={surface}
              className="rounded-full border border-border bg-[#1a1a1a] px-2 py-0.5 text-[0.65rem] text-muted-foreground"
            >
              {surface}
            </span>
          ))}
        </div>
      )}
      {view.fields.length > 0 && (
        <dl className="space-y-1 text-xs">
          {view.fields.map((field) => (
            <div key={field.label} className="flex min-w-0 gap-2">
              <dt className="shrink-0 text-muted-foreground">{field.label}</dt>
              <dd className="min-w-0 wrap-anywhere text-foreground">{field.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function GithubIssueProgressCard({
  progress,
}: {
  progress: { message: string; percent: number; filename?: string };
}) {
  return (
    <div
      className="space-y-1.5 rounded-md border border-emerald-500/30 bg-emerald-600/10 px-3 py-2"
      role="status"
      aria-live="polite"
      aria-label={`${progress.message}: ${progress.percent}%`}
    >
      <div className="flex items-center justify-between gap-2 text-xs text-emerald-200/90">
        <span className="flex min-w-0 items-center gap-1.5">
          <Loader2 className="size-3.5 shrink-0 animate-spin" />
          <span className="truncate">{progress.message}</span>
        </span>
        <span className="shrink-0 tabular-nums font-medium text-emerald-100">
          {progress.percent}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-black/30">
        <div
          className="h-full rounded-full bg-emerald-400 transition-[width] duration-200 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }}
        />
      </div>
    </div>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 border-t border-border/40 pt-6 first:border-t-0 first:pt-0">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function VisitorRedactedNote({ field }: { field: string }) {
  return (
    <blockquote className="border-l-2 border-muted-foreground/40 bg-muted/20 px-3 py-2.5">
      <p className="text-sm italic text-muted-foreground">«[conteúdo omitido]»</p>
      <footer className="mt-1.5 text-xs text-muted-foreground/90">
        {field} consta no registro interno. Omitido no portfólio por segurança —
        não significa que o campo estava vazio.
      </footer>
    </blockquote>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-muted-foreground/80">{hint}</span> : null}
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
        className={cn(QUIET_INPUT, "disabled:opacity-60")}
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
