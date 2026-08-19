import { execFileSync } from "node:child_process";
import { normalizeMaestroOutput } from "./maestro-output.js";
import {
  detailedStepsFromRecord,
  matchDetailedStepTrace,
  type DetailedStep,
} from "./detailed-steps.js";

const DEFAULT_APP_ID = "br.com.polygonus.mobile.amostra";

export interface MaestroFailureInfo {
  /** Ex.: Tap on "Comunicado" */
  failedAction?: string;
  /** Ex.: abrir_novo_comunicado.yaml */
  failedFlow?: string;
  /** Ex.: Element not found: ... */
  errorSummary?: string;
  /** Índice em stepsDetailed (ou steps se não houver detalhado/âncora) */
  failedStepIndex?: number;
  /** Texto do passo humano correspondente */
  failedStepLabel?: string;
  /** Qual lista foi usada no match */
  failedStepSource?: "steps" | "stepsDetailed";
}

export interface MaestroRunDiagnostics {
  appVersion?: string;
  failure?: MaestroFailureInfo;
}

/** Formato igual ao da tela de login: `6.06.01 (60601)` */
export function readInstalledAppVersion(
  appId = DEFAULT_APP_ID,
): string | undefined {
  try {
    const out = execFileSync(
      "adb",
      ["shell", "dumpsys", "package", appId],
      { encoding: "utf8", timeout: 15000 },
    );
    const name = /versionName=(\S+)/.exec(out)?.[1];
    const code = /versionCode=(\d+)/.exec(out)?.[1];
    if (name && code) return `${name} (${code})`;
    if (name) return name;
  } catch {
    /* device offline */
  }
  return undefined;
}

/** Tenta ler `Versão: …` direto do UI (uiautomator), se a tela de login estiver aberta. */
export function readLoginScreenVersion(): string | undefined {
  try {
    execFileSync("adb", ["shell", "uiautomator", "dump", "/sdcard/uidump-qa.xml"], {
      encoding: "utf8",
      timeout: 20000,
    });
    const xml = execFileSync(
      "adb",
      ["shell", "cat", "/sdcard/uidump-qa.xml"],
      { encoding: "utf8", timeout: 10000 },
    );
    const m =
      /Vers[aã]o:\s*([^<"']+)/i.exec(xml) ??
      /content-desc="Vers[aã]o:\s*([^"]+)"/i.exec(xml);
    if (m?.[1]) {
      return m[1]
        .replace(/&#10;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

/**
 * Versão do app no registro da execução.
 * Preferência: texto da tela Perfil no log Maestro (`Versão: 6.06.xx`);
 * senão dumpsys (mesmo formato da tela de login).
 */
export function parseAppVersionFromMaestroOutput(
  output: string,
): string | undefined {
  const marker = output.match(/\[qa-desk\] web-build:\s*(.+)/i);
  if (marker?.[1]?.trim()) return marker[1].trim();
  const perfil = output.match(
    /perfilVersao\s*=\s*['"]?(Vers[aã]o:\s*)?(\d+\.\d+\.\d+(?:\s*\(\d+\))?)/i,
  );
  if (perfil?.[2]) return perfil[2].replace(/\s+/g, " ").trim();
  const labeled = output.match(
    /Vers[aã]o:\s*(\d+\.\d+\.\d+(?:\s*\(\d+\))?)/i,
  );
  if (labeled?.[1]) return labeled[1].replace(/\s+/g, " ").trim();
  return undefined;
}

export function resolveAppVersionForRun(output?: string): string | undefined {
  return (
    (output ? parseAppVersionFromMaestroOutput(output) : undefined) ??
    readInstalledAppVersion() ??
    readLoginScreenVersion()
  );
}

/** Extrai ação/flow que falhou do stdout do Maestro. */
export function parseMaestroFailure(output: string): MaestroFailureInfo | undefined {
  const text = normalizeMaestroOutput(output).replace(/\r\n/g, "\n");
  const lines = text.split("\n").map((l) => l.trimEnd());

  let failedAction: string | undefined;
  let failedFlow: string | undefined;

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;

    // "  Tap on "Comunicado"... FAILED"
    if (!failedAction) {
      const action = /^(.*?)\.\.\.\s*FAILED\s*$/i.exec(line);
      if (action && !/^Run\s+/i.test(action[1].trim())) {
        failedAction = action[1].trim().replace(/^\s+/, "");
        continue;
      }
    }

    // "Run ../shared/mural/abrir_novo_comunicado.yaml... FAILED"
    if (!failedFlow) {
      const flow = /^Run\s+(.+?)\.\.\.\s*FAILED\s*$/i.exec(line);
      if (flow) {
        const raw = flow[1].trim().replace(/\\/g, "/");
        failedFlow = raw.split("/").pop() ?? raw;
        continue;
      }
    }

    if (failedAction && failedFlow) break;
  }

  const errorSummary =
    lines.find((l) =>
      /Element not found|Assertion is false|Assertion '|Unknown Property|Flow path does not exist|instrumentation could not/i.test(
        l,
      ),
    )?.trim() ??
    lines.find((l) => /FAILED|Error:/i.test(l) && !/CoroutineScheduler/i.test(l))?.trim();

  if (!failedAction && !failedFlow && !errorSummary) return undefined;

  return { failedAction, failedFlow, errorSummary };
}

/**
 * Casa falha com âncoras em `stepsDetailed` (flows/actions).
 * Sem âncora → não inventa índice (só mantém ação/flow do Maestro).
 */
export function enrichFailureWithStep(
  failure: MaestroFailureInfo,
  steps: string[],
  stepsDetailed?: DetailedStep[] | unknown,
  /** Legado: stepsManual string[] */
  stepsManualLegacy?: unknown,
): MaestroFailureInfo {
  const detailed = detailedStepsFromRecord({
    stepsDetailed,
    stepsManual: stepsManualLegacy,
  });

  if (detailed.length) {
    const hit = matchDetailedStepTrace(detailed, failure);
    if (hit) {
      return {
        ...failure,
        failedStepIndex: hit.index,
        failedStepLabel: hit.label,
        failedStepSource: "stepsDetailed",
      };
    }
    return failure;
  }

  // Sem detalhado: não usa keyword-match no resumo (pouco confiável).
  void steps;
  return failure;
}
