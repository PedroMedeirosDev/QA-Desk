import {
  HOMOLOGATION_LABELS,
  type HomologationStatus,
  type TestRecord,
} from "@/types/test-record";
import { countTestRunsForRunner } from "@/lib/history";
import {
  hasMaestroAutomation,
  hasPlaywrightAutomation,
  type AutomationRunner,
} from "@/lib/automation-runners";

/**
 * Hierarquia na UI:
 *   área (Mural | Atendimento | …)
 *     → aba/módulo (Comunicados | Rotina | Diário | …)
 *       → suite (CRUD | Anexos | …)
 *         → CT
 *
 * Produto: Mural = tela com abas Comunicados, Rotina, Diário (pais/alunos).
 * No app a aba de comunicados ainda pode aparecer como texto "Mural";
 * no Desk o módulo canônico é Comunicados.
 */

/** Ordem canônica das abas/módulos (desconhecidos vão ao final, alfabético). */
export const MODULE_ORDER = [
  "Comunicados",
  "Rotina",
  "Diario",
  "Atendimento",
  "Calendario",
  "Notas",
  "ConteudoFrequencia",
  "Tarefas",
  "Ocorrencias",
  "MeusAlunos",
  "Cardapio",
  "Boletim",
  "NotasParciais",
  "Mensalidade",
  "ConteudoLecionado",
  "FrequenciaAluno",
  "MeusDocumentos",
  "Horario",
  "TarefasCasa",
  "AvaliacaoConhecimento",
  "AvaliacaoHabilidades",
  "NotasFiscais",
] as const;

export const MODULE_LABELS: Record<string, string> = {
  Comunicados: "Comunicados",
  Rotina: "Rotina",
  Diario: "Diário (pais/alunos)",
  Atendimento: "Atendimento (novo)",
  Calendario: "Calendário",
  Notas: "Notas",
  ConteudoFrequencia: "Conteúdo e Frequência",
  Tarefas: "Tarefas",
  Ocorrencias: "Ocorrências",
  MeusAlunos: "Meus Alunos",
  Cardapio: "Cardápio",
  Boletim: "Boletim Online",
  NotasParciais: "Notas Parciais",
  Mensalidade: "Mensalidade",
  ConteudoLecionado: "Conteúdo Lecionado",
  FrequenciaAluno: "Frequência do Aluno",
  MeusDocumentos: "Meus Documentos",
  Horario: "Horário",
  TarefasCasa: "Tarefas para Casa",
  AvaliacaoConhecimento: "Avaliação do Conhecimento",
  AvaliacaoHabilidades: "Avaliação de Habilidades",
  NotasFiscais: "Notas Fiscais",
  /** Legacy — normalizado para Comunicados via alias */
  Mural: "Comunicados",
  Outros: "Outros",
};

const MODULE_ALIASES: Record<string, string> = {
  mural: "Comunicados",
  comunicados: "Comunicados",
  comunicado: "Comunicados",
  atendimento: "Atendimento",
  "fale-conosco": "Atendimento",
  faleconosco: "Atendimento",
  chat: "Atendimento",
  rotina: "Rotina",
  diario: "Diario",
  "diário": "Diario",
  calendario: "Calendario",
  "calendário": "Calendario",
  notas: "Notas",
  "cq-notas": "Notas",
  "cq-conteudo": "ConteudoFrequencia",
  "cq-freq": "ConteudoFrequencia",
  "conteudo-frequencia": "ConteudoFrequencia",
  "conteúdo-e-frequência": "ConteudoFrequencia",
  tarefas: "Tarefas",
  ocorrencias: "Ocorrencias",
  "ocorrências": "Ocorrencias",
  "meus-alunos": "MeusAlunos",
  cardapio: "Cardapio",
  "cardápio": "Cardapio",
  boletim: "Boletim",
  "notas-parciais": "NotasParciais",
  mensalidade: "Mensalidade",
  "conteudo-lecionado": "ConteudoLecionado",
  "frequencia-aluno": "FrequenciaAluno",
  "meus-documentos": "MeusDocumentos",
  horario: "Horario",
  "horário": "Horario",
  "tarefas-casa": "TarefasCasa",
  "avaliacao-conhecimento": "AvaliacaoConhecimento",
  "avaliacao-habilidades": "AvaliacaoHabilidades",
  "notas-fiscais": "NotasFiscais",
};

