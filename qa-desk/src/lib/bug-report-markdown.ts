/**
 * Markdown estruturado do bug — handoff GitHub Issue (humano + agente).
 *
 * Ordem (scan do gestor/dev):
 *   Sintoma → Gravidade/meta → Evidências → Passos → Atual/Esperado → Notas → Referências
 */
import type { TestRecord } from "../types/test-record";
import { CHANNEL_LABELS, SEVERITY_LABELS } from "../types/test-record";
import { maskPii } from "./redact-pii";

function formatSteps(steps: string[]): string {
  const cleaned = steps.map((s) => s.trim()).filter(Boolean);
  if (!cleaned.length) return "_(nenhum passo)_";
  return cleaned
    .map((step, i) => {
      const normalized = step.replace(/^\d+\s*[-.)]\s*/, "");
      return `${i + 1}. ${normalized}`;
    })
    .join("\n");
}

function platformLabel(platform: TestRecord["platform"] | undefined): string {
  switch (platform) {
    case "android":
      return "Android";
    case "ios":
      return "iOS";
    case "web":
      return "Web";
    case "app_web":
      return "App nativo e APP WEB";
    case "api":
      return "API";
    case "outro":
      return "Outro";
    default:
      return platform ?? "—";
  }
}

function channelLabel(channel: TestRecord["channel"] | undefined): string {
  if (!channel) return "—";
  return CHANNEL_LABELS[channel] ?? channel;
}

/**
 * Uma peça só para “onde rodou” — evita `App · Web` (lê como dois produtos).
 * APP-nn fica no título / Referências, não aqui.
 */
export function formatWherePlayed(record: Partial<TestRecord>): string | null {
  const ch = record.channel;
  const pl = record.platform;
  if (ch === "app" && pl === "web") return "APP versão WEB";
  if (pl === "app_web") return "App nativo e APP versão WEB";
  if (ch === "app" && (pl === "android" || pl === "ios")) {
    return `App · ${platformLabel(pl)}`;
  }
  if (ch === "web") {
    if (!pl || pl === "web") return "WEB";
    return `WEB · ${platformLabel(pl)}`;
  }
  if (ch === "portal") return "PORTAL";
  if (pl && pl !== "web") return platformLabel(pl);
  if (ch) return channelLabel(ch);
  return null;
}

export type AmbienteField = { label: string; value: string };

export type AmbienteView = {
  dual: boolean;
  headline: string | null;
  surfaces: string[];
  fields: AmbienteField[];
};

function trimField(label: string, value: string | undefined): AmbienteField | null {
  const v = value?.trim();
  if (!v) return null;
  return { label, value: v };
}

function loginForDeskView(loginRaw?: string): string | undefined {
  const raw = loginRaw?.trim();
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, "");
  const compact = raw.replace(/[.\-\s]/g, "");
  if (digits.length === 11 && compact === digits && !/^(\d)\1{10}$/.test(digits)) {
    return "CPF";
  }
  return maskPii(raw);
}

/** Fonte única: Desk (chips) e Markdown da issue. */
export function ambienteView(record: Partial<TestRecord>): AmbienteView {
  const pl = record.platform;
  const login = loginForDeskView(record.testLogin);
  const browser = record.browser?.trim();
  const device = [record.osVersion?.trim(), record.deviceLabel?.trim()]
    .filter(Boolean)
    .join(" · ");
  const build = record.build?.trim();
  const envLabel =
    record.runtimeEnv === "producao"
      ? "Produção"
      : record.runtimeEnv === "amostra"
        ? "Amostra"
        : undefined;
  const unit = record.unitLabel?.trim();

  if (pl === "app_web") {
    return {
      dual: true,
      headline: "Reproduz nos dois",
      surfaces: ["App nativo", "APP versão WEB"],
      fields: [
        trimField("Ambiente", envLabel),
        trimField("Unidade", unit),
        trimField("Login", login),
        trimField("APP versão WEB", browser),
        trimField("App nativo", device),
        trimField("Versão", build),
      ].filter((f): f is AmbienteField => Boolean(f)),
    };
  }

  const where = formatWherePlayed(record);
  return {
    dual: false,
    headline: where,
    surfaces: where ? [where] : [],
    fields: [
      trimField("Ambiente", envLabel),
      trimField("Unidade", unit),
      trimField("Login", login),
      trimField("Navegador", browser),
      trimField("Dispositivo", device),
      trimField("Versão", build),
    ].filter((f): f is AmbienteField => Boolean(f)),
  };
}

