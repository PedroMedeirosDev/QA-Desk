/**
 * Markdown estruturado do bug — handoff GitHub Issue (humano + agente).
 */
import type { TestRecord } from "../types/test-record";
import { SEVERITY_LABELS } from "../types/test-record";
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
    case "api":
      return "API";
    case "outro":
      return "Outro";
    default:
      return platform ?? "—";
  }
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
  const title = record.title?.trim() || "(sem título)";
  const channel = record.channel?.trim() || "—";
  const platform = platformLabel(record.platform);
  const build = record.build?.trim() || "—";
  const login = record.testLogin?.trim() || "—";
  const severity = record.severity
    ? SEVERITY_LABELS[record.severity]
    : "—";
  const steps = formatSteps(record.steps ?? []);
  const expected = record.expectedResult?.trim() || "—";
  const actual = record.actualResult?.trim() || "—";
  const ticket = record.description?.trim() || "";
  const tech = record.technicalEvidence?.trim() || "";
  const evidenceNames = (record.evidence ?? [])
    .map((e) => e.filename?.trim())
    .filter(Boolean);

  const envLines: string[] = [
    `- **Canal:** ${channel}`,
    `- **Plataforma:** ${platform}`,
    `- **Build / versão:** ${build}`,
  ];
  if (record.browser?.trim()) {
    envLines.push(`- **Navegador:** ${record.browser.trim()}`);
  }
  if (record.osVersion?.trim() || record.deviceLabel?.trim()) {
    envLines.push(
      `- **SO / dispositivo:** ${[record.osVersion, record.deviceLabel].filter(Boolean).join(" · ") || "—"}`,
    );
  }

  const evidenceBlock =
    opts?.evidenceMarkdown?.trim() ||
    (evidenceNames.length > 0
      ? evidenceNames.map((n) => `- \`${n}\``).join("\n")
      : "_(nenhuma evidência)_");

  const sections = [
    `## Resumo`,
    title,
    ``,
    `## Código`,
    `- **Público:** \`${code}\``,
    `- **Interno:** \`${internalId}\``,
    ``,
    `## Ambiente`,
    ...envLines,
    `- **Login:** ${login}`,
    ``,
    `## Gravidade`,
    severity,
    ``,
    ...(ticket ? [`## Chamado`, ticket, ``] : []),
    `## Passos`,
    steps,
    ``,
    `## Resultado atual`,
    actual,
    ``,
    `## Resultado esperado`,
    expected,
    ``,
    ...(tech ? [`## Evidência técnica`, tech, ``] : []),
    `## Evidências`,
    evidenceBlock,
  ];

  return maskPii(sections.join("\n").trimEnd() + "\n");
}
