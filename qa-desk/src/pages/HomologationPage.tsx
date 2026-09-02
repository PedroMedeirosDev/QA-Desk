import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import {
  ArrowLeft,
  Bug,
  CheckCircle2,
  Download,
  ExternalLink,
  MonitorOff,
  Play,
  RefreshCw,
} from "lucide-react";
import { AutomationReadinessBadge } from "@/components/AutomationReadinessBadge";
import { DesignCheckbox } from "@/components/DesignCheckbox";
import { ExecutionModeBadge } from "@/components/ExecutionModeBadge";
import { PremiumTooltip, tableRowHoverClass } from "@/components/PremiumTooltip";
import { AreaHeaderRow, ModuleHeaderRow, SuiteHeaderRow } from "@/components/SuiteHeaderRow";
import { SuiteListControls } from "@/components/SuiteListControls";
import { api } from "@/lib/api";
import { useConfirm } from "@/lib/confirm";
import { toastErrorMessage, useToast } from "@/lib/toast";
import { useRunProgress, RUN_CANCELLED_MESSAGE, clearBatchStop, isBatchStopRequested } from "@/lib/run-progress";
import { actionBtn, actionBtnBase } from "@/lib/button-styles";
import { authHeaders } from "@/lib/auth-token";
import {
  buildHomologationScopeHtml,
  collectEvidenceMediaForReport,
  downloadHtmlReport,
  fetchAsDataUrl,
} from "@/lib/html-report";
import { getBundledLogoUrl } from "@/config/logos";
import { resolveProjectTheme } from "@/config/project-themes";
import { CURRENT_USER } from "@/config/user";
import { PROJECTS } from "@/config/projects";
import {
  DIARIO_CQ_HOMOLOGATION_SLUG,
  DIARIO_CQ_SCOPE,
} from "@/config/homologation-scopes";
import {
  projectBugDetailPath,
  projectDetailPath,
  projectHomologationPath,
  projectHomologationsListPath,
} from "@/lib/project-paths";
import { cn } from "@/lib/utils";
import { CHANNEL_LABELS, channelSupportsMaestro } from "@/config/channels";
import { MURAL_HOMOLOGATION_SLUG } from "@/config/homologations";
import {
  AREA_LABELS,
  areaCollapseKey,
  groupByAreaThenModuleThenSuite,
  MODULE_LABELS,
  suiteCollapseKey,
  summarizeSuiteProgress,
  SUITE_LABELS,
  homologationResultDisplay,
} from "@/lib/suite";
import {
  AUTOMATION_RUNNER_SHORT,
  defaultRunnerForChannel,
  readPlaywrightHeaded,
  readSuiteRunner,
  writePlaywrightHeaded,
  writeSuiteRunner,
  type AutomationRunner,
} from "@/lib/automation-runners";
import {
  BUG_STATUS_LABELS,
  inferChannel,
  type BugStatus,
  type EvidenceFile,
  type HomologationStatus,
  type ProjectSlug,
  type TestRecord,
} from "@/types/test-record";
import {
  CHANGE_SCOPE_LABELS,
  HOMOLOGATION_CYCLE_LABELS,
  changeScopeBadgeClass,
  type HomologationChangeScope,
  type Homologation,
  type HomologationProgress,
} from "@/types/homologation";

function statusTone(status: HomologationStatus): string {
  if (status === "passou" || status === "homologado") {
    return "border-emerald-500/40 bg-emerald-500/15 text-emerald-400";
  }
  if (status === "falhou") return "border-red-500/40 bg-red-500/15 text-red-400";
  if (status === "falta_evidencias") {
    return "border-amber-500/40 bg-amber-500/15 text-amber-300";
  }
  return "border-border bg-muted text-muted-foreground";
}

function bugStatusTone(status: BugStatus): string {
  if (status === "homologado" || status === "corrigido_gestor") {
    return "border-emerald-500/40 bg-emerald-500/15 text-emerald-400";
  }
  if (status === "reportado" || status === "enviado_gestor" || status === "em_tratamento") {
    return "border-amber-500/40 bg-amber-500/15 text-amber-300";
  }
  if (status === "cancelado" || status === "arquivado" || status === "nao_reproduzido") {
    return "border-border bg-muted text-muted-foreground";
  }
  return "border-border bg-muted text-muted-foreground";
}

function ProgressBar({ progress }: { progress: HomologationProgress }) {
  const pct = progress.total > 0 ? Math.round((progress.passed / progress.total) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          {progress.passed}/{progress.total} passou
        </span>
        <span className="text-muted-foreground">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>{progress.registered} cadastrado(s)</span>
        {progress.failed > 0 && <span className="text-red-400">{progress.failed} falhou</span>}
        {(progress.needsEvidence ?? 0) > 0 && (
          <span className="text-amber-300">
            {progress.needsEvidence} falta evidência(s)
          </span>
        )}
        {progress.pending > 0 && <span>{progress.pending} pendente(s)</span>}
        {(progress.bugs?.length ?? 0) > 0 && (
          <span>{progress.bugs.length} bug(s) vinculado(s)</span>
        )}
      </div>
    </div>
  );
}