/** Lista Markdown — o GitHub não engole tudo numa linha. */
export function formatAmbienteBlock(record: Partial<TestRecord>): string {
  const view = ambienteView(record);
  const lines: string[] = [];

  if (view.dual) {
    lines.push("Reproduz **nos dois**:");
    lines.push("");
    lines.push("- **App nativo** (Android / emulador)");
    lines.push("- **APP versão WEB** (browser, Flutter Web)");
    lines.push("");
  } else if (view.headline) {
    lines.push(`- **Onde:** ${view.headline}`);
  }

  for (const field of view.fields) {
    lines.push(`- **${field.label}:** ${field.value}`);
  }

  return lines.join("\n").trim() || "—";
}

/** Compacto (toast / uma linha). Não junta canal + plataforma (`App · APP + WEB`). */
export function formatAmbienteLine(record: Partial<TestRecord>): string {
  const view = ambienteView(record);
  const bits: string[] = [];
  if (view.dual) bits.push("**Onde:** App nativo e APP versão WEB");
  else if (view.headline) bits.push(`**Onde:** ${view.headline}`);
  for (const field of view.fields) bits.push(`**${field.label}:** ${field.value}`);
  return bits.join(" · ") || "—";
}

/** Título da issue: `[APP-01] Sintoma` */
export function formatBugIssueTitle(record: Partial<TestRecord>): string {
  const code = record.bugCode?.trim();
  const title = record.title?.trim() || "(sem título)";
  const raw = code ? `[${code}] ${title}` : title;
  return raw.slice(0, 240);
}

export type BugReportMarkdownOptions = {
  /** Bloco já montado (imagens/links). Se omitido, lista só nomes. */
  evidenceMarkdown?: string;
};

/**
 * Body Markdown com headings estáveis (bom para agente + gestor).
 */
export function formatBugReportMarkdown(
  record: Partial<TestRecord>,
  opts?: BugReportMarkdownOptions,
): string {
  const code = record.bugCode?.trim() || "—";
  const internalId = record.id?.trim() || "—";
  const severity = record.severity
    ? SEVERITY_LABELS[record.severity]
    : "—";
  const steps = formatSteps(record.steps ?? []);
  const expected = record.expectedResult?.trim() || "—";
  const actual = record.actualResult?.trim() || "—";
  const symptom = record.description?.trim() || "";
  const tech = record.technicalEvidence?.trim() || "";
  const evidenceNames = (record.evidence ?? [])
    .map((e) => e.filename?.trim())
    .filter(Boolean);

  const evidenceBlock =
    opts?.evidenceMarkdown?.trim() ||
    (evidenceNames.length > 0
      ? evidenceNames.map((n) => `- \`${n}\``).join("\n")
      : "_(nenhuma evidência)_");

  const sections: string[] = [];

  // 1) Sintoma — narrativa do defeito (não repetir o título da issue)
  if (symptom) {
    sections.push(`## Sintoma`, symptom, ``);
  }

  // 2) Gravidade + meta compacta
  sections.push(
    `## Gravidade`,
    severity,
    ``,
    `## Ambiente`,
    formatAmbienteBlock(record),
    ``,
  );

  // 3) Evidências cedo (UI / gesto)
  sections.push(`## Evidências`, evidenceBlock, ``);

  // 4) Reprodução
  sections.push(`## Passos`, steps, ``);

  // 5) Atual → esperado
  sections.push(
    `## Resultado atual`,
    actual,
    ``,
    `## Resultado esperado`,
    expected,
    ``,
  );

  // 6) Notas técnicas (opcional)
  if (tech) {
    sections.push(`## Notas técnicas`, tech, ``);
  }

  // 7) Referências no rodapé
  sections.push(
    `## Referências`,
    `- **Público:** \`${code}\``,
    `- **Interno:** \`${internalId}\``,
  );

  return maskPii(sections.join("\n").trimEnd() + "\n");
}

