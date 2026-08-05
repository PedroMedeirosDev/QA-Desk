import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bug, ExternalLink, ListChecks, Play, Plus } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { ExecutionModeBadge } from "@/components/ExecutionModeBadge";
import { AutomationReadinessBadge } from "@/components/AutomationReadinessBadge";
import { DesignCheckbox } from "@/components/DesignCheckbox";
import { PremiumTooltip, tableRowHoverClass } from "@/components/PremiumTooltip";
import { ModuleHeaderRow, SuiteHeaderRow } from "@/components/SuiteHeaderRow";
import { SuiteListControls } from "@/components/SuiteListControls";
import { api } from "@/lib/api";
import { useConfirm } from "@/lib/confirm";
import { toastErrorMessage, useToast } from "@/lib/toast";
import {
  useRunProgress,
  RUN_CANCELLED_MESSAGE,
  QA_RUN_FINISHED_EVENT,
  clearBatchStop,
  isBatchStopRequested,
  type LiveRunState,
} from "@/lib/run-progress";
import { actionBtn, actionBtnBase } from "@/lib/button-styles";
import { countTestRunsForRunner } from "@/lib/history";
import {
  projectBugsListPath,
  projectDetailPath,
  projectHomologationsListPath,
  projectNewPath,
} from "@/lib/project-paths";
import { cn } from "@/lib/utils";
import {
  CHANNEL_LABELS,
  channelSupportsMaestro,
  getProjectChannels,
  type ProductChannel,
} from "@/config/channels";
import type { ProjectSlug, TestRecord } from "@/types/test-record";
import {
  displayStatus,
  formatRecordId,
  inferChannel,
  isTestCase,
} from "@/types/test-record";
import { sortTestRecords } from "@/lib/test-sort";
import {
  allGreenModuleKeys,
  allGreenSuiteKeys,
  groupByModuleThenSuite,
  isDeferredFromBatchRun,
  MODULE_LABELS,
  suiteCollapseKey,
  suiteFromTestRecord,
  summarizeSuite,
  SUITE_LABELS,
} from "@/lib/suite";
import {
  AUTOMATION_RUNNER_SHORT,
  defaultRunnerForChannel,
  hasMaestroAutomation,
  hasPlaywrightAutomation,
  readPlaywrightHeaded,
  readSuiteRunner,
  supportsRunner,
  writePlaywrightHeaded,
  writeSuiteRunner,
  type AutomationRunner,
} from "@/lib/automation-runners";
import type { HomologationWithProgress } from "@/types/homologation";

/** v2: chaves `m:Mural` e `s:Mural::CRUD` */
const COLLAPSE_KEY = "qa-group-collapsed-v2";

function modKey(module: string) {
  return `m:${module}`;
}
function suiteKey(module: string, suite: string) {
  return `s:${suiteCollapseKey(module, suite)}`;
}

function collapseStorageKey(project: string, channel?: string) {
  return `${COLLAPSE_KEY}:${project}:${channel ?? "all"}`;
}

