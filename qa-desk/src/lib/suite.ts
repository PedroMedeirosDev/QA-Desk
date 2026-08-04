import type { HomologationStatus, TestRecord } from "@/types/test-record";
import { countTestRunsForRunner } from "@/lib/history";
import {
  hasMaestroAutomation,
  hasPlaywrightAutomation,
  type AutomationRunner,
} from "@/lib/automation-runners";

/**
 * Hierarquia na UI:
 *   módulo (Mural | Atendimento | …)
 *     → suite (CRUD | Anexos | …)
 *       → CT
 */

/** Ordem canônica dos módulos (desconhecidos vão ao final, alfabético). */
export const MODULE_ORDER = ["Mural", "Atendimento", "Rotina"] as const;

export const MODULE_LABELS: Record<string, string> = {
  Mural: "Mural",
  Atendimento: "Atendimento",
  Rotina: "Rotina",
  Outros: "Outros",
};

const MODULE_ALIASES: Record<string, string> = {
  mural: "Mural",
  atendimento: "Atendimento",
  "fale-conosco": "Atendimento",
  faleconosco: "Atendimento",
  rotina: "Rotina",
};

/** Ordem canônica das suites na UI. */
export const SUITE_ORDER = [
  "CRUD",
  "Enquete",
  "Anexos",
  "Boleto",
  "Correspondencia",
  "Eventos",
  "Lista",
  "Filtros",
  "E2E",
] as const;

export type KnownSuite = (typeof SUITE_ORDER)[number];

export const SUITE_LABELS: Record<string, string> = {
  CRUD: "CRUD",
  Enquete: "Enquete",
  Anexos: "Anexos",
  Boleto: "Boleto",
  Correspondencia: "Correspondência",
  Eventos: "Eventos",
  Lista: "Lista",
  Filtros: "Filtros especiais",
  E2E: "E2E",
  Outros: "Outros",
};

const SUITE_FROM_PREFIX: Record<string, string> = {
  crud: "CRUD",
  enquete: "Enquete",
  anexo: "Anexos",
  boleto: "Boleto",
  corresp: "Correspondencia",
  evento: "Eventos",
  lista: "Lista",
  filtro: "Filtros",
  e2e: "E2E",
};

export function normalizeModuleLabel(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/\s+/g, "-");
  if (!key) return "Outros";
  if (MODULE_ALIASES[key]) return MODULE_ALIASES[key];
  if (MODULE_LABELS[raw.trim()]) return raw.trim();
  return raw.trim().replace(/^\w/, (c) => c.toUpperCase());
}

/** Módulo do CT: campo `module` → tag → prefixo do testKey (`mural/crud-01`). */
export function moduleFromTestRecord(
  r: Pick<TestRecord, "module" | "tags" | "testKey">,
): string {
  if (r.module?.trim()) return normalizeModuleLabel(r.module);
  const tag = r.tags?.find((t) => t.startsWith("module:"));
  if (tag) return normalizeModuleLabel(tag.slice("module:".length));
  if (r.testKey?.includes("/")) {
    return normalizeModuleLabel(r.testKey.split("/")[0] ?? "Outros");
  }
  return "Outros";
}

export function moduleOrderIndex(module: string): number {
  const i = MODULE_ORDER.indexOf(module as (typeof MODULE_ORDER)[number]);
  return i >= 0 ? i : MODULE_ORDER.length;
}

/** Infere suite a partir do slug do CT (ex.: `01_1_comunicado_pdf`, `crud-01`). */
function suiteFromSlug(slug: string): string | null {
  const s = slug.toLowerCase();
  const prefix = s.split("-")[0] ?? "";
  if (prefix && SUITE_FROM_PREFIX[prefix]) return SUITE_FROM_PREFIX[prefix];

  // Polygonus Mural: mural/01_1_comunicado_* | mural/01_1_filtro_*
  if (/(?:^|_)(e2e|completo)(?:_|$)/.test(s) || /completo_e2e/.test(s)) return "E2E";
  if (/enquete/.test(s)) return "Enquete";
  if (/filtro/.test(s)) return "Filtros";
  if (/evento/.test(s)) return "Eventos";
  if (/boleto/.test(s)) return "Boleto";
  if (/corresp/.test(s)) return "Correspondencia";
  if (/pdf|foto|video|galeria|anexo/.test(s)) return "Anexos";
  if (/enviar|editar|excluir/.test(s)) return "CRUD";
  return null;
}

