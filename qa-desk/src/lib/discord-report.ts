import type { TestRecord } from "@/types/test-record";
import { maskPii } from "@/lib/redact-pii";

export interface DiscordReportOptions {
  /** Substitui "Console:" no padrão web — logs, JSON, stack */
  technicalEvidence?: string;
  osVersion?: string;
  deviceLabel?: string;
}

function formatSteps(steps: string[]): string {
  const cleaned = steps.map((s) => s.trim()).filter(Boolean);
  if (!cleaned.length) return "(nenhum passo)";
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
    case "api":
      return "API";
    default:
      return platform ?? "—";
  }
}

function ambienteMobile(record: Partial<TestRecord>, opts: DiscordReportOptions): string {
  const lines: string[] = [];
  lines.push(`Versão: ${record.build?.trim() || "(informar build / CQ)"}`);
  const so = [platformLabel(record.platform ?? "android"), opts.osVersion?.trim()]
    .filter(Boolean)
    .join(" — ");
  lines.push(`SO: ${so}`);
  lines.push(`Dispositivo: ${opts.deviceLabel?.trim() || "emulador"}`);
  return lines.join("\n");
}

/**
 * Formato enxuto aprovado pelo gestor (Discord).
 */
export function formatDiscordReport(
  record: Partial<TestRecord>,
  opts: DiscordReportOptions = {},
): string {
  const title = record.title?.trim() || "(sem título)";
  const steps = formatSteps(record.steps ?? []);
  const actual = record.actualResult?.trim() || record.description?.trim() || "(descrever)";
  const expected = record.expectedResult?.trim() || "(descrever)";
  const evidence =
    opts.technicalEvidence?.trim() ||
    record.technicalEvidence?.trim() ||
    "";

  const mobileOpts: DiscordReportOptions = {
    osVersion: opts.osVersion ?? record.osVersion,
    deviceLabel: opts.deviceLabel ?? record.deviceLabel,
    technicalEvidence: evidence,
  };

  const blocks = [
    title,
    "",
    "Passo a passo:",
    "",
    steps,
    "",
    `resultado atual: ${actual}`,
  ];

  if (record.platform === "android" || record.platform === "ios" || record.channel === "app") {
    blocks.push("", "Ambiente mobile:", ambienteMobile(record, mobileOpts));
    if (evidence) {
      blocks.push("", `Evidência técnica: ${evidence}`);
    }
  } else if (evidence) {
    blocks.push("", `Console: ${evidence}`);
  }

  blocks.push("", `resultado esperado: ${expected}`);

  return maskPii(blocks.join("\n"));
}

export async function copyDiscordReport(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
