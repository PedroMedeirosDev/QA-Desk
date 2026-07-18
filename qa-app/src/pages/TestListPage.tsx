import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bug, ExternalLink, ListChecks, Play, Plus } from "lucide-react";
import { ExecutionModeBadge } from "@/components/ExecutionModeBadge";
import { AutomationReadinessBadge } from "@/components/AutomationReadinessBadge";
import { ModuleHeaderRow, SuiteHeaderRow } from "@/components/SuiteHeaderRow";
import { SuiteListControls } from "@/components/SuiteListControls";
import { api } from "@/lib/api";
import { useConfirm } from "@/lib/confirm";
import { toastErrorMessage, useToast } from "@/lib/toast";
import { useRunProgress, RUN_CANCELLED_MESSAGE } from "@/lib/run-progress";
import { actionBtn, actionBtnBase } from "@/lib/button-styles";
import { countTestRuns } from "@/lib/history";
import {
  projectBugsListPath,
  projectDetailPath,
  projectHomologationsListPath,
  projectNewPath,
} from "@/lib/project-paths";
import { cn } from "@/lib/utils";
import { CHANNEL_LABELS, getProjectChannels, type ProductChannel } from "@/config/channels";
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
  MODULE_LABELS,
  suiteCollapseKey,
  summarizeSuite,
  SUITE_LABELS,
} from "@/lib/suite";
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

  useEffect(() => {
    setCollapsed(null);
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
    setRunningId(id);
    try {
      const res = await runAutomation({
        project,
        testId: id,
        title: report?.title ?? formatRecordId(id, report),
      });
      const ver = res.appVersion ? ` · v${res.appVersion}` : "";
      if (res.cancelled) {
        toast.info(`Execução #${res.runNumber} cancelada${ver}`, {
          title: "Maestro",
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
          title: "Maestro",
        });
      }
      reload({ soft: true });
    } catch (err) {
      const msg = toastErrorMessage(err, "Erro ao executar");
      if (msg === RUN_CANCELLED_MESSAGE) {
        toast.info("Execução cancelada", { title: "Maestro", duration: 8000 });
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
  ) {
    const queue = items.filter((t) => t.automation?.flowPath);
    const kindLabel = kind === "module" ? "módulo" : "suite";
    if (queue.length === 0) {
      toast.info(`Nenhum flow Maestro no ${kindLabel} ${name}.`);
      return;
    }

    const ok = await confirm({
      title: `Rodar ${kindLabel} ${name}`,
      description: `${queue.length} teste(s) em sequência.\nSe um falhar, continua nos próximos.`,
      confirmLabel: "Rodar",
      cancelLabel: "Cancelar",
      tone: "run",
    });
    if (!ok) return;

    setRunningGroup(groupId);
    let passed = 0;
    let failed = 0;

    try {
      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
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
          });
          if (res.cancelled) {
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
              title: "Maestro",
            });
          }
        } catch (e) {
          const msg = toastErrorMessage(e, "erro");
          if (msg === RUN_CANCELLED_MESSAGE) {
            toast.info(`${kindLabel} ${name} interrompido.`, { title: "Execução em lote" });
            break;
          }
          failed += 1;
          toast.error(`${item.title} — ${msg} (seguindo…)`, { title: "Maestro" });
        }
      }

      toast.info(`${name}: ${passed} passou · ${failed} falhou`, {
        title: "Execução em lote",
        duration: 10000,
      });
      reload({ soft: true });
    } finally {
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
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={campaignOnly}
                onChange={(e) => setCampaignOnly(e.target.checked)}
              />
              Só homologações
            </label>
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
        <button
          type="button"
          onClick={() => navigate(projectNewPath(project, routeChannel))}
          className={cn(actionBtnBase, actionBtn.create)}
        >
          <Plus className="size-4" />
          Novo teste
        </button>
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
        />
      )}

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Título</th>
              <th className="px-4 py-3 font-medium">Modo</th>
              <th className="px-4 py-3 font-medium">Resultado</th>
              <th className="px-4 py-3 font-medium">Rodadas</th>
              <th className="px-4 py-3 font-medium">Última</th>
              <th className="px-4 py-3 font-medium w-28">Ações</th>
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
                  <p className="text-muted-foreground">Nenhum teste neste canal.</p>
                  {routeChannel && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {EMPTY_CHANNEL_HINT[routeChannel]}
                    </p>
                  )}
                </td>
              </tr>
            ) : (
              moduleGroups.map((mod) => {
                const collapsedSet = collapsed ?? new Set<string>();
                const modExpanded = !collapsedSet.has(modKey(mod.module));
                const modStats = summarizeSuite(mod.items);
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
                        const stats = summarizeSuite(group.items);
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
                                void runGroup("suite", suiteLabel, sk, group.items)
                              }
                              runDisabled={busy}
                              running={runningGroup === sk}
                            />
                            {expanded &&
                              group.items.map((r) => {
                                const { label, tone } = displayStatus(r);
                                return (
                                  <tr
                                    key={r.id}
                                    className="cursor-pointer border-b last:border-0 hover:bg-muted/40 select-none"
                                    onClick={() => openDetail(r.id)}
                                    title="Clique para abrir"
                                  >
                                    <td className="px-4 py-3 pl-8">
                                      <p className="font-medium">{r.title}</p>
                                      <p className="font-mono text-xs text-muted-foreground">
                                        {r.testKey ?? formatRecordId(r.id, r)}
                                      </p>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <ExecutionModeBadge record={r} />
                                        <AutomationReadinessBadge record={r} />
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span
                                        className={cn(
                                          "rounded-full border px-2 py-0.5 text-xs",
                                          tone === "ok" &&
                                            "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
                                          tone === "fail" &&
                                            "border-red-500/40 bg-red-500/15 text-red-400",
                                          tone === "warn" &&
                                            "border-amber-500/40 bg-amber-500/15 text-amber-300",
                                          tone === "neutral" &&
                                            "border-border bg-muted text-muted-foreground",
                                        )}
                                      >
                                        {label}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-center tabular-nums">
                                      {countTestRuns(r.history)}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-muted-foreground">
                                      {r.automation?.lastRunAt
                                        ? new Date(r.automation.lastRunAt).toLocaleString(
                                            "pt-BR",
                                            {
                                              day: "2-digit",
                                              month: "2-digit",
                                              year: "numeric",
                                              hour: "2-digit",
                                              minute: "2-digit",
                                            },
                                          )
                                        : "—"}
                                    </td>
                                    <td
                                      className="px-4 py-3"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          title="Abrir"
                                          onClick={() => openDetail(r.id)}
                                          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                        >
                                          <ExternalLink className="size-4" />
                                        </button>
                                        {r.automation?.flowPath && (
                                          <button
                                            type="button"
                                            title="Executar este item"
                                            disabled={busy}
                                            onClick={(e) => void quickRun(e, r.id)}
                                            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-emerald-500/15 hover:text-emerald-500 disabled:opacity-50"
                                          >
                                            <Play className="size-4" />
                                          </button>
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