export function suiteFromTestRecord(r: Pick<TestRecord, "tags" | "testKey" | "title">): string {
  const tag = r.tags?.find((t) => t.startsWith("suite:"));
  if (tag) return tag.slice("suite:".length);

  if (r.testKey?.includes("/")) {
    const id = r.testKey.split("/")[1] ?? "";
    const fromSlug = suiteFromSlug(id);
    if (fromSlug) return fromSlug;
  } else if (r.testKey?.trim()) {
    const fromSlug = suiteFromSlug(r.testKey);
    if (fromSlug) return fromSlug;
  }

  const title = r.title ?? "";
  const titleMatch = /^(CRUD|ENQUETE|ANEXO|BOLETO|CORRESP|EVENTO|LISTA|E2E)[-_]?\d*/i.exec(title);
  if (titleMatch) {
    const p = titleMatch[1].toLowerCase();
    return SUITE_FROM_PREFIX[p] ?? "Outros";
  }

  const fromTitle = suiteFromSlug(title.replace(/\s+/g, "_"));
  if (fromTitle) return fromTitle;

  return "Outros";
}

/**
 * CTs adiados do lote (módulo/suite). Ex.: E2E-99 só depois que o restante do Mural estiver estável.
 * Ainda podem ser rodados individualmente pelo botão do CT.
 */
export function isDeferredFromBatchRun(
  r: Pick<TestRecord, "tags" | "testKey" | "title">,
): boolean {
  if (r.tags?.includes("deferred:batch") || r.tags?.includes("ct:E2E-99")) return true;
  if (r.testKey?.toLowerCase().includes("e2e")) return true;
  if (/^E2E[-_]?\d*/i.test(r.title ?? "")) return true;
  return suiteFromTestRecord(r) === "E2E";
}

export function suiteOrderIndex(suite: string): number {
  const i = SUITE_ORDER.indexOf(suite as KnownSuite);
  return i >= 0 ? i : SUITE_ORDER.length;
}

/** Chave estável de colapso: módulo + suite (ex.: `Mural::Anexos`). */
export function suiteCollapseKey(module: string, suite: string): string {
  return `${module}::${suite}`;
}

export type SuiteGroup<T> = { suite: string; items: T[] };

export type ModuleGroup<T> = {
  module: string;
  items: T[];
  suites: SuiteGroup<T>[];
};

type Groupable = Pick<TestRecord, "module" | "tags" | "testKey" | "title">;

/** Agrupa suites; ordena pela ordem canônica. */
export function groupBySuite<T extends Groupable>(list: T[]): SuiteGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const item of list) {
    const suite = suiteFromTestRecord(item);
    const bucket = map.get(suite);
    if (bucket) bucket.push(item);
    else map.set(suite, [item]);
  }

  return [...map.entries()]
    .sort(([a], [b]) => suiteOrderIndex(a) - suiteOrderIndex(b))
    .map(([suite, items]) => ({ suite, items }));
}

/** Módulo → suites → CTs (preparado para vários módulos no mesmo canal). */
export function groupByModuleThenSuite<T extends Groupable>(list: T[]): ModuleGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const item of list) {
    const mod = moduleFromTestRecord(item);
    const bucket = map.get(mod);
    if (bucket) bucket.push(item);
    else map.set(mod, [item]);
  }

  return [...map.entries()]
    .sort(([a], [b]) => {
      const oa = moduleOrderIndex(a);
      const ob = moduleOrderIndex(b);
      if (oa !== ob) return oa - ob;
      return a.localeCompare(b, "pt-BR");
    })
    .map(([module, items]) => ({
      module,
      items,
      suites: groupBySuite(items),
    }));
}

export type SuiteStats = {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  runnable: number;
  /** Flows com readiness !== ready */
  draftCount: number;
  readyCount: number;
  /** passed/total · 0–100 */
  passRatePct: number;
  totalRuns: number;
  lastRunAt?: string;
  /** passou | falhou | misto | pendente */
  tone: "ok" | "fail" | "mixed" | "neutral";
};

function suiteTone(passed: number, failed: number, pending: number): SuiteStats["tone"] {
  if (failed > 0 && passed > 0) return "mixed";
  if (failed > 0) return "fail";
  if (passed > 0 && pending === 0) return "ok";
  return "neutral";
}

function bucketStatus(status?: HomologationStatus | string): "passed" | "failed" | "pending" {
  if (status === "passou" || status === "homologado") return "passed";
  if (status === "falhou") return "failed";
  return "pending";
}

/**
 * Resultado no escopo do runner — não compartilha status entre Maestro e Playwright.
 * Playwright usa só `playwright.lastRunStatus`; Maestro usa lastRunStatus + fallback de homologação.
 */
export function resultBucketForRunner(
  item: Pick<TestRecord, "homologationStatus" | "automation">,
  runner: AutomationRunner,
): "passed" | "failed" | "pending" {
  if (runner === "playwright") {
    const st = item.automation?.playwright?.lastRunStatus;
    if (st === "success") return "passed";
    if (st === "failed") return "failed";
    return "pending";
  }
  const st = item.automation?.lastRunStatus;
  if (st === "success") return "passed";
  if (st === "failed") return "failed";
  return bucketStatus(item.homologationStatus);
}