/** Área de produto que agrupa abas (ex.: Mural → Comunicados/Rotina/Diário). */
export const AREA_ORDER = [
  "Mural",
  "Atendimento",
  "Calendario",
  "Notas",
  "ConteudoFrequencia",
  "Tarefas",
  "Ocorrencias",
  "MeusAlunos",
  "Cardapio",
  "Boletim",
  "NotasParciais",
  "Mensalidade",
  "ConteudoLecionado",
  "FrequenciaAluno",
  "MeusDocumentos",
  "Horario",
  "TarefasCasa",
  "AvaliacaoConhecimento",
  "AvaliacaoHabilidades",
  "NotasFiscais",
] as const;

export const AREA_LABELS: Record<string, string> = {
  Mural: "Mural",
  Atendimento: "Atendimento",
  Calendario: "Calendário",
  Notas: "Notas",
  ConteudoFrequencia: "Conteúdo e Frequência",
  Tarefas: "Tarefas",
  Ocorrencias: "Ocorrências",
  MeusAlunos: "Meus Alunos",
  Cardapio: "Cardápio",
  Boletim: "Boletim Online",
  NotasParciais: "Notas Parciais",
  Mensalidade: "Mensalidade",
  ConteudoLecionado: "Conteúdo Lecionado",
  FrequenciaAluno: "Frequência do Aluno",
  MeusDocumentos: "Meus Documentos",
  Horario: "Horário",
  TarefasCasa: "Tarefas para Casa",
  AvaliacaoConhecimento: "Avaliação do Conhecimento",
  AvaliacaoHabilidades: "Avaliação de Habilidades",
  NotasFiscais: "Notas Fiscais",
  Outros: "Outros",
};

/** Aba/módulo → área. Módulos fora do mapa viram área = próprio nome. */
export const AREA_BY_MODULE: Record<string, string> = {
  Comunicados: "Mural",
  Rotina: "Mural",
  Diario: "Mural",
  /** Legacy pré-migração */
  Mural: "Mural",
  Atendimento: "Atendimento",
  Calendario: "Calendario",
  Notas: "Notas",
  ConteudoFrequencia: "ConteudoFrequencia",
  Tarefas: "Tarefas",
  Ocorrencias: "Ocorrencias",
  MeusAlunos: "MeusAlunos",
  Cardapio: "Cardapio",
  Boletim: "Boletim",
  NotasParciais: "NotasParciais",
  Mensalidade: "Mensalidade",
  ConteudoLecionado: "ConteudoLecionado",
  FrequenciaAluno: "FrequenciaAluno",
  MeusDocumentos: "MeusDocumentos",
  Horario: "Horario",
  TarefasCasa: "TarefasCasa",
  AvaliacaoConhecimento: "AvaliacaoConhecimento",
  AvaliacaoHabilidades: "AvaliacaoHabilidades",
  NotasFiscais: "NotasFiscais",
};

export function areaFromModule(module: string): string {
  return AREA_BY_MODULE[module] ?? module;
}

export function areaOrderIndex(area: string): number {
  const i = AREA_ORDER.indexOf(area as (typeof AREA_ORDER)[number]);
  return i >= 0 ? i : AREA_ORDER.length;
}

export function areaCollapseKey(area: string): string {
  return `a:${area}`;
}

/** Ordem canônica das suites na UI. */
export const SUITE_ORDER = [
  "Smoke",
  "CRUD",
  "Enquete",
  "Anexos",
  "Boleto",
  "Correspondencia",
  "Eventos",
  "Lista",
  "Filtros",
  "Texto",
  "Audio",
  "Video",
  "Pdf",
  "Alimentacao",
  "Soneca",
  "Banheiro",
  "Bilhete",
  "E2E",
] as const;

export type KnownSuite = (typeof SUITE_ORDER)[number];

export const SUITE_LABELS: Record<string, string> = {
  Smoke: "Smoke",
  CRUD: "CRUD",
  Enquete: "Enquete",
  Anexos: "Anexos",
  Boleto: "Boleto",
  Correspondencia: "Correspondência",
  Eventos: "Eventos",
  Lista: "Lista",
  Filtros: "Filtros especiais",
  Texto: "Texto",
  Audio: "Áudio",
  Video: "Vídeo",
  Pdf: "PDF",
  Alimentacao: "Alimentação",
  Soneca: "Soneca",
  Banheiro: "Banheiro",
  Bilhete: "Bilhete",
  E2E: "E2E",
  Outros: "Outros",
};

