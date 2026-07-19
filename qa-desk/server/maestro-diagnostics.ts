import { execFileSync } from "node:child_process";
import { normalizeMaestroOutput } from "./maestro-output.js";

const DEFAULT_APP_ID = "br.com.polygonus.mobile.amostra";

export interface MaestroFailureInfo {
  /** Ex.: Tap on "Comunicado" */
  failedAction?: string;
  /** Ex.: abrir_novo_comunicado.yaml */
  failedFlow?: string;
  /** Ex.: Element not found: ... */
  errorSummary?: string;
  /** Índice no array steps[] do CT (heurística) */
  failedStepIndex?: number;
  /** Texto do passo humano correspondente */
  failedStepLabel?: string;
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
 * Versão do app no registro da execução — o mesmo texto da tela de login
 * (`Versão: name (code)` via packageInfo). Preferimos dumpsys (rápido/estável);
 * UI dump só como fallback se o device não responder dumpsys.
 */
export function resolveAppVersionForRun(): string | undefined {
  return readInstalledAppVersion() ?? readLoginScreenVersion();
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

const FLOW_HINTS: Array<{ match: RegExp; keywords: string[] }> = [
  {
    match: /ensure_login|login_as|login_phjesus|login_etmenezes|ENTRAR/i,
    keywords: ["login", "entrar", "senha", "e-mail"],
  },
  {
    match: /garantir_perfil|selecionar_funcao|abrir_tela_perfil|verificar_perfil/i,
    keywords: ["perfil", "coordenador", "professor", "função", "funcao", "foto/nome"],
  },
  {
    match: /navegar_mural|voltar_para_home|teardown_estavel/i,
    keywords: ["mural", "card", "teardown", "home"],
  },
  {
    match: /filtrar_enviadas|selecionar_filtro_sentido/i,
    keywords: ["enviadas", "filtro", "confirmar"],
  },
  {
    match: /abrir_novo_comunicado/i,
    keywords: ["novo comunicado", "boom", "fab", "aviso"],
  },
  {
    match: /selecionar_turmas/i,
    keywords: ["turma", "turmas", "selecionar"],
  },
  {
    match: /escrever_comunicado/i,
    keywords: ["escrever", "texto", "teste comunicado"],
  },
  {
    match: /enviar_comunicado/i,
    keywords: ["enviar"],
  },
  {
    match: /verificar_responsavel_ve|login_etmenezes|ensure_logged_out/i,
    keywords: ["etmenezes", "responsável", "responsavel", "logout", "confirmar"],
  },
];

const ACTION_HINTS: Array<{ match: RegExp; keywords: string[] }> = [
  { match: /Comunicado|Aviso/i, keywords: ["comunicado", "aviso", "novo"] },
  { match: /Turma/i, keywords: ["turma"] },
  { match: /Perfil|COORDENADOR|PROFESSORES/i, keywords: ["perfil", "coordenador", "professor"] },
  { match: /MURAL|Mural/i, keywords: ["mural"] },
  { match: /ENTRAR|Senha|E-mail/i, keywords: ["login", "entrar", "senha"] },
  { match: /PULAR/i, keywords: ["tutorial", "pular", "login"] },
];

export function guessFailedStep(
  steps: string[],
  failure: MaestroFailureInfo,
): { index: number; label: string } | undefined {
  if (!steps.length) return undefined;

  const hay = `${failure.failedFlow ?? ""} ${failure.failedAction ?? ""} ${failure.errorSummary ?? ""}`;

  const keywords: string[] = [];
  for (const h of FLOW_HINTS) {
    if (failure.failedFlow && h.match.test(failure.failedFlow)) {
      keywords.push(...h.keywords);
    }
  }
  for (const h of ACTION_HINTS) {
    if (h.match.test(hay)) keywords.push(...h.keywords);
  }

  if (keywords.length === 0) return undefined;

  let bestIdx = -1;
  let bestScore = 0;
  steps.forEach((step, i) => {
    const s = step.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (s.includes(kw.toLowerCase())) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  });

  if (bestIdx < 0 || bestScore === 0) return undefined;
  return { index: bestIdx, label: steps[bestIdx] };
}

export function enrichFailureWithStep(
  failure: MaestroFailureInfo,
  steps: string[],
): MaestroFailureInfo {
  const guess = guessFailedStep(steps, failure);
  if (!guess) return failure;
  return {
    ...failure,
    failedStepIndex: guess.index,
    failedStepLabel: guess.label,
  };
}