/** Estatísticas agregadas da suite (cabeçalho expandido ou recolhido), por runner. */
export function summarizeSuite(
  items: TestRecord[],
  runner: AutomationRunner = "maestro",
): SuiteStats {
  let passed = 0;
  let failed = 0;
  let pending = 0;
  let runnable = 0;
  let draftCount = 0;
  let readyCount = 0;
  let totalRuns = 0;
  let lastRunAt: string | undefined;
  let scoped = 0;

  for (const item of items) {
    const inScope =
      runner === "maestro"
        ? hasMaestroAutomation(item.automation)
        : hasPlaywrightAutomation(item.automation);
    if (!inScope) continue;

    scoped += 1;
    runnable += 1;

    const bucket = resultBucketForRunner(item, runner);
    if (bucket === "passed") passed += 1;
    else if (bucket === "failed") failed += 1;
    else pending += 1;

    if (runner === "maestro") {
      if (item.automation?.readiness === "ready") readyCount += 1;
      else draftCount += 1;
    } else if (item.automation?.playwright?.readiness === "ready") {
      readyCount += 1;
    } else {
      draftCount += 1;
    }

    totalRuns += countTestRunsForRunner(item.history ?? [], runner);

    const at =
      runner === "playwright"
        ? item.automation?.playwright?.lastRunAt
        : item.automation?.lastRunAt;
    if (at && (!lastRunAt || at > lastRunAt)) lastRunAt = at;
  }

  return {
    total: scoped,
    passed,
    failed,
    pending,
    runnable,
    draftCount,
    readyCount,
    passRatePct: scoped > 0 ? Math.round((passed / scoped) * 100) : 0,
    totalRuns,
    lastRunAt,
    tone: suiteTone(passed, failed, pending),
  };
}

/** Mesma agregação para itens do progresso da homologação. */
export function summarizeSuiteProgress(
  items: Array<{
    status: HomologationStatus;
    hasAutomation?: boolean;
    hasMaestro?: boolean;
    hasPlaywright?: boolean;
    readiness?: "draft" | "ready";
    playwrightReadiness?: "draft" | "ready";
    runsInHomologation?: number;
    lastRunAt?: string;
    playwrightLastRunAt?: string;
    playwrightLastRunStatus?: "idle" | "running" | "success" | "failed" | "cancelled";
    maestroLastRunStatus?: "idle" | "running" | "success" | "failed" | "cancelled";
  }>,
  runner: AutomationRunner = "maestro",
): SuiteStats {
  let passed = 0;
  let failed = 0;
  let pending = 0;
  let runnable = 0;
  let draftCount = 0;
  let readyCount = 0;
  let totalRuns = 0;
  let lastRunAt: string | undefined;
  let scoped = 0;

  for (const item of items) {
    const canRun =
      runner === "maestro"
        ? Boolean(item.hasMaestro ?? item.hasAutomation)
        : Boolean(item.hasPlaywright);
    if (!canRun) continue;

    scoped += 1;
    runnable += 1;

    let bucket: "passed" | "failed" | "pending";
    if (runner === "playwright") {
      const st = item.playwrightLastRunStatus;
      if (st === "success") bucket = "passed";
      else if (st === "failed") bucket = "failed";
      else bucket = "pending";
    } else {
      const st = item.maestroLastRunStatus;
      if (st === "success") bucket = "passed";
      else if (st === "failed") bucket = "failed";
      else bucket = bucketStatus(item.status);
    }

    if (bucket === "passed") passed += 1;
    else if (bucket === "failed") failed += 1;
    else pending += 1;

    const readiness =
      runner === "playwright" ? item.playwrightReadiness : item.readiness;
    if (readiness === "ready") readyCount += 1;
    else draftCount += 1;

    totalRuns += item.runsInHomologation ?? 0;

    const at =
      runner === "playwright" ? item.playwrightLastRunAt ?? item.lastRunAt : item.lastRunAt;
    if (at && (!lastRunAt || at > lastRunAt)) {
      lastRunAt = at;
    }
  }

  return {
    total: scoped,
    passed,
    failed,
    pending,
    runnable,
    draftCount,
    readyCount,
    passRatePct: scoped > 0 ? Math.round((passed / scoped) * 100) : 0,
    totalRuns,
    lastRunAt,
    tone: suiteTone(passed, failed, pending),
  };
}

/** Suites 100% verdes — chaves `Módulo::Suite` (para auto-recolher). */
export function allGreenSuiteKeys(moduleGroups: ModuleGroup<TestRecord>[]): string[] {
  const keys: string[] = [];
  for (const mod of moduleGroups) {
    for (const suite of mod.suites) {
      if (summarizeSuite(suite.items).tone === "ok") {
        keys.push(suiteCollapseKey(mod.module, suite.suite));
      }
    }
  }
  return keys;
}

/** Módulos 100% verdes (para auto-recolher). */
export function allGreenModuleKeys(moduleGroups: ModuleGroup<TestRecord>[]): string[] {
  return moduleGroups
    .filter((g) => summarizeSuite(g.items).tone === "ok")
    .map((g) => g.module);
}
