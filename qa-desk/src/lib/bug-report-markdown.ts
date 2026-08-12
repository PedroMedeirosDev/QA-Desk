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
      return "APP + WEB";
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
  const channel = channelLabel(record.channel);
  const platform = platformLabel(record.platform);
  const build = record.build?.trim() || "—";
  const login = record.testLogin?.trim() || "—";
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

  // Evita "WEB · Web"; em App mostra Android/iOS
  const redundantWeb = record.channel === "web" && record.platform === "web";
  const platformBit =
    platform !== "—" && !redundantWeb ? platform : null;

  const metaBits = [
    code !== "—" ? `\`${code}\`` : null,
    channel !== "—" ? channel : null,
    platformBit,
    build !== "—" ? `build ${build}` : null,
    record.browser?.trim() ? record.browser.trim() : null,
    [record.osVersion, record.deviceLabel].filter(Boolean).join(" · ") || null,
    login !== "—" ? `login ${login}` : null,
  ].filter(Boolean);

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
    metaBits.length ? metaBits.join(" · ") : "—",
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