const SUITE_FROM_PREFIX: Record<string, string> = {
  smoke: "Smoke",
  crud: "CRUD",
  enquete: "Enquete",
  anexo: "Anexos",
  boleto: "Boleto",
  corresp: "Correspondencia",
  evento: "Eventos",
  lista: "Lista",
  filtro: "Filtros",
  texto: "Texto",
  audio: "Audio",
  video: "Video",
  pdf: "Pdf",
  alimentacao: "Alimentacao",
  soneca: "Soneca",
  banheiro: "Banheiro",
  bilhete: "Bilhete",
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
  if (/chat_?audio|atendimento_?audio|\baudio\b/.test(s)) return "Audio";
  if (/chat_?video|atendimento_?video|\bvideo\b/.test(s)) return "Video";
  if (/chat_?pdf|atendimento_?pdf|\bpdf\b/.test(s)) return "Pdf";
  if (/chat_?texto|atendimento_?texto/.test(s)) return "Texto";
  if (/alimentacao|alimentação/.test(s)) return "Alimentacao";
  if (/soneca/.test(s)) return "Soneca";
  if (/banheiro/.test(s)) return "Banheiro";
  if (/bilhete/.test(s)) return "Bilhete";
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

export type AreaGroup<T> = {
  area: string;
  items: T[];
  modules: ModuleGroup<T>[];
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

/** Aba/módulo → suites → CTs. */
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

/** Área → aba/módulo → suites → CTs. */
export function groupByAreaThenModuleThenSuite<T extends Groupable>(
  list: T[],
): AreaGroup<T>[] {
  const moduleGroups = groupByModuleThenSuite(list);
  const map = new Map<string, ModuleGroup<T>[]>();
  for (const mod of moduleGroups) {
    const area = areaFromModule(mod.module);
    const bucket = map.get(area);
    if (bucket) bucket.push(mod);
    else map.set(area, [mod]);
  }

  return [...map.entries()]
    .sort(([a], [b]) => {
      const oa = areaOrderIndex(a);
      const ob = areaOrderIndex(b);
      if (oa !== ob) return oa - ob;
      return a.localeCompare(b, "pt-BR");
    })
    .map(([area, modules]) => ({
      area,
      modules,
      items: modules.flatMap((m) => m.items),
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
 * Resultado no escopo do runner.
 * Usa lastRun do runner ativo quando houver success/failed; senão cai no
 * status de homologação (manual / sem run desse executor).
 * Não mistura lastRun do Maestro na visão Playwright e vice-versa.
 */
export function resultBucketForRunner(
  item: Pick<TestRecord, "homologationStatus" | "automation">,
  runner: AutomationRunner,
): "passed" | "failed" | "pending" {
  const st =
    runner === "playwright"
      ? item.automation?.playwright?.lastRunStatus
      : item.automation?.lastRunStatus;
  if (st === "success") return "passed";
  if (st === "failed") return "failed";
  return bucketStatus(item.homologationStatus);
}

/** Badge da coluna Resultado na homologação (progress item). */
export function homologationResultDisplay(
  item: {
    status: HomologationStatus;
    maestroLastRunStatus?: "idle" | "running" | "success" | "failed" | "cancelled";
    playwrightLastRunStatus?: "idle" | "running" | "success" | "failed" | "cancelled";
  },
  runner: AutomationRunner,
): { status: HomologationStatus; label: string } {
  const st =
    runner === "playwright"
      ? item.playwrightLastRunStatus
      : item.maestroLastRunStatus;
  if (st === "success") return { status: "passou", label: "Passou" };
  if (st === "failed") return { status: "falhou", label: "Falhou" };
  return {
    status: item.status,
    label: HOMOLOGATION_LABELS[item.status] ?? "Pendente",
  };
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
      else bucket = bucketStatus(item.status);
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

/** Áreas 100% verdes (para auto-recolher). */
export function allGreenAreaKeys(areaGroups: AreaGroup<TestRecord>[]): string[] {
  return areaGroups
    .filter((g) => summarizeSuite(g.items).tone === "ok")
    .map((g) => g.area);
}