export function HomologationPage({
  project,
  homSlug,
}: {
  project: ProjectSlug;
  homSlug: string;
}) {
  const navigate = useNavigate();
  const { isVisitor, isAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { runAutomation, running: liveRunning } = useRunProgress();
  const [homologation, setHomologation] = useState<Homologation | null>(null);
  const [progress, setProgress] = useState<HomologationProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [batchProgress, setBatchProgress] = useState<string>("");
  const [catalogTests, setCatalogTests] = useState<TestRecord[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string> | null>(null);
  const [suiteRunners, setSuiteRunners] = useState<Record<string, AutomationRunner>>({});
  const [playwrightHeaded, setPlaywrightHeaded] = useState(readPlaywrightHeaded);

  const maestroAllowed = channelSupportsMaestro(homologation?.channel);
  const channelDefaultRunner = defaultRunnerForChannel(homologation?.channel);

  useEffect(() => {
    setCollapsed(null);
    setSuiteRunners({});
  }, [homSlug]);

  function suiteRunnerFor(module: string, suite: string): AutomationRunner {
    if (!maestroAllowed) return "playwright";
    return suiteRunners[suiteCollapseKey(module, suite)] ?? channelDefaultRunner;
  }

  function setSuiteRunner(module: string, suite: string, runner: AutomationRunner) {
    const key = suiteCollapseKey(module, suite);
    writeSuiteRunner(key, runner);
    setSuiteRunners((prev) => ({ ...prev, [key]: runner }));
  }

  function itemSupportsRunner(
    item: HomologationProgress["items"][number],
    runner: AutomationRunner,
  ): boolean {
    if (runner === "playwright") return Boolean(item.hasPlaywright);
    return Boolean(item.hasMaestro ?? item.hasAutomation);
  }

  function persistCollapsed(next: Set<string>) {
    setCollapsed(next);
    try {
      sessionStorage.setItem(
        `qa-group-collapsed-hom-v2:${homSlug}`,
        JSON.stringify([...next]),
      );
    } catch {
      /* ignore */
    }
  }

  function toggleCollapsedKey(key: string) {
    const prev = collapsed ?? new Set<string>();
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    persistCollapsed(next);
  }

  const reload = useCallback((opts?: { soft?: boolean }) => {
    if (!opts?.soft) setLoading(true);
    Promise.all([
      api.getHomologation(project, homSlug),
      api.listTests(project).then((c) => c.reports),
    ])
      .then(([res, tests]) => {
        setHomologation(res.homologation);
        setProgress(res.progress);
        setCatalogTests(tests);
      })
      .catch((e) => toast.error(toastErrorMessage(e, "Erro ao carregar")))
      .finally(() => setLoading(false));
  }, [project, homSlug, toast]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function syncScope() {
    if (homSlug !== MURAL_HOMOLOGATION_SLUG) {
      toast.info(
        "Sync automático só existe para a homologação Mural. Adicione testes manualmente ao escopo.",
      );
      return;
    }
    setBusy(true);
    try {
      // Cria rascunhos faltantes + atualiza títulos/testKeys + escopo da campanha
      const res = await api.createMuralChecklist(project);
      if (res.homologation) setHomologation(res.homologation);
      if (res.progress) setProgress(res.progress);
      const tests = await api.listTests(project);
      setCatalogTests(tests.reports);
      toast.success(res.message ?? "Checklist sincronizado");
    } catch (e) {
      toast.error(toastErrorMessage(e, "Erro ao sincronizar"));
    } finally {
      setBusy(false);
    }
  }

  async function markComplete() {
    setBusy(true);
    try {
      const res = await api.updateHomologation(project, homSlug, { status: "concluida" });
      setHomologation(res.homologation);
      setProgress(res.progress);
      toast.success("Homologação concluída — o banner vai para a seção Concluídas na lista.");
    } catch (e) {
      toast.error(toastErrorMessage(e, "Erro ao atualizar"));
    } finally {
      setBusy(false);
    }
  }

  async function reopenHomologation() {
    setBusy(true);
    try {
      const res = await api.updateHomologation(project, homSlug, { status: "em_andamento" });
      setHomologation(res.homologation);
      setProgress(res.progress);
      toast.success("Homologação reaberta.");
    } catch (e) {
      toast.error(toastErrorMessage(e, "Erro ao reabrir"));
    } finally {
      setBusy(false);
    }
  }

  async function updateChangeScope(changeScope: HomologationChangeScope) {
    if (!homologation || homologation.changeScope === changeScope) return;
    setBusy(true);
    try {
      const res = await api.updateHomologation(project, homSlug, { changeScope });
      setHomologation(res.homologation);
      setProgress(res.progress);
      toast.success(`Escopo atualizado: ${CHANGE_SCOPE_LABELS[changeScope]}.`);
    } catch (e) {
      toast.error(toastErrorMessage(e, "Erro ao atualizar escopo"));
    } finally {
      setBusy(false);
    }
  }

  async function addTestToScope(testKey: string) {
    if (!homologation) return;
    setBusy(true);
    try {
      const testKeys = [...new Set([...homologation.testKeys, testKey])];
      const res = await api.updateHomologation(project, homSlug, { testKeys });
      setHomologation(res.homologation);
      setProgress(res.progress);
      toast.success("Teste adicionado ao escopo.");
    } catch (e) {
      toast.error(toastErrorMessage(e, "Erro ao atualizar escopo"));
    } finally {
      setBusy(false);
    }
  }

  async function runTest(
    testId: string,
    title?: string,
    runner: AutomationRunner = "maestro",
    headedOverride?: boolean,
  ) {
    setRunningId(testId);
    try {
      const headed =
        runner === "playwright"
          ? (headedOverride ?? playwrightHeaded)
          : undefined;
      const res = await runAutomation({
        project,
        testId,
        title: title ?? testId,
        homologationId: homologation?.id,
        runner,
        ...(runner === "playwright" ? { headed } : {}),
      });
      const ver = res.appVersion ? ` · v${res.appVersion}` : "";
      const runnerTitle =
        runner === "playwright" && headed === false
          ? "Playwright (headless)"
          : AUTOMATION_RUNNER_SHORT[runner];
      if (res.ok) {
        toast.success(`Execução #${res.runNumber} passou${ver}`);
      } else {
        const where =
          res.failure?.failedStepLabel ??
          res.failure?.failedAction ??
          "veja o teste";
        toast.error(`Execução #${res.runNumber} falhou${ver} — ${where}`, {
          title: runnerTitle,
        });
      }
      reload({ soft: true });
      return res.ok;
    } catch (e) {
      toast.error(toastErrorMessage(e, "Erro ao executar"));
      return false;
    } finally {
      setRunningId(null);
    }
  }

  async function runQueue(
    queue: Array<HomologationProgress["items"][number] & { runner?: AutomationRunner }>,
    opts: { title: string; description: string; batchTitle: string },
  ) {
    if (!homologation || queue.length === 0) return;
    const ok = await confirm({
      title: opts.title,
      description: opts.description,
      confirmLabel: "Rodar",
      cancelLabel: "Cancelar",
      tone: "run",
    });
    if (!ok) return;

    setRunningAll(true);
    let passed = 0;
    let failed = 0;
    clearBatchStop();

    try {
      for (let i = 0; i < queue.length; i++) {
        if (isBatchStopRequested()) {
          toast.info(`${opts.batchTitle} interrompida.`, {
            title: "Execução em lote",
          });
          break;
        }
        const item = queue[i];
        const runner = item.runner ?? "maestro";
        setBatchProgress(
          `${opts.batchTitle} ${i + 1}/${queue.length} — ${item.title}  ·  ✓ ${passed}  ✗ ${failed}`,
        );
        setRunningId(item.testId!);
        try {
          const res = await runAutomation({
            project,
            testId: item.testId!,
            title: item.title,
            homologationId: homologation.id,
            batchLabel: `${opts.batchTitle} ${i + 1}/${queue.length}`,
            runner,
            ...(runner === "playwright" ? { headed: playwrightHeaded } : {}),
          });
          if (res.cancelled || isBatchStopRequested()) {
            toast.info(`${opts.batchTitle} interrompida.`, {
              title: "Execução em lote",
            });
            break;
          }
          const ver = res.appVersion ? ` · v${res.appVersion}` : "";
          if (res.ok) {
            passed += 1;
            toast.success(`${item.title} — passou${ver}`);
          } else {
            failed += 1;
            const where =
              res.failure?.failedStepLabel ??
              res.failure?.failedAction ??
              "seguindo…";
            toast.error(`${item.title} — falhou${ver} — ${where}`, {
              title: AUTOMATION_RUNNER_SHORT[runner],
            });
          }
        } catch (e) {
          const msg = toastErrorMessage(e, "erro");
          if (msg === RUN_CANCELLED_MESSAGE || isBatchStopRequested()) {
            toast.info(`${opts.batchTitle} interrompida.`, {
              title: "Execução em lote",
            });
            break;
          }
          failed += 1;
          toast.error(`${item.title} — ${msg} (seguindo…)`, {
            title: AUTOMATION_RUNNER_SHORT[runner],
          });
        }
      }

      toast.info(`${opts.batchTitle}: ${passed} passou · ${failed} falhou`, {
        title: "Execução em lote",
        duration: 10000,
      });
      reload({ soft: true });
    } finally {
      clearBatchStop();
      setRunningAll(false);
      setRunningId(null);
      setBatchProgress("");
    }
  }

  async function runSuiteItems(
    suite: string,
    items: HomologationProgress["items"],
    moduleName: string,
  ) {
    const runner = suiteRunnerFor(moduleName, suite);
    const queue = items
      .filter((i) => i.testId && itemSupportsRunner(i, runner))
      .map((i) => ({ ...i, runner }));
    const label = SUITE_LABELS[suite] ?? suite;
    if (queue.length === 0) {
      toast.info(
        `Nenhum CT com ${AUTOMATION_RUNNER_SHORT[runner]} na suite ${label}.`,
      );
      return;
    }
    await runQueue(queue, {
      title: `Rodar suite ${label}`,
      description: `${queue.length} teste(s) (${AUTOMATION_RUNNER_SHORT[runner]}) em sequência.\nSe um falhar, continua nos próximos.`,
      batchTitle: `Suite ${label}`,
    });
  }

  async function runAllAutomated() {
    if (!progress || !homologation) return;
    const queue = progress.items
      .filter((i) => i.testId && (i.hasMaestro || i.hasPlaywright || i.hasAutomation))
      .map((i) => {
        // Prefer Maestro for "run all" (campanha clássica); Playwright only if no Maestro
        const runner: AutomationRunner =
          i.hasMaestro || (i.hasAutomation && !i.hasPlaywright)
            ? "maestro"
            : "playwright";
        return { ...i, runner };
      })
      .filter((i) => itemSupportsRunner(i, i.runner));
    if (queue.length === 0) {
      toast.info("Nenhum teste com automação vinculada nesta campanha.");
      return;
    }

    const draftCount = queue.filter((i) =>
      i.runner === "playwright"
        ? i.playwrightReadiness !== "ready"
        : i.readiness !== "ready",
    ).length;
    const description =
      draftCount > 0
        ? `${queue.length} teste(s) em sequência.\n${draftCount} ainda estão em rascunho e podem falhar.\nSe um falhar, a campanha continua nos próximos.`
        : `${queue.length} teste(s) em sequência.\nSe um falhar, continua nos próximos.`;

    await runQueue(queue, {
      title: "Rodar homologação inteira",
      description,
      batchTitle: "Campanha",
    });
  }

  const areaGroups = useMemo(() => {
    const enriched = (progress?.items ?? []).map((item) => {
      const fromCatalog = catalogTests.find((t) => t.testKey === item.testKey);
      const tags = [
        ...(item.suite ? [`suite:${item.suite}`] : []),
        ...(fromCatalog?.module ? [`module:${fromCatalog.module}`] : []),
        ...(fromCatalog?.tags ?? []).filter((t) => t.startsWith("module:")),
      ];
      return {
        ...item,
        module: fromCatalog?.module,
        tags: tags.length ? tags : undefined,
        title: item.title,
        testKey: item.testKey,
      };
    });
    return groupByAreaThenModuleThenSuite(enriched);
  }, [progress?.items, catalogTests]);

  const moduleGroups = useMemo(
    () => areaGroups.flatMap((a) => a.modules),
    [areaGroups],
  );

  useEffect(() => {
    if (!homologation || moduleGroups.length === 0) return;
    setSuiteRunners((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const mod of moduleGroups) {
        for (const suite of mod.suites) {
          const key = suiteCollapseKey(mod.module, suite.suite);
          if (key in next) continue;
          next[key] = maestroAllowed
            ? readSuiteRunner(key)
            : channelDefaultRunner;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [homologation, moduleGroups, maestroAllowed, channelDefaultRunner]);

  useEffect(() => {
    if (collapsed !== null || areaGroups.length === 0) return;
    try {
      const raw = sessionStorage.getItem(`qa-group-collapsed-hom-v2:${homSlug}`);
      if (raw === null) {
        const next = new Set<string>();
        for (const area of areaGroups) {
          if (summarizeSuiteProgress(area.items).tone === "ok") {
            next.add(areaCollapseKey(area.area));
          }
          for (const mod of area.modules) {
            if (summarizeSuiteProgress(mod.items).tone === "ok") {
              next.add(`m:${mod.module}`);
            }
            for (const suite of mod.suites) {
              if (summarizeSuiteProgress(suite.items).tone === "ok") {
                next.add(`s:${suiteCollapseKey(mod.module, suite.suite)}`);
              }
            }
          }
        }
        persistCollapsed(next);
      } else {
        const arr = JSON.parse(raw) as string[];
        persistCollapsed(new Set(Array.isArray(arr) ? arr : []));
      }
    } catch {
      persistCollapsed(new Set());
    }
  }, [collapsed, areaGroups, homSlug]);

  if (loading && !homologation) {
    return <p className="text-muted-foreground">Carregando homologação…</p>;
  }

  if (!homologation || !progress) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Homologação não encontrada.</p>
        <button
          type="button"
          onClick={() => navigate(projectHomologationsListPath(project))}
          className={cn(actionBtnBase, actionBtn.back)}
        >
          <ArrowLeft className="size-4" />
          Voltar
        </button>
      </div>
    );
  }

  const allPassed = progress.total > 0 && progress.passed === progress.total;
  const isMural = homSlug === MURAL_HOMOLOGATION_SLUG;
  const scopeKeys = new Set(homologation.testKeys);
  const linkedBugs = progress.bugs ?? [];
  const addableTests = catalogTests.filter(
    (t) =>
      t.testKey &&
      t.recordType !== "bug" &&
      !t.id.startsWith("BUG-") &&
      !scopeKeys.has(t.testKey) &&
      (!homologation.channel || inferChannel(t) === homologation.channel),
  );

  const campanha = homologation;
  const progresso = progress;
  const briefing =
    campanha.scope?.trim() ||
    (homSlug === DIARIO_CQ_HOMOLOGATION_SLUG ? DIARIO_CQ_SCOPE : "");

  async function exportScopeHtml() {
    const toastId = toast.info("Preparando relatório e embutindo anexos…", {
      duration: 0,
    });
    try {
      // Catálogo fresco — evita CT sem evidence por lista desatualizada.
      const catalog = await api.listTests(project);
      const byKey = new Map(
        catalog.reports
          .filter((t) => t.testKey)
          .map((t) => [t.testKey as string, t]),
      );
      const byId = new Map(catalog.reports.map((t) => [t.id, t]));

      const recordsByKey: Record<string, TestRecord> = {};
      const allEvidence: EvidenceFile[] = [];
      for (const item of progresso.items) {
        const rec =
          byKey.get(item.testKey) ??
          (item.testId ? byId.get(item.testId) : undefined);
        if (rec?.testKey) {
          recordsByKey[rec.testKey] = rec;
          allEvidence.push(...(rec.evidence ?? []));
        }
      }
      const mediaByFileId = await collectEvidenceMediaForReport(
        allEvidence,
        (storageKey) => api.evidenceUrl(storageKey),
        { headers: authHeaders(), concurrency: 2 },
      );
      const embedded = Object.values(mediaByFileId).filter((m) => m.dataUrl).length;
      const projectCfg = PROJECTS.find((p) => p.slug === project);
      const theme = resolveProjectTheme(project);
      const logoUrl = getBundledLogoUrl(projectCfg?.logoFile ?? project);
      const brandLogoDataUrl = logoUrl
        ? await fetchAsDataUrl(logoUrl)
        : undefined;
      const html = buildHomologationScopeHtml(campanha, progresso, {
        projectLabel: projectCfg?.label ?? project,
        author: CURRENT_USER.actor,
        recordsByKey,
        mediaByFileId,
        brandLogoDataUrl,
        themeAccent: theme.accent,
        themeHighlight: theme.highlight,
      });
      const namePart = (campanha.slug || campanha.id || "campanha")
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      downloadHtmlReport(html, `rel-${namePart}.html`);
      if (allEvidence.length === 0) {
        toast.update(toastId, {
          variant: "success",
          message: "Relatório HTML baixado",
          duration: 4000,
        });
      } else if (embedded === allEvidence.length) {
        toast.update(toastId, {
          variant: "success",
          message: `Relatório HTML baixado · ${embedded} anexo(s) embutido(s)`,
          duration: 5000,
        });
      } else if (embedded === 0) {
        toast.update(toastId, {
          variant: "error",
          message:
            "Relatório baixado, mas nenhum anexo foi embutido. Confira se o Desk está aberto e tente de novo.",
          duration: 8000,
        });
      } else {
        toast.update(toastId, {
          variant: "info",
          message: `Relatório baixado · ${embedded}/${allEvidence.length} anexo(s) embutidos. Reexporte se faltar prévia.`,
          duration: 7000,
        });
      }
    } catch (e) {
      toast.dismiss(toastId);
      toast.error(toastErrorMessage(e, "Falha ao gerar o relatório HTML"));
    }
  }

  /** Abre CT/bug e faz o Voltar do editor retornar a esta campanha. */
  function openFromCampaign(path: string) {
    navigate(path, {
      state: {
        backTo: projectHomologationPath(project, campanha.slug),
        backLabel: "Voltar à campanha",
      },
    });
  }

  async function togglePortfolio(next: boolean) {
    setBusy(true);
    try {
      const res = await api.updateHomologation(project, campanha.slug, {
        showInPortfolio: next,
      });
      setHomologation(res.homologation);
      setProgress(res.progress);
      toast.success(
        next ? "Campanha visível no portfólio" : "Campanha oculta do portfólio",
      );
    } catch (e) {
      toast.error(toastErrorMessage(e, "Falha ao atualizar portfólio"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {!isVisitor && (
      <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Como funciona esta campanha</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>
            Os dados ficam em{" "}
            <code className="text-xs">qa-desk/data/projects/{project}/homologations.json</code>
          </li>
          <li>
            Execute os testes do escopo (▶ em cada linha) ou use{" "}
            <strong>▶ Rodar homologação inteira</strong> no topo desta página.
          </li>
          <li>
            Quando todos passarem, use <strong>Concluir</strong> — o banner sai de &quot;em
            andamento&quot; e vai para <strong>Concluídas</strong> na lista.
          </li>
          <li>Nova campanha: botão <strong>Nova homologação</strong> na lista de testes.</li>
          <li>
            <strong>Exportar relatório HTML</strong> gera um arquivo enxuto por CT (problema,
            observação e evidência) — sem o textão de escopo.
          </li>
        </ul>
      </div>
      )}

      {!isVisitor && briefing ? (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm font-medium text-foreground">Escopo desta campanha</p>
          <pre className="mt-3 max-h-[28rem] overflow-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted-foreground">
            {briefing}
          </pre>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate(projectHomologationsListPath(project))}
            className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Voltar à lista de homologações
          </button>
          <p className="font-mono text-xs text-muted-foreground">{homologation.id}</p>
          <h2 className="text-xl font-semibold">{homologation.title}</h2>
          {homologation.description && (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{homologation.description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Status:</span>
            <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium">
              {HOMOLOGATION_CYCLE_LABELS[homologation.status]}
            </span>
            {homologation.channel && (
              <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium">
                {CHANNEL_LABELS[homologation.channel]}
              </span>
            )}
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-xs",
                changeScopeBadgeClass(homologation.changeScope ?? "backend"),
              )}
            >
              {CHANGE_SCOPE_LABELS[homologation.changeScope ?? "backend"]}
            </span>
            {homologation.build && (
              <span className="text-xs text-muted-foreground">Build {homologation.build}</span>
            )}
          </div>
          {isAdmin && (
            <div className="mt-3 max-w-md">
              <DesignCheckbox
                checked={Boolean(homologation.showInPortfolio)}
                disabled={busy}
                onChange={(e) => void togglePortfolio(e.target.checked)}
                label={<span className="font-medium text-foreground">Mostrar no portfólio</span>}
                description="Visitante vê a campanha (CTs e status), sem prints nem briefing interno."
              />
            </div>
          )}
        </div>

        {!isVisitor && (
        <div className="flex flex-wrap gap-2">
          <PremiumTooltip
            label="HTML enxuto: cabeçalho do produto + um bloco por CT (problema, observação, evidência). Sem briefing."
            side="bottom"
            wide
          >
            <button
              type="button"
              onClick={() => void exportScopeHtml()}
              className={cn(actionBtnBase, actionBtn.ghost, "px-3")}
            >
              <Download className="size-4" />
              Exportar relatório HTML
            </button>
          </PremiumTooltip>
          {homologation.status !== "concluida" && (
            <PremiumTooltip
              label="Executa todos os testes Maestro desta campanha, um após o outro"
              side="bottom"
              wide
            >
              <button
                type="button"
                disabled={busy || runningAll || Boolean(runningId) || liveRunning}
                onClick={() => void runAllAutomated()}
                className={cn(actionBtnBase, actionBtn.run, "px-4 py-2 text-sm font-semibold")}
              >
                <Play className={cn("size-4", runningAll && "animate-pulse")} />
                {runningAll ? "Executando campanha…" : "▶ Rodar homologação inteira"}
              </button>
            </PremiumTooltip>
          )}
          {isMural && homologation.status !== "concluida" && (
            <PremiumTooltip
              label="Cria rascunhos faltantes e atualiza títulos/escopo a partir do catálogo Maestro"
              side="bottom"
              wide
            >
              <button
                type="button"
                disabled={busy}
                onClick={() => void syncScope()}
                className={cn(actionBtnBase, actionBtn.checklist, "px-3")}
              >
                <RefreshCw className={cn("size-4", busy && "animate-spin")} />
                Sincronizar checklist Mural
              </button>
            </PremiumTooltip>
          )}
          {homologation.status === "concluida" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void reopenHomologation()}
              className={cn(actionBtnBase, actionBtn.back, "px-3")}
            >
              Reabrir homologação
            </button>
          ) : (
            <PremiumTooltip
              label={
                allPassed
                  ? "Marcar homologação como concluída"
                  : "Todos os testes precisam passar"
              }
              side="bottom"
              align="end"
              wide
            >
              <button
                type="button"
                disabled={busy || !allPassed}
                onClick={() => void markComplete()}
                className={cn(actionBtnBase, actionBtn.create, "px-3")}
              >
                <CheckCircle2 className="size-4" />
                Concluir homologação
              </button>
            </PremiumTooltip>
          )}
        </div>
        )}
      </div>

      {batchProgress && (
        <div className="sticky top-0 z-10 rounded-lg border border-primary/40 bg-card px-4 py-3 shadow-sm">
          <p className="text-sm font-medium text-foreground">Executando campanha</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {batchProgress} — se um falhar, segue para o próximo
          </p>
        </div>
      )}

      <div className="surface-brand rounded-xl border p-5">
        <ProgressBar progress={progress} />
      </div>

      <div className="rounded-xl border bg-card p-4">
        <p className="text-sm font-medium">Configuração da campanha</p>
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            Escopo da mudança
            <select
              className="h-9 min-w-[10rem] rounded-md border bg-background px-3 text-sm text-foreground"
              value={homologation.changeScope ?? "backend"}
              disabled={busy}
              onChange={(e) => void updateChangeScope(e.target.value as HomologationChangeScope)}
            >
              {Object.entries(CHANGE_SCOPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <p className="pb-1 text-xs text-muted-foreground">
            Indica se a release alterou backend, frontend ou os dois.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Escopo ({progress.total} teste(s))</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Área → aba → suite · chave <code className="text-[11px]">módulo/ct-id</code>
              {linkedBugs.length > 0
                ? ` · ${linkedBugs.length} bug(s) na seção abaixo`
                : ""}
            </p>
          </div>
          <SuiteListControls
            onExpandAll={() => persistCollapsed(new Set())}
            onCollapseAll={() => {
              const next = new Set<string>();
              for (const area of areaGroups) {
                next.add(areaCollapseKey(area.area));
                for (const mod of area.modules) {
                  next.add(`m:${mod.module}`);
                  for (const suite of mod.suites) {
                    next.add(`s:${suiteCollapseKey(mod.module, suite.suite)}`);
                  }
                }
              }
              persistCollapsed(next);
            }}
            onCollapseGreens={() => {
              const next = new Set<string>();
              for (const area of areaGroups) {
                if (summarizeSuiteProgress(area.items).tone === "ok") {
                  next.add(areaCollapseKey(area.area));
                }
                for (const mod of area.modules) {
                  if (summarizeSuiteProgress(mod.items).tone === "ok") {
                    next.add(`m:${mod.module}`);
                  }
                  for (const suite of mod.suites) {
                    if (summarizeSuiteProgress(suite.items).tone === "ok") {
                      next.add(`s:${suiteCollapseKey(mod.module, suite.suite)}`);
                    }
                  }
                }
              }
              persistCollapsed(next);
            }}
            playwrightHeaded={playwrightHeaded}
            onPlaywrightHeadedChange={(headed) => {
              writePlaywrightHeaded(headed);
              setPlaywrightHeaded(headed);
            }}
          />
        </div>
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Cenário</th>
              <th className="px-4 py-3 font-medium">Resultado</th>
              <th className="px-4 py-3 font-medium">Execuções</th>
              <th className="px-4 py-3 font-medium w-24">Ações</th>
            </tr>
          </thead>
          <tbody>
            {areaGroups.map((area) => {
              const collapsedSet = collapsed ?? new Set<string>();
              const aKey = areaCollapseKey(area.area);
              const areaExpanded = !collapsedSet.has(aKey);
              const areaStats = summarizeSuiteProgress(area.items, "maestro");
              const areaLabel = AREA_LABELS[area.area] ?? area.area;
              return (
                <Fragment key={aKey}>
                  <AreaHeaderRow
                    variant="homologation"
                    area={area.area}
                    moduleCount={area.modules.length}
                    stats={areaStats}
                    expanded={areaExpanded}
                    onToggle={() => toggleCollapsedKey(aKey)}
                    onRunArea={() => {
                      const queue = area.items
                        .filter((i) => {
                          const suite = i.suite ?? "Outros";
                          const mod = i.module?.trim()
                            ? i.module
                            : "Outros";
                          const runner = suiteRunnerFor(mod, suite);
                          return i.testId && itemSupportsRunner(i, runner);
                        })
                        .map((i) => {
                          const mod = i.module?.trim() ? i.module : "Outros";
                          return {
                            ...i,
                            runner: suiteRunnerFor(mod, i.suite ?? "Outros"),
                          };
                        });
                      if (queue.length === 0) {
                        toast.info(`Nenhuma automação elegível na área ${areaLabel}.`);
                        return;
                      }
                      void runQueue(queue, {
                        title: `Rodar área ${areaLabel}`,
                        description: `${queue.length} teste(s) em sequência.\nSe um falhar, continua nos próximos.`,
                        batchTitle: `Área ${areaLabel}`,
                      });
                    }}
                    runDisabled={runningAll || liveRunning || Boolean(runningId)}
                    running={runningAll}
                  />
                  {areaExpanded &&
                    area.modules.map((mod) => {
              const modKey = `m:${mod.module}`;
              const modExpanded = !collapsedSet.has(modKey);
              const modStats = summarizeSuiteProgress(mod.items, "maestro");
              const modLabel = MODULE_LABELS[mod.module] ?? mod.module;
              return (
                <Fragment key={modKey}>
                  <ModuleHeaderRow
                    variant="homologation"
                    module={mod.module}
                    suiteCount={mod.suites.length}
                    stats={modStats}
                    expanded={modExpanded}
                    onToggle={() => toggleCollapsedKey(modKey)}
                    onRunModule={() => {
                      const queue = mod.items
                        .filter((i) => {
                          const suite = i.suite ?? "Outros";
                          const runner = suiteRunnerFor(mod.module, suite);
                          return i.testId && itemSupportsRunner(i, runner);
                        })
                        .map((i) => ({
                          ...i,
                          runner: suiteRunnerFor(mod.module, i.suite ?? "Outros"),
                        }));
                      if (queue.length === 0) {
                        toast.info(`Nenhuma automação elegível na aba ${modLabel}.`);
                        return;
                      }
                      void runQueue(queue, {
                        title: `Rodar aba ${modLabel}`,
                        description: `${queue.length} teste(s) em sequência.\nSe um falhar, continua nos próximos.`,
                        batchTitle: `Aba ${modLabel}`,
                      });
                    }}
                    runDisabled={runningAll || liveRunning || Boolean(runningId)}
                    running={runningAll}
                  />
                  {modExpanded &&
                    mod.suites.map((group) => {
                      const sk = `s:${suiteCollapseKey(mod.module, group.suite)}`;
                      const runner = suiteRunnerFor(mod.module, group.suite);
                      const stats = summarizeSuiteProgress(group.items, runner);
                      const expanded = !collapsedSet.has(sk);
                      return (
                <Fragment key={sk}>
                  <SuiteHeaderRow
                    variant="homologation"
                    suite={group.suite}
                    stats={stats}
                    expanded={expanded}
                    onToggle={() => toggleCollapsedKey(sk)}
                    onRunSuite={() =>
                      void runSuiteItems(group.suite, group.items, mod.module)
                    }
                    runDisabled={runningAll || liveRunning || Boolean(runningId)}
                    running={runningAll}
                    runner={runner}
                    onRunnerChange={
                      maestroAllowed
                        ? (next) =>
                            setSuiteRunner(mod.module, group.suite, next)
                        : undefined
                    }
                  />
                  {expanded &&
                    group.items.map((item) => {
                      const canRun = itemSupportsRunner(item, runner);
                      const hasAny = Boolean(
                        item.hasMaestro ||
                          item.hasPlaywright ||
                          item.hasAutomation,
                      );
                      return (
                      <tr
                        key={item.testKey}
                        role={item.testId ? "link" : undefined}
                        tabIndex={item.testId ? 0 : undefined}
                        aria-label={item.testId ? `Abrir ${item.title}` : undefined}
                        onClick={
                          item.testId
                            ? () =>
                                openFromCampaign(
                                  projectDetailPath(
                                    project,
                                    item.testId!,
                                    homologation.channel,
                                  ),
                                )
                            : undefined
                        }
                        onKeyDown={
                          item.testId
                            ? (e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  openFromCampaign(
                                    projectDetailPath(
                                      project,
                                      item.testId!,
                                      homologation.channel,
                                    ),
                                  );
                                }
                              }
                            : undefined
                        }
                        className={cn(
                          "border-b last:border-0",
                          tableRowHoverClass,
                          item.testId && "cursor-pointer focus-visible:bg-muted/40 focus-visible:outline-none",
                        )}
                      >
                        <td className="px-4 py-3 pl-10">
                          <p className="font-medium">{item.title}</p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {item.testKey}
                          </p>
                          {hasAny && (
                            <div className="mt-1">
                              <AutomationReadinessBadge
                                runner={runner}
                                record={{
                                  automation: {
                                    type: runner === "playwright" ? "playwright" : "maestro",
                                    flowPath:
                                      runner === "maestro" ? item.testKey : undefined,
                                    playwright:
                                      runner === "playwright"
                                        ? {
                                            specPath: item.testKey,
                                            readiness: item.playwrightReadiness,
                                          }
                                        : undefined,
                                    readiness: item.readiness,
                                  },
                                }}
                              />
                            </div>
                          )}
                          {hasAny && !canRun && (
                            <p className="mt-1 text-xs text-amber-400">
                              {AUTOMATION_RUNNER_SHORT[runner]} não configurado
                            </p>
                          )}
                          {!item.found && (
                            <p className="mt-1 text-xs text-amber-400">
                              Não cadastrado — sincronize o checklist
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {(() => {
                            const { status, label } = homologationResultDisplay(
                              item,
                              runner,
                            );
                            const fromCatalog = catalogTests.find(
                              (t) => t.testKey === item.testKey,
                            );
                            return (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={cn(
                                    "rounded-full border px-2 py-0.5 text-xs",
                                    statusTone(status),
                                  )}
                                >
                                  {label}
                                </span>
                                {item.found && (
                                  <ExecutionModeBadge
                                    record={{
                                      executionMode:
                                        item.executionMode ??
                                        fromCatalog?.executionMode,
                                      automation: fromCatalog?.automation,
                                    }}
                                  />
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-center">
                          {item.runsInHomologation || "—"}
                        </td>
                        <td
                          className="px-4 py-3"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          {item.testId &&
                            (!isVisitor ||
                              catalogTests.some((t) => t.id === item.testId)) && (
                            <div className="flex items-center gap-1">
                              <PremiumTooltip label="Abrir teste" align="end">
                                <button
                                  type="button"
                                  aria-label="Abrir teste"
                                  onClick={() =>
                                    openFromCampaign(
                                      projectDetailPath(
                                        project,
                                        item.testId!,
                                        homologation.channel,
                                      ),
                                    )
                                  }
                                  className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                >
                                  <ExternalLink className="size-4" />
                                </button>
                              </PremiumTooltip>
                              {!isVisitor && (
                              <PremiumTooltip
                                align="end"
                                label={
                                  canRun
                                    ? runner === "playwright"
                                      ? playwrightHeaded
                                        ? "Executar Playwright (Chrome visível)"
                                        : "Executar Playwright (headless — preferência)"
                                      : `Executar ${AUTOMATION_RUNNER_SHORT[runner]}`
                                    : `${AUTOMATION_RUNNER_SHORT[runner]} não configurado`
                                }
                              >
                                <button
                                  type="button"
                                  aria-label={
                                    canRun
                                      ? `Executar ${AUTOMATION_RUNNER_SHORT[runner]}`
                                      : `${AUTOMATION_RUNNER_SHORT[runner]} não configurado`
                                  }
                                  disabled={
                                    runningAll ||
                                    liveRunning ||
                                    runningId === item.testId ||
                                    !canRun
                                  }
                                  onClick={() =>
                                    void runTest(item.testId!, item.title, runner)
                                  }
                                  className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-emerald-500/15 hover:text-emerald-500 disabled:opacity-50"
                                >
                                  <Play className="size-4" />
                                </button>
                              </PremiumTooltip>
                              {Boolean(item.hasPlaywright) &&
                                (runner === "playwright" || !maestroAllowed) && (
                                  <PremiumTooltip
                                    align="end"
                                    label="Executar Playwright headless (sem janela)"
                                    wide
                                  >
                                    <button
                                      type="button"
                                      aria-label="Executar Playwright headless"
                                      disabled={
                                        runningAll ||
                                        liveRunning ||
                                        runningId === item.testId
                                      }
                                      onClick={() =>
                                        void runTest(
                                          item.testId!,
                                          item.title,
                                          "playwright",
                                          false,
                                        )
                                      }
                                      className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-sky-500/15 hover:text-sky-400 disabled:opacity-50"
                                    >
                                      <MonitorOff className="size-4" />
                                    </button>
                                  </PremiumTooltip>
                                )}
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                    })}
                </Fragment>
                      );
                    })}
                </Fragment>
              );
                    })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      </div>

      {linkedBugs.length > 0 && (
        <div className="space-y-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium">
              <Bug className="size-4 text-muted-foreground" aria-hidden />
              Bugs encontrados ({linkedBugs.length})
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Defeitos vinculados a esta campanha — não entram no contador de CTs acima.
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Bug</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium w-24">Ações</th>
                </tr>
              </thead>
              <tbody>
                {linkedBugs.map((bug) => (
                  <tr
                    key={bug.bugId}
                    role="link"
                    tabIndex={0}
                    aria-label={`Abrir ${bug.bugCode ?? bug.bugId}`}
                    onClick={() =>
                      openFromCampaign(
                        projectBugDetailPath(project, bug.bugId, bug.channel),
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openFromCampaign(
                          projectBugDetailPath(project, bug.bugId, bug.channel),
                        );
                      }
                    }}
                    className={cn("border-b last:border-0 cursor-pointer", tableRowHoverClass)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{bug.title}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {bug.bugCode ?? bug.bugId}
                        {bug.testKey ? ` · ${bug.testKey}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-xs",
                          bugStatusTone(bug.status),
                        )}
                      >
                        {BUG_STATUS_LABELS[bug.status] ?? bug.status}
                      </span>
                    </td>
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <PremiumTooltip label="Abrir bug" align="end">
                        <button
                          type="button"
                          aria-label="Abrir bug"
                          onClick={() =>
                            openFromCampaign(
                              projectBugDetailPath(
                                project,
                                bug.bugId,
                                bug.channel,
                              ),
                            )
                          }
                          className={cn(actionBtnBase, actionBtn.ghost, "size-8 p-0")}
                        >
                          <ExternalLink className="size-4" />
                        </button>
                      </PremiumTooltip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {homologation.status !== "concluida" &&
        !isVisitor &&
        addableTests.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm font-medium">Adicionar teste ao escopo</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Testes do catálogo que ainda não fazem parte desta campanha.
          </p>
          <ul className="mt-3 space-y-2">
            {addableTests.slice(0, 8).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{t.title}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void addTestToScope(t.testKey!)}
                  className={cn(actionBtnBase, actionBtn.create, "h-8 px-3 text-xs")}
                >
                  Adicionar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {homologation.history.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <p className="mb-3 text-sm font-medium">Histórico da homologação</p>
          <ul className="space-y-2 text-sm">
            {homologation.history
              .slice()
              .reverse()
              .slice(0, 8)
              .map((h, i) => (
                <li key={`${h.at}-${i}`} className="text-muted-foreground">
                  <span className="text-xs tabular-nums">
                    {new Date(h.at).toLocaleString("pt-BR")}
                  </span>
                  {" — "}
                  {h.detail ?? h.action}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
