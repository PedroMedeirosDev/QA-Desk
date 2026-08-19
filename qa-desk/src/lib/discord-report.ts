import type { TestRecord } from "../types/test-record";
import { SEVERITY_LABELS } from "../types/test-record";
import { maskPii } from "./redact-pii";
import { formatAmbienteBlock } from "./bug-report-markdown";

export interface DiscordReportOptions {
  /** Substitui "Console:" no padrão web — logs, JSON, stack */
  technicalEvidence?: string;
  osVersion?: string;
  deviceLabel?: string;
  browser?: string;
  testLogin?: string;
}

function formatSteps(steps: string[]): string {
  const cleaned = steps.map((s) => s.trim()).filter(Boolean);
  if (!cleaned.length) return "_(nenhum passo)_";
  return cleaned
    .map((step, i) => {
      const normalized = step.replace(/^\d+\s*[-.)]\s*/, "");
      return `${i + 1} - ${normalized}`;
    })
    .join("\n");
}

function platformLabel(platform: TestRecord["platform"]): string {
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
    default:
      return platform ?? "—";
  }
}

function loginLine(record: Partial<TestRecord>, opts: DiscordReportOptions): string | null {
  const login = opts.testLogin?.trim() || record.testLogin?.trim();
  if (!login) return null;
  return `**Login:** ${login}`;
}

function ambienteMobile(record: Partial<TestRecord>, opts: DiscordReportOptions): string {
  const lines: string[] = [];
  lines.push(`**Versão:** ${record.build?.trim() || "(informar build / CQ)"}`);
  const so = [platformLabel(record.platform ?? "android"), opts.osVersion?.trim()]
    .filter(Boolean)
    .join(" — ");
  lines.push(`**SO:** ${so}`);
  lines.push(`**Dispositivo:** ${opts.deviceLabel?.trim() || "emulador"}`);
  const login = loginLine(record, opts);
  if (login) lines.push(login);
  return lines.join("\n");
}

function ambienteWeb(record: Partial<TestRecord>, opts: DiscordReportOptions): string {
  const lines: string[] = [];
  if (record.build?.trim()) {
    lines.push(`**Versão:** ${record.build.trim()}`);
  }
  lines.push(
    `**Navegador:** ${opts.browser?.trim() || record.browser?.trim() || "(informar navegador)"}`,
  );
  const login = loginLine(record, opts);
  if (login) lines.push(login);
  return lines.join("\n");
}

function ambienteAppAndWeb(record: Partial<TestRecord>, opts: DiscordReportOptions): string {
  return formatAmbienteBlock({
    ...record,
    osVersion: opts.osVersion ?? record.osVersion,
    deviceLabel: opts.deviceLabel ?? record.deviceLabel,
    browser: opts.browser ?? record.browser,
    testLogin: opts.testLogin ?? record.testLogin,
  });
}

function isMobileReport(record: Partial<TestRecord>): boolean {
  return (
    record.platform === "android" ||
    record.platform === "ios" ||
    record.platform === "app_web" ||
    record.channel === "app"
  );
}

function isWebReport(record: Partial<TestRecord>): boolean {
  return (
    record.platform === "web" ||
    record.platform === "app_web" ||
    record.channel === "web"
  );
}

/**
 * Formato enxuto para Discord (markdown nativo: **negrito**, _itálico_).
 */
export function formatDiscordReport(
  record: Partial<TestRecord>,
  opts: DiscordReportOptions = {},
): string {
  const code = record.bugCode?.trim();
  const title = record.title?.trim() || "(sem título)";
  const titleLine = code ? `**[${code}] ${title}**` : `**${title}**`;
  const steps = formatSteps(record.steps ?? []);
  /** `description` = citação do chamado (bugs); não usar como resultado atual */
  const actual = record.actualResult?.trim() || "(descrever)";
  const expected = record.expectedResult?.trim() || "(descrever)";
  const ticketCitation = record.description?.trim() || "";
  const evidence =
    opts.technicalEvidence?.trim() ||
    record.technicalEvidence?.trim() ||
    "";

  const envOpts: DiscordReportOptions = {
    osVersion: opts.osVersion ?? record.osVersion,
    deviceLabel: opts.deviceLabel ?? record.deviceLabel,
    browser: opts.browser ?? record.browser,
    testLogin: opts.testLogin ?? record.testLogin,
    technicalEvidence: evidence,
  };

  const blocks = [
    titleLine,
    `**Gravidade:** ${
      record.severity
        ? SEVERITY_LABELS[record.severity]
        : "(informar)"
    }`,
    ...(ticketCitation ? ["", `**Chamado:** ${ticketCitation}`] : []),
    "",
    "**Passo a passo:**",
    "",
    steps,
    "",
    `**Resultado atual:** ${actual}`,
  ];

  if (record.platform === "app_web") {
    blocks.push("", "**Ambiente (App e APP WEB):**", ambienteAppAndWeb(record, envOpts));
    if (evidence) {
      blocks.push("", `**Evidência técnica:** ${evidence}`);
    }
  } else if (isMobileReport(record)) {
    blocks.push("", "**Ambiente mobile:**", ambienteMobile(record, envOpts));
    if (evidence) {
      blocks.push("", `**Evidência técnica:** ${evidence}`);
    }
  } else if (isWebReport(record)) {
    blocks.push("", "**Ambiente web:**", ambienteWeb(record, envOpts));
    if (evidence) {
      blocks.push("", `**Console:** ${evidence}`);
    }
  } else {
    const login = loginLine(record, envOpts);
    if (login) blocks.push("", login);
    if (evidence) blocks.push("", `**Console:** ${evidence}`);
  }

  blocks.push("", `**Resultado esperado:** ${expected}`);

  return maskPii(blocks.join("\n"));
}

export async function copyDiscordReport(text: string): Promise<boolean> {
  try {
    const nav = globalThis as typeof globalThis & {
      navigator?: { clipboard?: { writeText: (value: string) => Promise<void> } };
    };
    const clip = nav.navigator?.clipboard;
    if (!clip?.writeText) return false;
    await clip.writeText(text);
    return true;
  } catch {
    return false;
  }
}
