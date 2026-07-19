import {
  groupByModuleThenSuite,
  MODULE_LABELS,
  moduleFromTestRecord,
  summarizeSuite,
  suiteFromTestRecord,
  SUITE_LABELS,
  type SuiteStats,
} from "@/lib/suite";
import { countTestRuns } from "@/lib/history";
import { isBugReport, isTestCase, type TestRecord } from "@/types/test-record";
import type { HomologationWithProgress } from "@/types/homologation";

export type SuiteDashboardRow = {
  module: string;
  moduleLabel: string;
  suite: string;
  label: string;
  stats: SuiteStats;
};

export type ModuleDashboardRow = {
  module: string;
  label: string;
  stats: SuiteStats;
  suiteCount: number;
};

export type DashboardMetrics = {
  generatedAt: string;
  testsTotal: number;
  bugsOpen: number;
  bugsTotal: number;
  passed: number;
  failed: number;
  pending: number;
  passRatePct: number;
  automated: number;
  readyFlows: number;
  draftFlows: number;
  totalRuns: number;
  lastRunAt?: string;
  activeHomologations: number;
  primaryHomologation?: {
    id: string;
    slug: string;
    title: string;
    build?: string;
    status: string;
    passed: number;
    failed: number;
    pending: number;
    total: number;
    passRatePct: number;
  };
  modules: ModuleDashboardRow[];
  suites: SuiteDashboardRow[];
  failures: Array<{
    id: string;
    title: string;
    testKey?: string;
    module: string;
    suite: string;
  }>;
};

export function computeDashboardMetrics(
  reports: TestRecord[],
  homologations: HomologationWithProgress[],
): DashboardMetrics {
  const tests = reports.filter(isTestCase);
  const bugs = reports.filter(isBugReport);
  const bugsOpen = bugs.filter(
    (b) => b.status !== "homologado" && b.status !== "arquivado",
  ).length;

  let passed = 0;
  let failed = 0;
  let pending = 0;
  let automated = 0;
  let readyFlows = 0;
  let draftFlows = 0;
  let totalRuns = 0;
  let lastRunAt: string | undefined;

  for (const t of tests) {
    const h = t.homologationStatus ?? "pendente";
    if (h === "passou" || h === "homologado") passed += 1;
    else if (h === "falhou") failed += 1;
    else pending += 1;

    if (t.automation?.flowPath) {
      automated += 1;
      if (t.automation.readiness === "ready") readyFlows += 1;
      else draftFlows += 1;
    }
    totalRuns += countTestRuns(t.history);
    const at = t.automation?.lastRunAt;
    if (at && (!lastRunAt || at > lastRunAt)) lastRunAt = at;
  }

  const moduleGroups = groupByModuleThenSuite(tests);
  const modules: ModuleDashboardRow[] = moduleGroups.map((g) => ({
    module: g.module,
    label: MODULE_LABELS[g.module] ?? g.module,
    stats: summarizeSuite(g.items),
    suiteCount: g.suites.length,
  }));

  const suites: SuiteDashboardRow[] = moduleGroups.flatMap((mod) =>
    mod.suites.map((g) => ({
      module: mod.module,
      moduleLabel: MODULE_LABELS[mod.module] ?? mod.module,
      suite: g.suite,
      label: SUITE_LABELS[g.suite] ?? g.suite,
      stats: summarizeSuite(g.items),
    })),
  );

  const failures = tests
    .filter((t) => t.homologationStatus === "falhou")
    .map((t) => {
      const suite = suiteFromTestRecord(t);
      const mod = moduleFromTestRecord(t);
      return {
        id: t.id,
        title: t.title,
        testKey: t.testKey,
        module: MODULE_LABELS[mod] ?? mod,
        suite: SUITE_LABELS[suite] ?? suite,
      };
    });

  const active = homologations.filter((h) => h.status === "em_andamento");
  const primary =
    active.find((h) => h.slug.includes("mural")) ?? active[0] ?? homologations[0];

  const primaryHomologation = primary
    ? {
        id: primary.id,
        slug: primary.slug,
        title: primary.title,
        build: primary.build,
        status: primary.status,
        passed: primary.progress.passed,
        failed: primary.progress.failed,
        pending: primary.progress.pending,
        total: primary.progress.total,
        passRatePct:
          primary.progress.total > 0
            ? Math.round((primary.progress.passed / primary.progress.total) * 100)
            : 0,
      }
    : undefined;

  const testsTotal = tests.length;
  return {
    generatedAt: new Date().toISOString(),
    testsTotal,
    bugsOpen,
    bugsTotal: bugs.length,
    passed,
    failed,
    pending,
    passRatePct: testsTotal > 0 ? Math.round((passed / testsTotal) * 100) : 0,
    automated,
    readyFlows,
    draftFlows,
    totalRuns,
    lastRunAt,
    activeHomologations: active.length,
    primaryHomologation,
    modules,
    suites,
    failures,
  };
}