/** `null` = primeira visita (ainda não gravou preferência). */
function readCollapsedRaw(project: string, channel?: string): string[] | null {
  try {
    const raw = sessionStorage.getItem(collapseStorageKey(project, channel));
    if (raw === null) return null;
    const arr = JSON.parse(raw) as string[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveCollapsed(project: string, channel: string | undefined, set: Set<string>) {
  try {
    sessionStorage.setItem(
      collapseStorageKey(project, channel),
      JSON.stringify([...set]),
    );
  } catch {
    /* ignore */
  }
}

const EMPTY_CHANNEL_HINT: Record<ProductChannel, string> = {
  app: "Use o checklist Mural ou crie testes manualmente.",
  web: "Homologação WEB em preparação — testes aparecerão aqui.",
  portal: "Homologação PORTAL em preparação — testes aparecerão aqui.",
};

export function TestListPage({
  project,
  channel: routeChannel,
}: {
  project: ProjectSlug;
  channel?: ProductChannel;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { isAdmin } = useAuth();
  const { runAutomation, running: liveRunning } = useRunProgress();
  const [reports, setReports] = useState<TestRecord[]>([]);
  const [campaignOnly, setCampaignOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runningGroup, setRunningGroup] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState("");
  const [homologations, setHomologations] = useState<HomologationWithProgress[]>([]);
  /** null até hidratar (auto-recolher verdes na 1ª visita). */
  const [collapsed, setCollapsed] = useState<Set<string> | null>(null);
  /** Executor selecionado por chave `Módulo::Suite` */
  const [suiteRunners, setSuiteRunners] = useState<Record<string, AutomationRunner>>({});
  const [playwrightHeaded, setPlaywrightHeaded] = useState(readPlaywrightHeaded);

  useEffect(() => {
    setCollapsed(null);
    setSuiteRunners({});
  }, [project, routeChannel]);

  const hasChannels = getProjectChannels(project).length > 0;

  function reload(opts?: { soft?: boolean }) {
    if (!opts?.soft) setLoading(true);
    Promise.all([api.listTests(project), api.listHomologations(project).catch(() => null)])
      .then(([catalog, homRes]) => {
        setReports(catalog.reports);
        setHomologations(homRes?.homologations ?? []);
      })
      .finally(() => setLoading(false));
  }

  const channelHomologations = useMemo(() => {
    let list = homologations;
    if (routeChannel) {
      list = list.filter((h) => !h.channel || h.channel === routeChannel);
    }
    return list;
  }, [homologations, routeChannel]);

  const activeHomologations = channelHomologations.filter((h) => h.status !== "concluida");

  useEffect(() => {
    reload();
  }, [project]);

  /** Após cancel/fim, atualiza badges sem depender só do await do Play (e sem F5). */
  useEffect(() => {
    const onFinished = (event: Event) => {
      const detail = (event as CustomEvent<LiveRunState>).detail;
      if (!detail?.result || detail.project !== project) return;
      reload({ soft: true });
    };
    window.addEventListener(QA_RUN_FINISHED_EVENT, onFinished);
    return () => window.removeEventListener(QA_RUN_FINISHED_EVENT, onFinished);
  }, [project]);

  const filtered = useMemo(() => {
    let list = reports.filter(isTestCase);
    if (routeChannel) {
      list = list.filter((r) => inferChannel(r) === routeChannel);
    }
    if (campaignOnly) {
      const slugs = new Set(channelHomologations.map((h) => h.slug));
      list = list.filter((r) => r.campaign && slugs.has(r.campaign));
    }
    return sortTestRecords(list, channelHomologations);
  }, [reports, routeChannel, campaignOnly, channelHomologations]);

  const moduleGroups = useMemo(() => groupByModuleThenSuite(filtered), [filtered]);

  const maestroAllowed = channelSupportsMaestro(routeChannel);
  const channelDefaultRunner = defaultRunnerForChannel(routeChannel);

  useEffect(() => {
    if (loading || moduleGroups.length === 0) return;
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
  }, [loading, moduleGroups, maestroAllowed, channelDefaultRunner]);

  function suiteRunnerFor(module: string, suite: string): AutomationRunner {
    if (!maestroAllowed) return "playwright";
    return suiteRunners[suiteCollapseKey(module, suite)] ?? channelDefaultRunner;
  }

  function setSuiteRunner(module: string, suite: string, runner: AutomationRunner) {
    const key = suiteCollapseKey(module, suite);
    writeSuiteRunner(key, runner);
    setSuiteRunners((prev) => ({ ...prev, [key]: runner }));
  }

  function runnerForRecord(record: TestRecord): AutomationRunner {
    const suite = suiteFromTestRecord(record);
    const mod = record.module?.trim()
      ? record.module
      : "Outros";
    // Prefer exact module from grouping helpers
    for (const m of moduleGroups) {
      if (m.items.some((i) => i.id === record.id)) {
        return suiteRunnerFor(m.module, suite);
      }
    }
    return suiteRunnerFor(mod, suite);
  }

  useEffect(() => {
    if (loading || collapsed !== null) return;
    const stored = readCollapsedRaw(project, routeChannel);
    if (stored === null) {
      const next = new Set([
        ...allGreenSuiteKeys(moduleGroups).map((k) => `s:${k}`),
        ...allGreenModuleKeys(moduleGroups).map(modKey),
      ]);
      setCollapsed(next);
      saveCollapsed(project, routeChannel, next);
    } else {
      setCollapsed(new Set(stored));
    }
  }, [loading, collapsed, moduleGroups, project, routeChannel]);

  const homologationCount = channelHomologations.length;

  function openDetail(id: string) {
    const report = reports.find((r) => r.id === id);
    const ch = inferChannel(report ?? { project, platform: "web" }) ?? routeChannel;
    navigate(projectDetailPath(project, id, ch));
  }

  async function quickRun(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    const report = reports.find((r) => r.id === id);
    const runner = report ? runnerForRecord(report) : "maestro";
    if (report && !supportsRunner(report.automation, runner)) {
      toast.info(
        `${AUTOMATION_RUNNER_SHORT[runner]} não configurado neste CT.`,
        { title: AUTOMATION_RUNNER_SHORT[runner] },
      );
      return;
    }
    setRunningId(id);
    try {
      const res = await runAutomation({
        project,
        testId: id,
        title: report?.title ?? formatRecordId(id, report),
        runner,
        ...(runner === "playwright" ? { headed: playwrightHeaded } : {}),
      });
      const ver = res.appVersion ? ` · v${res.appVersion}` : "";
      const runnerTitle = AUTOMATION_RUNNER_SHORT[runner];
      if (res.cancelled) {
        clearBatchStop();
        toast.info(`Execução #${res.runNumber} cancelada${ver}`, {
          title: runnerTitle,
          duration: 8000,
        });
      } else if (res.ok) {
        toast.success(`Execução #${res.runNumber} passou${ver}`);
      } else {
        const where =
          res.failure?.failedStepLabel ??
          res.failure?.failedAction ??
          "veja histórico";
        toast.error(`Execução #${res.runNumber} falhou${ver} — ${where}`, {
          title: runnerTitle,
        });
      }
      reload({ soft: true });
    } catch (err) {
      const msg = toastErrorMessage(err, "Erro ao executar");
      if (msg === RUN_CANCELLED_MESSAGE) {
        clearBatchStop();
        toast.info("Execução cancelada", {
          title: AUTOMATION_RUNNER_SHORT[runner],
          duration: 8000,
        });
        reload({ soft: true });
      } else {
        toast.error(msg);
      }
    } finally {
      setRunningId(null);
    }
  }

  async function runGroup(
    kind: "suite" | "module",
    name: string,
    groupId: string,
    items: TestRecord[],
    runnerOverride?: AutomationRunner,
  ) {
    const queue = items.filter((t) => {
      if (isDeferredFromBatchRun(t)) return false;
      const runner = runnerOverride ?? runnerForRecord(t);
      return supportsRunner(t.automation, runner);
    });
    const kindLabel = kind === "module" ? "módulo" : "suite";
    const deferred = items.filter(
      (t) =>
        (hasMaestroAutomation(t.automation) || hasPlaywrightAutomation(t.automation)) &&
        isDeferredFromBatchRun(t),
    ).length;
    const missingRunner = items.filter((t) => {
      if (isDeferredFromBatchRun(t)) return false;
      const runner = runnerOverride ?? runnerForRecord(t);
      return !supportsRunner(t.automation, runner);
    }).length;
    if (queue.length === 0) {
      toast.info(
        deferred > 0
          ? `Nenhum CT elegível no ${kindLabel} ${name} (${deferred} adiado(s), ex.: E2E).`
          : missingRunner > 0
            ? `Nenhum CT com ${AUTOMATION_RUNNER_SHORT[runnerOverride ?? "maestro"]} no ${kindLabel} ${name}.`
            : `Nenhuma automação no ${kindLabel} ${name}.`,
      );
      return;
    }

    const ok = await confirm({
      title: `Rodar ${kindLabel} ${name}`,
      description: `${queue.length} teste(s) em sequência${
        deferred ? ` · ${deferred} adiado(s) fora do lote` : ""
      }${missingRunner ? ` · ${missingRunner} sem o executor selecionado` : ""}.\nSe um falhar, continua nos próximos.`,
      confirmLabel: "Rodar",
      cancelLabel: "Cancelar",
      tone: "run",
    });
    if (!ok) return;

    setRunningGroup(groupId);
    let passed = 0;
    let failed = 0;
    clearBatchStop();

    try {
      for (let i = 0; i < queue.length; i++) {
        if (isBatchStopRequested()) {
          toast.info(`${kindLabel} ${name} interrompido.`, { title: "Execução em lote" });
          break;
        }
        const item = queue[i];
        const runner = runnerOverride ?? runnerForRecord(item);
        setBatchProgress(
          `${name} ${i + 1}/${queue.length} — ${item.title}  ·  ✓ ${passed}  ✗ ${failed}`,
        );
        setRunningId(item.id);
        try {
          const res = await runAutomation({
            project,
            testId: item.id,
            title: item.title,
            batchLabel: `${name} ${i + 1}/${queue.length}`,
            runner,
            ...(runner === "playwright" ? { headed: playwrightHeaded } : {}),
          });
          if (res.cancelled || isBatchStopRequested()) {
            toast.info(`${kindLabel} ${name} interrompido.`, { title: "Execução em lote" });
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
            toast.info(`${kindLabel} ${name} interrompido.`, { title: "Execução em lote" });
            break;
          }
          failed += 1;
          toast.error(`${item.title} — ${msg} (seguindo…)`, {
            title: AUTOMATION_RUNNER_SHORT[runner],
          });
        }
      }

      toast.info(`${name}: ${passed} passou · ${failed} falhou`, {
        title: "Execução em lote",
        duration: 10000,
      });
      reload({ soft: true });
    } finally {
      clearBatchStop();
      setRunningGroup(null);
      setRunningId(null);
      setBatchProgress("");
    }
  }

  const busy = Boolean(runningId || runningGroup || liveRunning);

  function applyCollapsed(next: Set<string>) {
    setCollapsed(next);
    saveCollapsed(project, routeChannel, next);
  }

  function toggleCollapsedKey(key: string) {
    const prev = collapsed ?? new Set<string>();
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    applyCollapsed(next);
  }

  function expandAllSuites() {
    applyCollapsed(new Set());
  }

  function collapseAllSuites() {
    const next = new Set<string>();
    for (const mod of moduleGroups) {
      next.add(modKey(mod.module));
      for (const suite of mod.suites) {
        next.add(suiteKey(mod.module, suite.suite));
      }
    }
    applyCollapsed(next);
  }

  function collapseGreenSuites() {
    applyCollapsed(
      new Set([
        ...allGreenSuiteKeys(moduleGroups).map((k) => `s:${k}`),
        ...allGreenModuleKeys(moduleGroups).map(modKey),
      ]),
    );
  }

  return (
    <div className="space-y-4">
      <div className="surface-brand rounded-xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">Homologações</p>
            <p className="mt-1 text-sm opacity-90">
              {activeHomologations.length > 0
                ? `${activeHomologations.length} campanha(s) em andamento neste canal.`
                : "Nenhuma campanha ativa — crie ou abra a lista."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(projectHomologationsListPath(project))}
            className={cn(actionBtnBase, actionBtn.onBrand, "px-3")}
          >
            <ListChecks className="size-4" />
            Ver todas as homologações
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {homologationCount > 0 && (
            <DesignCheckbox
              checked={campaignOnly}
              onChange={(e) => setCampaignOnly(e.target.checked)}
              label="Só homologações"
            />
          )}
          <span className="text-xs text-muted-foreground">
            {filtered.length} teste(s)
            {routeChannel && hasChannels ? ` · ${CHANNEL_LABELS[routeChannel]}` : ""}
            {moduleGroups.length > 0
              ? ` · ${moduleGroups.length} módulo(s) · ${moduleGroups.reduce((n, m) => n + m.suites.length, 0)} suites`
              : ""}
          </span>
          <button
            type="button"
            onClick={() => navigate(projectBugsListPath(project, routeChannel))}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            <Bug className="size-3.5" />
            Ver bugs reportados
          </button>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => navigate(projectNewPath(project, routeChannel))}
            className={cn(actionBtnBase, actionBtn.create)}
          >
            <Plus className="size-4" />
            Novo teste
          </button>
        )}
      </div>

      {batchProgress && (
        <div className="sticky top-0 z-10 rounded-lg border border-primary/40 bg-card px-4 py-3 shadow-sm">
          <p className="text-sm font-medium text-foreground">Executando suite</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {batchProgress} — se um falhar, segue para o próximo
          </p>
        </div>
      )}

      {moduleGroups.length > 0 && (
        <SuiteListControls
          onExpandAll={expandAllSuites}
          onCollapseAll={collapseAllSuites}
          onCollapseGreens={collapseGreenSuites}
          playwrightHeaded={playwrightHeaded}
          onPlaywrightHeadedChange={(headed) => {
            writePlaywrightHeaded(headed);
            setPlaywrightHeaded(headed);
          }}
        />
      )}

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card/80 shadow-sm">
        <table className="data-table w-full text-sm">
          <thead>
            <tr className="border-b border-border/80 bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Título</th>
              <th className="px-4 py-2.5 font-medium">Modo</th>
              <th className="px-4 py-2.5 font-medium">Resultado</th>
              <th className="px-4 py-2.5 font-medium">Rodadas</th>
              <th className="px-4 py-2.5 font-medium">Última</th>
              <th className="px-4 py-2.5 font-medium w-28">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center">
                  <div className="animate-fade-in-up-soft opacity-0">
                    <p className="text-muted-foreground">Nenhum teste neste canal.</p>
                    {routeChannel && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {EMPTY_CHANNEL_HINT[routeChannel]}
                      </p>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              moduleGroups.map((mod) => {
                const collapsedSet = collapsed ?? new Set<string>();
                const modExpanded = !collapsedSet.has(modKey(mod.module));
                const modStats = summarizeSuite(mod.items, "maestro");
                const modLabel = MODULE_LABELS[mod.module] ?? mod.module;
                return (
                  <Fragment key={`mod-${mod.module}`}>
                    <ModuleHeaderRow
                      variant="tests"
                      module={mod.module}
                      suiteCount={mod.suites.length}
                      stats={modStats}
                      expanded={modExpanded}
                      onToggle={() => toggleCollapsedKey(modKey(mod.module))}
                      onRunModule={() =>
                        void runGroup("module", modLabel, modKey(mod.module), mod.items)
                      }
                      runDisabled={busy}
                      running={runningGroup === modKey(mod.module)}
                    />
                    {modExpanded &&
                      mod.suites.map((group) => {
                        const sk = suiteKey(mod.module, group.suite);
                        const runner = suiteRunnerFor(mod.module, group.suite);
                        const stats = summarizeSuite(group.items, runner);
                        const expanded = !collapsedSet.has(sk);
                        const suiteLabel = SUITE_LABELS[group.suite] ?? group.suite;
                        return (
                          <Fragment key={sk}>
                            <SuiteHeaderRow
                              variant="tests"
                              suite={group.suite}
                              stats={stats}
                              expanded={expanded}
                              onToggle={() => toggleCollapsedKey(sk)}
                              onRunSuite={() =>
                                void runGroup(
                                  "suite",
                                  suiteLabel,
                                  sk,
                                  group.items,
                                  runner,
                                )
                              }
                              runDisabled={busy}
                              running={runningGroup === sk}
                              runner={runner}
                              onRunnerChange={
                                maestroAllowed
                                  ? (next) =>
                                      setSuiteRunner(
                                        mod.module,
                                        group.suite,
                                        next,
                                      )
                                  : undefined
                              }
                            />
                            {expanded &&
                              group.items.map((r, rowIdx) => {
                                const { label, tone } = displayStatus(r, runner);
                                const canRun = supportsRunner(r.automation, runner);
                                const hasAny =
                                  hasMaestroAutomation(r.automation) ||
                                  hasPlaywrightAutomation(r.automation);
                                return (
                                  <tr
                                    key={r.id}
                                    className={cn(
                                      "test-row cursor-pointer select-none",
                                      tableRowHoverClass,
                                      rowIdx % 2 === 1 && "bg-muted/25",
                                    )}
                                    onClick={() => openDetail(r.id)}
                                  >
                                    <td className="px-4 py-2 pl-8">
                                      <p className="font-medium leading-snug">{r.title}</p>
                                      <p className="font-mono text-[0.6875rem] tabular-nums text-muted-foreground">
                                        {r.testKey ?? formatRecordId(r.id, r)}
                                      </p>
                                      {hasAny && !canRun && (
                                        <p className="mt-0.5 text-[0.65rem] text-amber-400/90">
                                          {AUTOMATION_RUNNER_SHORT[runner]} não configurado
                                        </p>
                                      )}
                                    </td>
                                    <td className="px-4 py-2">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <ExecutionModeBadge record={r} />
                                        <AutomationReadinessBadge record={r} runner={runner} />
                                      </div>
                                    </td>
                                    <td className="px-4 py-2">
                                      <span
                                        className={cn(
                                          "rounded-full px-2 py-0.5 text-xs font-medium",
                                          tone === "ok" &&
                                            "bg-emerald-600 text-white",
                                          tone === "fail" &&
                                            "bg-red-600 text-white",
                                          tone === "warn" &&
                                            "border border-amber-400/20 bg-[#1a1a1a] text-amber-300",
                                          tone === "neutral" &&
                                            "border border-gray-700 bg-[#1a1a1a] text-gray-400",
                                        )}
                                      >
                                        {label}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 text-center tabular-nums">
                                      {countTestRunsForRunner(r.history ?? [], runner)}
                                    </td>
                                    <td className="px-4 py-2 text-xs tabular-nums text-muted-foreground">
                                      {(() => {
                                        const lastAt =
                                          runner === "playwright"
                                            ? r.automation?.playwright?.lastRunAt
                                            : r.automation?.lastRunAt;
                                        return lastAt
                                          ? new Date(lastAt).toLocaleString("pt-BR", {
                                              day: "2-digit",
                                              month: "2-digit",
                                              year: "numeric",
                                              hour: "2-digit",
                                              minute: "2-digit",
                                            })
                                          : "—";
                                      })()}
                                    </td>
                                    <td
                                      className="px-4 py-2"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="flex items-center gap-1">
                                        <PremiumTooltip label="Abrir" align="end">
                                          <button
                                            type="button"
                                            aria-label="Abrir"
                                            onClick={() => openDetail(r.id)}
                                            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                          >
                                            <ExternalLink className="size-4" />
                                          </button>
                                        </PremiumTooltip>
                                        {isAdmin && hasAny && (
                                          <PremiumTooltip
                                            align="end"
                                            label={
                                              canRun
                                                ? `Executar (${AUTOMATION_RUNNER_SHORT[runner]})`
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
                                              disabled={busy || !canRun}
                                              onClick={(e) => void quickRun(e, r.id)}
                                              className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-emerald-500/15 hover:text-emerald-500 disabled:opacity-50"
                                            >
                                              <Play className="size-4" />
                                            </button>
                                          </PremiumTooltip>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                          </Fragment>
                        );
                      })}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
