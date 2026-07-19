import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Play,
  RefreshCw,
} from "lucide-react";
import { AutomationReadinessBadge } from "@/components/AutomationReadinessBadge";
import { ModuleHeaderRow, SuiteHeaderRow } from "@/components/SuiteHeaderRow";
import { SuiteListControls } from "@/components/SuiteListControls";
import { api } from "@/lib/api";
import { useConfirm } from "@/lib/confirm";
import { toastErrorMessage, useToast } from "@/lib/toast";
import { useRunProgress, RUN_CANCELLED_MESSAGE } from "@/lib/run-progress";
import { actionBtn, actionBtnBase } from "@/lib/button-styles";
import { projectDetailPath, projectHomologationsListPath } from "@/lib/project-paths";
import { cn } from "@/lib/utils";
import { CHANNEL_LABELS } from "@/config/channels";
import { MURAL_HOMOLOGATION_SLUG } from "@/config/homologations";
import {
  groupByModuleThenSuite,
  MODULE_LABELS,
  suiteCollapseKey,
  summarizeSuiteProgress,
  SUITE_LABELS,
} from "@/lib/suite";
import {
  HOMOLOGATION_LABELS,
  inferChannel,
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
        {progress.pending > 0 && <span>{progress.pending} pendente(s)</span>}
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

  useEffect(() => {
    setCollapsed(null);
  }, [homSlug]);

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

  async function runTest(testId: string, title?: string) {
    setRunningId(testId);
    try {
      const res = await runAutomation({
        project,
        testId,
        title: title ?? testId,
        homologationId: homologation?.id,
      });
      const ver = res.appVersion ? ` · v${res.appVersion}` : "";
      if (res.ok) {
        toast.success(`Execução #${res.runNumber} passou${ver}`);
      } else {
        const where =
          res.failure?.failedStepLabel ??
          res.failure?.failedAction ??
          "veja o teste";
        toast.error(`Execução #${res.runNumber} falhou${ver} — ${where}`, {
          title: "Maestro",
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
    queue: HomologationProgress["items"],
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

    try {
      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
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
          });
          if (res.cancelled) {
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
              title: "Maestro",
            });
          }
        } catch (e) {
          const msg = toastErrorMessage(e, "erro");
          if (msg === RUN_CANCELLED_MESSAGE) {
            toast.info(`${opts.batchTitle} interrompida.`, {
              title: "Execução em lote",
            });
            break;
          }
          failed += 1;
          toast.error(`${item.title} — ${msg} (seguindo…)`, {
            title: "Maestro",
          });
        }
      }

      toast.info(`${opts.batchTitle}: ${passed} passou · ${failed} falhou`, {
        title: "Execução em lote",
        duration: 10000,
      });
      reload({ soft: true });
    } finally {
      setRunningAll(false);
      setRunningId(null);
      setBatchProgress("");
    }
  }

  async function runSuiteItems(
    suite: string,
    items: HomologationProgress["items"],
  ) {
    const queue = items.filter((i) => i.testId && i.hasAutomation);
    const label = SUITE_LABELS[suite] ?? suite;
    if (queue.length === 0) {
      toast.info(`Nenhum flow Maestro na suite ${label}.`);
      return;
    }
    await runQueue(queue, {
      title: `Rodar suite ${label}`,
      description: `${queue.length} teste(s) em sequência.\nSe um falhar, continua nos próximos.`,
      batchTitle: `Suite ${label}`,
    });
  }

  async function runAllAutomated() {
    if (!progress || !homologation) return;
    const queue = progress.items.filter((i) => i.testId && i.hasAutomation);
    if (queue.length === 0) {
      toast.info("Nenhum teste com Maestro vinculado nesta campanha.");
      return;
    }

    const draftCount = queue.filter((i) => i.readiness !== "ready").length;
    const description =
      draftCount > 0
        ? `${queue.length} teste(s) em sequência.\n${draftCount} ainda estão "em construção" e podem falhar.\nSe um falhar, a campanha continua nos próximos.`
        : `${queue.length} teste(s) Maestro em sequência.\nSe um falhar, continua nos próximos.\nDeixe o emulador ligado — pode demorar vários minutos.`;

    await runQueue(queue, {
      title: "Rodar homologação inteira",
      description,
      batchTitle: "Campanha",
    });
  }

  const moduleGroups = useMemo(() => {
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
    return groupByModuleThenSuite(enriched);
  }, [progress?.items, catalogTests]);

  useEffect(() => {
    if (collapsed !== null || moduleGroups.length === 0) return;
    try {
      const raw = sessionStorage.getItem(`qa-group-collapsed-hom-v2:${homSlug}`);
      if (raw === null) {
        const next = new Set<string>();
        for (const mod of moduleGroups) {
          if (summarizeSuiteProgress(mod.items).tone === "ok") {
            next.add(`m:${mod.module}`);
          }
          for (const suite of mod.suites) {
            if (summarizeSuiteProgress(suite.items).tone === "ok") {
              next.add(`s:${suiteCollapseKey(mod.module, suite.suite)}`);
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
  }, [collapsed, moduleGroups, homSlug]);

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
  const addableTests = catalogTests.filter(
    (t) =>
      t.testKey &&
      !scopeKeys.has(t.testKey) &&
      (!homologation.channel || inferChannel(t) === homologation.channel),
  );

  return (
    <div className="space-y-6">
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
        </ul>
      </div>

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
        </div>

        <div className="flex flex-wrap gap-2">
          {homologation.status !== "concluida" && (
            <button
              type="button"
              disabled={busy || runningAll || Boolean(runningId) || liveRunning}
              onClick={() => void runAllAutomated()}
              className={cn(actionBtnBase, actionBtn.run, "px-4 py-2 text-sm font-semibold")}
              title="Executa todos os testes Maestro desta campanha, um após o outro"
            >
              <Play className={cn("size-4", runningAll && "animate-pulse")} />
              {runningAll ? "Executando campanha…" : "▶ Rodar homologação inteira"}
            </button>
          )}
          {isMural && homologation.status !== "concluida" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void syncScope()}
              className={cn(actionBtnBase, actionBtn.checklist, "px-3")}
              title="Cria rascunhos faltantes e atualiza títulos/escopo a partir do catálogo Maestro"
            >
              <RefreshCw className={cn("size-4", busy && "animate-spin")} />
              Sincronizar checklist Mural
            </button>
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
            <button
              type="button"
              disabled={busy || !allPassed}
              title={allPassed ? "Marcar homologação como concluída" : "Todos os testes precisam passar"}
              onClick={() => void markComplete()}
              className={cn(actionBtnBase, actionBtn.create, "px-3")}
            >
              <CheckCircle2 className="size-4" />
              Concluir homologação
            </button>
          )}
        </div>
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
              Módulo → suite · chave <code className="text-[11px]">módulo/ct-id</code>
            </p>
          </div>
          <SuiteListControls
            onExpandAll={() => persistCollapsed(new Set())}
            onCollapseAll={() => {
              const next = new Set<string>();
              for (const mod of moduleGroups) {
                next.add(`m:${mod.module}`);
                for (const suite of mod.suites) {
                  next.add(`s:${suiteCollapseKey(mod.module, suite.suite)}`);
                }
              }
              persistCollapsed(next);
            }}
            onCollapseGreens={() => {
              const next = new Set<string>();
              for (const mod of moduleGroups) {
                if (summarizeSuiteProgress(mod.items).tone === "ok") {
                  next.add(`m:${mod.module}`);
                }
                for (const suite of mod.suites) {
                  if (summarizeSuiteProgress(suite.items).tone === "ok") {
                    next.add(`s:${suiteCollapseKey(mod.module, suite.suite)}`);
                  }
                }
              }
              persistCollapsed(next);
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
            {moduleGroups.map((mod) => {
              const collapsedSet = collapsed ?? new Set<string>();
              const modKey = `m:${mod.module}`;
              const modExpanded = !collapsedSet.has(modKey);
              const modStats = summarizeSuiteProgress(mod.items);
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
                    onRunModule={() => void runSuiteItems(modLabel, mod.items)}
                    runDisabled={runningAll || liveRunning || Boolean(runningId)}
                    running={runningAll}
                  />
                  {modExpanded &&
                    mod.suites.map((group) => {
                      const sk = `s:${suiteCollapseKey(mod.module, group.suite)}`;
                      const stats = summarizeSuiteProgress(group.items);
                      const expanded = !collapsedSet.has(sk);
                      return (
                <Fragment key={sk}>
                  <SuiteHeaderRow
                    variant="homologation"
                    suite={group.suite}
                    stats={stats}
                    expanded={expanded}
                    onToggle={() => toggleCollapsedKey(sk)}
                    onRunSuite={() => void runSuiteItems(group.suite, group.items)}
                    runDisabled={runningAll || liveRunning || Boolean(runningId)}
                    running={runningAll}
                  />
                  {expanded &&
                    group.items.map((item) => (
                      <tr key={item.testKey} className="border-b last:border-0">
                        <td className="px-4 py-3 pl-8">
                          <p className="font-medium">{item.title}</p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {item.testKey}
                          </p>
                          {item.hasAutomation && (
                            <div className="mt-1">
                              <AutomationReadinessBadge
                                record={{
                                  automation: {
                                    type: "maestro",
                                    flowPath: item.testKey,
                                    readiness: item.readiness,
                                  },
                                }}
                              />
                            </div>
                          )}
                          {!item.found && (
                            <p className="mt-1 text-xs text-amber-400">
                              Não cadastrado — sincronize o checklist
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-xs",
                              statusTone(item.status),
                            )}
                          >
                            {HOMOLOGATION_LABELS[item.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 tabular-nums text-center">
                          {item.runsInHomologation || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {item.testId && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                title="Abrir teste"
                                onClick={() =>
                                  navigate(
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
                              <button
                                type="button"
                                title={
                                  item.readiness === "ready"
                                    ? "Executar Maestro"
                                    : "Executar Maestro (flow ainda em construção)"
                                }
                                disabled={
                                  runningAll ||
                                  liveRunning ||
                                  runningId === item.testId ||
                                  !item.hasAutomation
                                }
                                onClick={() => void runTest(item.testId!, item.title)}
                                className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-emerald-500/15 hover:text-emerald-500 disabled:opacity-50"
                              >
                                <Play className="size-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
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

      {homologation.status !== "concluida" && addableTests.length > 0 && (
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