function formatAmbientePlain(record: Partial<TestRecord>): string {
  const view = ambienteView(record);
  const lines: string[] = [];

  if (view.dual) {
    lines.push("Onde: App nativo e APP versao WEB (reproduz nos dois)");
  } else if (view.headline) {
    lines.push(`Onde: ${view.headline}`);
  }

  for (const field of view.fields) {
    lines.push(`${field.label}: ${field.value}`);
  }

  return lines.join("\n").trim() || "-";
}

function formatStepsPlain(steps: string[]): string {
  const cleaned = steps.map((s) => s.trim()).filter(Boolean);
  if (!cleaned.length) return "(nenhum passo)";
  return cleaned
    .map((step, i) => {
      const normalized = step.replace(/^\d+\s*[-.)]\s*/, "");
      return `${i + 1}. ${normalized}`;
    })
    .join("\n");
}

/**
 * Sistema de chamados Polygonus (e cola em apps legados) costuma tratar o texto
 * como Windows-1252. Aspas curvas / tracos tipograficos em UTF-8 viram `â□□`.
 * Mantem acentos latinos (ok no 1252); so achata pontuacao "bonita".
 */
export function sanitizeForChamado(text: string): string {
  return text
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u00AB\u00BB]/g, '"') // “ ” „ ‟ ″ « »
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'") // ‘ ’ ‚ ‛ ′
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, "-") // hifens / travessoes
    .replace(/\u2026/g, "...") // …
    .replace(/\u2192/g, "->")
    .replace(/\u2190/g, "<-")
    .replace(/\u00A0/g, " ") // NBSP
    .replace(/\u2022/g, "-") // •
    .replace(/\u00B7/g, "-") // ·
    .replace(/\uFFFD/g, ""); // replacement char ja quebrado
}

/**
 * Texto puro para colar no chamado interno Polygonus (sem Markdown).
 * Inclui titulo + corpo separados - copiar o bloco inteiro e usar cada secao
 * no campo correspondente do sistema de chamados.
 */
export function formatChamadoPolygonus(record: Partial<TestRecord>): string {
  const code = record.bugCode?.trim();
  const title = record.title?.trim() || "(sem titulo)";
  const titleLine = code ? `[${code}] ${title}` : title;
  const severity = record.severity
    ? SEVERITY_LABELS[record.severity]
    : "(informar)";
  /** Em bugs do Desk, `description` = citacao/id do chamado Polygonus. */
  const ticketCitation = record.description?.trim() || "";
  const preconditions = record.preconditions?.trim() || "";
  const steps = formatStepsPlain(record.steps ?? []);
  const actual = record.actualResult?.trim() || "(descrever)";
  const expected = record.expectedResult?.trim() || "(descrever)";
  const tech = record.technicalEvidence?.trim() || "";
  const evidenceNames = (record.evidence ?? [])
    .map((e) => e.filename?.trim())
    .filter(Boolean);
  const internalId = record.id?.trim();

  const parts: string[] = [
    "=== TITULO (cole no campo titulo do chamado) ===",
    titleLine,
    "",
    "=== DESCRICAO (cole no corpo / observacao) ===",
    "",
  ];

  if (ticketCitation) {
    parts.push("Referencia ao chamado:", ticketCitation, "");
  }

  parts.push(`Gravidade: ${severity}`, "");

  if (preconditions) {
    parts.push("Pre-condicoes:", preconditions, "");
  }

  parts.push(
    "Passo a passo:",
    steps,
    "",
    "Resultado atual:",
    actual,
    "",
    "Resultado esperado:",
    expected,
    "",
    "Ambiente:",
    formatAmbientePlain(record),
    "",
  );

  if (evidenceNames.length > 0) {
    parts.push(
      "Evidencias (anexar no chamado):",
      ...evidenceNames.map((n) => `- ${n}`),
      "",
    );
  }

  if (tech) {
    parts.push("Notas tecnicas:", tech, "");
  }

  const refs = [
    code ? `Codigo QA Desk: ${code}` : null,
    internalId ? `Id interno: ${internalId}` : null,
  ].filter(Boolean);
  if (refs.length) {
    parts.push("Referencias:", ...refs.map((r) => `- ${r}`));
  }

  return sanitizeForChamado(maskPii(parts.join("\n").trimEnd() + "\n"));
}
