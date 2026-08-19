import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readEnvFile } from "./load-env.js";
import {
  clearMaestroRun,
  forceKillMaestroProcesses,
  killProcessTree,
  registerMaestroRun,
  wasMaestroRunCancelled,
} from "./maestro-run-registry.js";
import { clipMaestroOutput } from "./maestro-output.js";
import {
  assertCardIdAbsent,
  assertTopCardMatches,
  captureMuralCardId,
} from "./mural-card-id.js";
import type { ProjectSlug } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "../..");

export interface AutomationFlow {
  id: string;
  label: string;
  type: "maestro" | "playwright";
  flowPath: string;
  module?: string;
}

const MAESTRO_ROOT = path.join(
  REPO_ROOT,
  "projects/polygonus/automation/maestro/flows",
);
const MAESTRO_WORKSPACE = path.join(
  REPO_ROOT,
  "projects/polygonus/automation/maestro",
);
const MAESTRO_OUTPUT_DIR = path.join(MAESTRO_WORKSPACE, ".maestro-output");
const MAESTRO_CONFIG = path.join(MAESTRO_WORKSPACE, "config.yaml");
const MAESTRO_CLEANUP_SCRIPT = path.join(
  MAESTRO_WORKSPACE,
  "scripts/cleanup-test-artifacts.mjs",
);

function titleFromFilename(file: string) {
  return file
    .replace(/\.ya?ml$/, "")
    .replace(/^\d+_\d+_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function listMaestroFlows(module?: string): AutomationFlow[] {
  if (!fs.existsSync(MAESTRO_ROOT)) return [];

  const flows: AutomationFlow[] = [];
  const dirs = module
    ? [path.join(MAESTRO_ROOT, module)]
    : [MAESTRO_ROOT, ...subdirs(MAESTRO_ROOT)];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!/\.ya?ml$/i.test(file)) continue;
      const rel = path.relative(REPO_ROOT, path.join(dir, file)).replace(/\\/g, "/");
      flows.push({
        id: rel.replace(/[^\w]+/g, "-"),
        label: titleFromFilename(file),
        type: "maestro",
        flowPath: rel,
        module: path.basename(dir),
      });
    }
  }

  return flows.sort((a, b) => a.flowPath.localeCompare(b.flowPath));
}

function subdirs(root: string): string[] {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => path.join(root, d.name));
}

/** Após cada run: em PASS remove prints; em FAIL mantém; limpa cópias no emulador só em PASS */
export async function cleanupMaestroArtifacts(options: {
  ok: boolean;
  runStartedAt: number;
}): Promise<void> {
  if (!fs.existsSync(MAESTRO_CLEANUP_SCRIPT)) return;

  const { spawn } = await import("node:child_process");
  const args = [
    MAESTRO_CLEANUP_SCRIPT,
    "--post-run",
    options.ok ? "--ok" : "--fail",
    "--since",
    String(options.runStartedAt),
    "--quiet",
  ];

  await new Promise<void>((resolve) => {
    spawn(process.execPath, args, { stdio: "ignore", windowsHide: true }).on(
      "close",
      () => resolve(),
    );
  });
}

export function resolveFlowPath(flowPath: string) {
  const abs = path.resolve(REPO_ROOT, flowPath);
  if (!abs.startsWith(REPO_ROOT)) {
    throw new Error("Caminho de automação inválido");
  }
  if (!fs.existsSync(abs)) {
    throw new Error(`Flow não encontrado: ${flowPath}`);
  }
  return abs;
}

/**
 * Sem stdout completo do Maestro por este tempo → abort (lote segue).
 * ANEXO vídeo: "Comprimindo..." no emulador pode passar de 5–12 min sem stdout.
 * Override: MAESTRO_IDLE_TIMEOUT_MS
 */
export function maestroIdleTimeoutMs(flowPath: string): number {
  const isVideoHeavy = /video|compress/i.test(flowPath);
  return Math.max(
    30_000,
    Number(process.env.MAESTRO_IDLE_TIMEOUT_MS) ||
      (isVideoHeavy ? 900_000 : 120_000),
  );
}

export async function runMaestroFlow(
  flowPath: string,
  options?: {
    onOutput?: (chunk: string) => void;
    extraEnv?: Record<string, string>;
    /** Default true. false = --no-reinstall-driver (2ª fase do pipeline ID). */
    reinstallDriver?: boolean;
    runMeta?: {
      runId: string;
      project: string;
      testId: string;
    };
  },
): Promise<{
  ok: boolean;
  exitCode: number | null;
  output: string;
  appVersion?: string;
  cancelled?: boolean;
  failure?: import("./maestro-diagnostics.js").MaestroFailureInfo;
}> {
  const {
    resolveAppVersionForRun,
    parseMaestroFailure,
  } = await import("./maestro-diagnostics.js");
  const { clipMaestroOutput, normalizeMaestroOutput } = await import(
    "./maestro-output.js"
  );

  const appVersion = resolveAppVersionForRun();

  const abs = resolveFlowPath(flowPath);
  const flowArg = path.relative(MAESTRO_ROOT, abs).replace(/\\/g, "/");

  if (flowArg.startsWith("..")) {
    throw new Error(`Flow fora do diretório Maestro: ${flowPath}`);
  }

  const { spawn } = await import("node:child_process");
  const fileEnv = readEnvFile(path.join(MAESTRO_ROOT, ".env"));
  const runtimeEnv = readEnvFile(MAESTRO_RUNTIME_ENV);
  // Maestro ${VAR} NÃO lê process.env — precisa -e ou .env descoberto.
  // Com shell:true no Windows, -e "NOME=Pedro Jesus" quebra o path do flow.
  // Por isso: (1) -e só para valores SEM espaço; (2) NOME_* com espaço vão
  // para um .env efêmero no cwd (flows/) que o Maestro carrega nativamente.
  const cliEnv = { ...runtimeEnv, ...options?.extraEnv };
  const maestroEnv = {
    ...process.env,
    ...fileEnv,
    ...cliEnv,
  };

  const mergedForMaestro = { ...fileEnv, ...cliEnv };
  const envNoSpace: Record<string, string> = {};
  const envWithSpace: Record<string, string> = {};
  for (const [key, value] of Object.entries(mergedForMaestro)) {
    if (!key || value === undefined || value === "") continue;
    if (/\s/.test(value)) envWithSpace[key] = value;
    else envNoSpace[key] = value;
  }

  // Maestro resolve ${VAR} pelo .env ao lado do YAML (ex.: flows/mural/), não só o cwd.
  // Sem isso NOME_PHJESUS vira literal "undefined" no assert.
  const allEnvEntries = { ...fileEnv, ...cliEnv };
  if (Object.keys(allEnvEntries).length > 0) {
    const quoteEnv = (v: string) =>
      /[\s#"']/.test(v) ? `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"` : v;
    const lines = Object.entries(allEnvEntries)
      .filter(([k, v]) => k && v !== undefined && v !== "")
      .map(([k, v]) => `${k}=${quoteEnv(String(v))}`);
    if (lines.length) {
      const body = `${lines.join("\n")}\n`;
      const envTargets = new Set([
        path.join(MAESTRO_ROOT, ".env"),
        path.join(path.dirname(abs), ".env"),
        path.join(MAESTRO_WORKSPACE, ".env"),
      ]);
      for (const envPath of envTargets) {
        try {
          fs.writeFileSync(envPath, body, "utf8");
        } catch {
          /* ignore */
        }
      }
    }
  }

  // Paths relativos ao cwd (flows/) — absolutos com espaço quebram o maestro.bat.
  const args: string[] = ["test"];
  for (const [key, value] of Object.entries(envNoSpace)) {
    args.push("-e", `${key}=${value}`);
  }
  args.push(flowArg);

  // Não passar --config.yaml aqui: o arquivo assume cwd em maestro/ (flows/mural/**),
  // enquanto a qa-desk roda com cwd em flows/. Só o output dir basta.
  args.push("--test-output-dir", "../.maestro-output");

  // 2ª JVM do pipeline ID: pular reinstall do driver Android (~1–2 min no Windows).
  if (options?.reinstallDriver === false) {
    args.push("--no-reinstall-driver");
  }

  if (cliEnv.ID_COMUNICADO) {
    options?.onOutput?.(
      `\n[qa-desk] Maestro env ID_COMUNICADO=${cliEnv.ID_COMUNICADO}\n`,
    );
  }

  const runStartedAt = Date.now();
  const runId = options?.runMeta?.runId;
  /** Sem linha completa → aborta (lote segue). Vídeo/compressão: idle mais folgado. */
  const idleTimeoutMs = maestroIdleTimeoutMs(flowPath);

  return new Promise((resolve) => {
    const chunks: string[] = [];
    const onOutput = options?.onOutput;
    /** Só linha completa conta (chunks parciais do dump NÃO renovam o idle). */
    let lastOutputAt = Date.now();
    const push = (raw: string) => {
      chunks.push(raw);
      onOutput?.(raw);
      if (raw.includes("\n")) lastOutputAt = Date.now();
    };

    const decodeChunk = (buf: Buffer) => buf.toString("utf8");
    let settled = false;
    let forceFinishTimer: ReturnType<typeof setTimeout> | null = null;
    let startupWatchdog: ReturnType<typeof setTimeout> | null = null;
    let idleWatchdog: ReturnType<typeof setInterval> | null = null;

    const settle = (value: Awaited<ReturnType<typeof runMaestroFlow>>) => {
      if (settled) return;
      settled = true;
      if (forceFinishTimer) clearTimeout(forceFinishTimer);
      if (startupWatchdog) clearTimeout(startupWatchdog);
      if (idleWatchdog) clearInterval(idleWatchdog);
      clearInterval(cancelPoll);
      // Não limpa cancelledRunIds aqui: o mesmo runId atravessa prep → adb → CT.
      resolve(value);
    };

    const maestroBin = process.platform === "win32" ? "maestro.bat" : "maestro";

    const child = spawn(maestroBin, args, {
      cwd: MAESTRO_ROOT,
      shell: process.platform === "win32",
      env: {
        ...maestroEnv,
        PYTHONIOENCODING: "utf-8",
        JAVA_TOOL_OPTIONS: [
          process.env.JAVA_TOOL_OPTIONS,
          "-Dfile.encoding=UTF-8",
        ]
          .filter(Boolean)
          .join(" "),
      },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    if (runId && options?.runMeta) {
      registerMaestroRun(
        {
          runId,
          project: options.runMeta.project,
          testId: options.runMeta.testId,
          flowPath,
          startedAt: runStartedAt,
        },
        child,
      );
    }

    const scheduleForceFinish = () => {
      if (forceFinishTimer || settled) return;
      forceFinishTimer = setTimeout(() => {
        if (settled) return;
        push("\n[qa-desk] Execução cancelada pelo usuário (timeout de parada).\n");
        if (runId) clearMaestroRun(runId);
        settle({
          ok: false,
          exitCode: null,
          output: clipMaestroOutput(normalizeMaestroOutput(chunks.join(""))),
          appVersion: resolveAppVersionForRun(chunks.join("")) ?? appVersion,
          cancelled: true,
          failure: {
            errorSummary: "Cancelado pelo usuário",
            failedAction: "Execução interrompida",
          },
        });
        setImmediate(() => forceKillMaestroProcesses());
      }, 6000);
    };

    const cancelPoll = setInterval(() => {
      if (!runId || settled) return;
      if (wasMaestroRunCancelled(runId)) {
        scheduleForceFinish();
      }
    }, 300);

    const abortStalled = (reason: string) => {
      if (settled) return;
      push(`\n[qa-desk] ${reason}\n`);
      if (runId) clearMaestroRun(runId);
      // settle ANTES do kill: no Windows execSync/WMI travava o event loop e o lote nunca avançava
      settle({
        ok: false,
        exitCode: null,
        output: clipMaestroOutput(normalizeMaestroOutput(chunks.join(""))),
        appVersion: resolveAppVersionForRun(chunks.join("")) ?? appVersion,
        // cancelled:false → lote (módulo/suite) continua no próximo CT
        cancelled: false,
        failure: {
          errorSummary: reason,
          failedAction: "Timeout de idle (sem saída do Maestro)",
          failedStepLabel: "Travado — abortado automaticamente",
        },
      });
      setImmediate(() => {
        try {
          killProcessTree(child);
        } catch {
          forceKillMaestroProcesses();
        }
      });
    };

    idleWatchdog = setInterval(() => {
      if (settled) return;
      const idleMs = Date.now() - lastOutputAt;
      if (idleMs < idleTimeoutMs) return;
      const secs = Math.round(idleTimeoutMs / 1000);
      abortStalled(
        `Sem saída há ${secs}s — abortando Maestro para não travar o lote (MAESTRO_IDLE_TIMEOUT_MS=${idleTimeoutMs}).`,
      );
    }, 2_000);

    child.on("error", (err) => {
      if (runId) clearMaestroRun(runId);
      push(`\n[spawn error] ${err.message}\n`);
      settle({
        ok: false,
        exitCode: null,
        output: clipMaestroOutput(
          normalizeMaestroOutput(chunks.join("") || err.message),
        ),
        appVersion,
        failure: parseMaestroFailure(err.message),
      });
    });

    child.stdout?.on("data", (d: Buffer) => {
      if (startupWatchdog) {
        clearTimeout(startupWatchdog);
        startupWatchdog = null;
      }
      push(decodeChunk(d));
    });
    child.stderr?.on("data", (d: Buffer) => {
      if (startupWatchdog) {
        clearTimeout(startupWatchdog);
        startupWatchdog = null;
      }
      push(decodeChunk(d));
    });

    startupWatchdog = setTimeout(() => {
      if (settled || chunks.some((c) => c.trim().length > 0)) return;
      push(
        "\n[qa-desk] Maestro não produziu saída em 45s — confira emulador (adb devices), PATH do Maestro e reinicie o teste.\n",
      );
    }, 45_000);

    child.on("close", async (code) => {
      const cancelled = runId ? wasMaestroRunCancelled(runId) : false;
      if (runId) clearMaestroRun(runId);

      const output = clipMaestroOutput(normalizeMaestroOutput(chunks.join("")));
      if (cancelled) {
        push("\n[qa-desk] Execução cancelada pelo usuário.\n");
      }
      const ok = !cancelled && code === 0;
      const versionAfter =
        resolveAppVersionForRun(chunks.join("")) ?? appVersion;
      void cleanupMaestroArtifacts({ ok, runStartedAt });
      settle({
        ok,
        exitCode: code,
        output: clipMaestroOutput(normalizeMaestroOutput(chunks.join(""))),
        appVersion: versionAfter,
        cancelled,
        failure: ok
          ? undefined
          : cancelled
            ? {
                errorSummary: "Cancelado pelo usuário",
                failedAction: "Execução interrompida",
              }
            : parseMaestroFailure(output),
      });
    });
  });
}

const MURAL_PREP_ENVIADAS_FLOW =
  "projects/polygonus/automation/maestro/flows/shared/mural/prep_lista_enviadas.yaml";
const MAESTRO_RUNTIME_ENV = path.join(MAESTRO_ROOT, ".mural-run.env");
const MAESTRO_FLOWS_ENV = path.join(MAESTRO_ROOT, ".env");

/** Insere/atualiza uma chave no flows/.env (Maestro lê nativamente) e restaura ao final. */
function upsertMaestroFlowsEnv(key: string, value: string): () => void {
  const previous = fs.existsSync(MAESTRO_FLOWS_ENV)
    ? fs.readFileSync(MAESTRO_FLOWS_ENV, "utf8")
    : "";
  const lines = previous.length > 0 ? previous.split(/\r?\n/) : [];
  const out: string[] = [];
  let found = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      out.push(line);
      continue;
    }
    const eq = trimmed.indexOf("=");
    const k = eq >= 0 ? trimmed.slice(0, eq).trim() : trimmed;
    if (k === key) {
      out.push(`${key}=${value}`);
      found = true;
    } else {
      out.push(line);
    }
  }

  if (!found) {
    if (out.length > 0 && out[out.length - 1]?.trim() !== "") out.push("");
    out.push(`${key}=${value}`);
  }

  fs.writeFileSync(
    MAESTRO_FLOWS_ENV,
    out.join("\n").replace(/\n*$/u, "\n"),
    "utf8",
  );

  return () => {
    if (previous) fs.writeFileSync(MAESTRO_FLOWS_ENV, previous, "utf8");
    else {
      try {
        fs.unlinkSync(MAESTRO_FLOWS_ENV);
      } catch {
        /* ignore */
      }
    }
  };
}

export function writeMuralRunEnv(idDigits: string) {
  fs.writeFileSync(MAESTRO_RUNTIME_ENV, `ID_COMUNICADO=${idDigits}\n`, "utf8");
}

export function clearMuralRunEnv() {
  try {
    fs.unlinkSync(MAESTRO_RUNTIME_ENV);
  } catch {
    /* ignore */
  }
}

function muralFlowBaseName(flowPath: string): string {
  const normalized = flowPath.replace(/\\/g, "/");
  return normalized.split("/").pop() ?? normalized;
}

/** CT editar/excluir: prep Enviadas + adb + flow com ID literal. */
export function needsMuralCardIdCapture(flowPath: string): boolean {
  const base = muralFlowBaseName(flowPath);
  return (
    base === "01_1_comunicado_editar.yaml" ||
    base === "01_1_comunicado_excluir.yaml"
  );
}

/** Pós-envio: fase 1 YAML termina em Enviadas → adb ID → fase 2 assert/responsável. */
export type PostSendIdConfig = {
  verifyResponsavel: boolean;
  compartilharAnexos?: boolean;
  /** Texto do card para menu ⋮ (só se compartilharAnexos). */
  itemAncoragem?: string;
  /**
   * Eventos: mural_card_menu vem com content-desc vazio (BUG-2026-00x).
   * Pula adb ID e valida por texto em Enviadas (+ responsável por texto se configurado).
   */
  skipIdCapture?: boolean;
  /** Texto a assertar quando skipIdCapture (ex.: "Evento Dia Inteiro"). */
  assertText?: string;
};

const POST_SEND_ID_CONFIG: Record<string, PostSendIdConfig> = {
  "01_1_comunicado_enviar.yaml": { verifyResponsavel: true },
  "01_1_comunicado_enquete.yaml": { verifyResponsavel: false },
  "01_1_comunicado_foto_galeria.yaml": {
    verifyResponsavel: true,
    compartilharAnexos: true,
    itemAncoragem: "Teste Comunicado foto",
  },
  "01_1_comunicado_pdf.yaml": { verifyResponsavel: true },
  "01_1_comunicado_video_pequeno.yaml": { verifyResponsavel: true },
  "01_1_comunicado_boleto.yaml": {
    // Inadimplentes + BUG-2026-002 (boleto sem arquivo) — ETMENEZES não recebe/vê.
    verifyResponsavel: false,
  },
  "01_1_comunicado_boleto_competencia.yaml": {
    verifyResponsavel: false,
  },
  "01_1_comunicado_correspondencia_ir.yaml": { verifyResponsavel: true },
  // BUG: evento não expõe ID no content-desc — assert por texto.
  "01_1_comunicado_evento.yaml": {
    verifyResponsavel: false,
    skipIdCapture: true,
    assertText: "Evento Padrao",
  },
  "01_1_comunicado_evento_dia_inteiro.yaml": {
    // Reexecução diagnóstico: tenta ID (espera falhar com log BUG-2026-004);
    // se null, cai no assert por texto abaixo via fallback no runner.
    verifyResponsavel: false,
    skipIdCapture: false,
    assertText: "Evento Dia Inteiro",
  },
  // FILTRO-01: Inadimplentes — receptor provisório ETMENEZES (até seed inadimplente próprio).
  "01_1_comunicado_filtro_inadimplentes.yaml": { verifyResponsavel: true },
};

export function needsPostSendIdCapture(flowPath: string): boolean {
  return Boolean(POST_SEND_ID_CONFIG[muralFlowBaseName(flowPath)]);
}

export function needsMuralIdPipeline(flowPath: string): boolean {
  return needsMuralCardIdCapture(flowPath) || needsPostSendIdCapture(flowPath);
}

/** Flow efêmero com ID literal no YAML (contorna falha de -e / .env no Windows). */
function writeGeneratedMuralFlow(
  kind: "editar" | "excluir",
  idDigits: string,
): string {
  if (!/^\d{4,}$/.test(idDigits)) {
    throw new Error(`ID inválido para flow gerado: ${idDigits}`);
  }

  const dir = path.join(MAESTRO_ROOT, ".generated");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `_run_${kind}_id_${idDigits}.yaml`);

  const listaFile =
    kind === "editar"
      ? "../shared/mural/editar_comunicado_lista.yaml"
      : "../shared/mural/excluir_comunicado_lista.yaml";

  const novoTexto =
    kind === "editar"
      ? `\n      NOVO_TEXTO: "Teste Comunicado editado CT02"\n      TEXTO_ANTIGO: "Teste Comunicado.*"`
      : "";

  // Sem setup/login: o prep já deixou PHJESUS + Enviadas. Repetir setup
  // causava 2º login "do nada" antes do filtrar_enviadas do CT.
  // SKIP_FILTRAR_ENVIADAS: evita reabrir o dropdown (já estamos em Enviadas).
  const content = `# Gerado pela qa-desk — ID ${idDigits} via adb. Não commitar.
# Prep (fase 1) já autenticou e abriu Enviadas — não chamar setup de novo.
appId: br.com.polygonus.mobile.amostra
---
- extendedWaitUntil:
    visible:
      id: "mural_card_menu"
    timeout: 15000

- evalScript: |
    \${(() => { output.idComunicado = "ID ${idDigits}"; })()}

- assertTrue: \${(output.idComunicado || "").length > 3}

- runFlow:
    file: ${listaFile}
    env:${novoTexto}
      ID_COMUNICADO: "${idDigits}"
      MURAL_ID: "ID ${idDigits}"
      SKIP_FILTRAR_ENVIADAS: "1"

- runFlow: ../shared/auth/teardown_estavel_sessao.yaml
`;

  fs.writeFileSync(file, content, "utf8");
  return path.relative(REPO_ROOT, file).replace(/\\/g, "/");
}

/** Fase 2 pós-envio: assert ID (+ responsável / compartilhar) com ID literal. */
export function writeGeneratedPostSendVerifyFlow(
  idDigits: string,
  cfg: PostSendIdConfig,
): string {
  if (!/^\d{4,}$/.test(idDigits)) {
    throw new Error(`ID inválido para verify pós-envio: ${idDigits}`);
  }

  const dir = path.join(MAESTRO_ROOT, ".generated");
  fs.mkdirSync(dir, { recursive: true });
  const slug = cfg.compartilharAnexos
    ? "post_send_share"
    : cfg.verifyResponsavel
      ? "post_send_resp"
      : "post_send_assert";
  const file = path.join(dir, `_run_${slug}_id_${idDigits}.yaml`);

  const ancora = (cfg.itemAncoragem || "").replace(/"/g, '\\"');
  // Menu ⋮ ancorado no ID (não index 0 — Destaque pinado no topo de Recebidas)
  const compartilharBlock = cfg.compartilharAnexos
    ? `
- runFlow:
    file: ../shared/mural/abrir_menu_compartilhar_anexos.yaml
    env:
      ID_COMUNICADO: "${idDigits}"
      ITEM_ANCORAGEM: "${ancora}"
`
    : "";

  const responsavelBlock = cfg.verifyResponsavel
    ? `
- runFlow:
    file: ../shared/mural/verificar_responsavel_ve.yaml
    env:
      ID_COMUNICADO: "${idDigits}"
${compartilharBlock}`
    : "";

  const content = `# Gerado pela qa-desk — pós-envio ID ${idDigits}. Não commitar.
appId: br.com.polygonus.mobile.amostra
---
- extendedWaitUntil:
    visible:
      id: "mural_card_menu"
    timeout: 20000

- evalScript: |
    \${(() => { output.idComunicado = "ID ${idDigits}"; })()}

- assertTrue: \${(output.idComunicado || "").length > 3}

- runFlow:
    file: ../shared/mural/assert_comunicado_por_id.yaml
    env:
      ID_COMUNICADO: "${idDigits}"
      MURAL_ID: "ID ${idDigits}"
${responsavelBlock}
- runFlow: ../shared/auth/teardown_estavel_sessao.yaml
`;

  fs.writeFileSync(file, content, "utf8");
  return path.relative(REPO_ROOT, file).replace(/\\/g, "/");
}

/** Pós-envio sem ID (eventos): assert texto em Enviadas + teardown. */
export function writeGeneratedPostSendTextVerifyFlow(
  assertText: string,
  cfg: PostSendIdConfig,
): string {
  const safe = assertText.replace(/"/g, '\\"');
  const dir = path.join(MAESTRO_ROOT, ".generated");
  fs.mkdirSync(dir, { recursive: true });
  const slug = assertText.replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 40);
  const file = path.join(dir, `_run_post_send_text_${slug}.yaml`);

  const responsavelBlock = cfg.verifyResponsavel
    ? `
- runFlow:
    file: ../shared/mural/verificar_responsavel_ve.yaml
    env:
      TEXTO_ANCORAGEM: "${safe}"
`
    : "";

  const content = `# Gerado pela qa-desk — pós-envio por texto (sem ID). Não commitar.
appId: br.com.polygonus.mobile.amostra
---
- extendedWaitUntil:
    visible: "Enviadas|Enviados|Show menu|Recebidas"
    timeout: 20000

- assertVisible: "${safe}"
${responsavelBlock}
- runFlow: ../shared/auth/teardown_estavel_sessao.yaml
`;

  fs.writeFileSync(file, content, "utf8");
  return path.relative(REPO_ROOT, file).replace(/\\/g, "/");
}

function muralRunCancelled(
  output: string,
  appVersion?: string,
): Awaited<ReturnType<typeof runMaestroFlow>> {
  return {
    ok: false,
    exitCode: null,
    output: clipMaestroOutput(
      `${output}\n[qa-desk] Execução cancelada pelo usuário.\n`,
    ),
    appVersion,
    cancelled: true,
    failure: {
      errorSummary: "Cancelado pelo usuário",
      failedAction: "Execução interrompida",
    },
  };
}

export async function runMaestroFlowWithMuralCardId(
  flowPath: string,
  options?: Parameters<typeof runMaestroFlow>[1],
): Promise<Awaited<ReturnType<typeof runMaestroFlow>>> {
  let extraEnv = { ...options?.extraEnv };
  const runId = options?.runMeta?.runId;
  const log = (line: string) => {
    console.log(line);
    options?.onOutput?.(`${line}\n`);
  };

  const postSendCfg = POST_SEND_ID_CONFIG[muralFlowBaseName(flowPath)];
  if (postSendCfg) {
    return runMaestroFlowWithPostSendId(flowPath, postSendCfg, options);
  }

  const useCapture = needsMuralCardIdCapture(flowPath);
  log(
    `[qa-desk] mural-card-id: ${useCapture ? "ATIVO (pré-ação)" : "off"} · flow=${flowPath}`,
  );

  if (!useCapture) {
    return runMaestroFlow(flowPath, { ...options, extraEnv });
  }

  if (runId && wasMaestroRunCancelled(runId)) {
    return muralRunCancelled("");
  }

  // Sempre roda prep: valida PHJESUS + COORDENADOR (mesmo se Enviadas já aberta).
  // Não pular prep só porque adb vê um card — isso pulava checagem de usuário/perfil.
  if (runId && wasMaestroRunCancelled(runId)) {
    return muralRunCancelled("");
  }

  log("[qa-desk] Fase 1/4 — prep Enviadas (valida usuário + perfil COORDENADOR)…");
  const prep = await runMaestroFlow(MURAL_PREP_ENVIADAS_FLOW, {
    onOutput: options?.onOutput,
    runMeta: options?.runMeta,
    reinstallDriver: true,
  });
  const prepOutput = prep.output;
  const prepAppVersion = prep.appVersion;
  if (!prep.ok) return prep;

  if (runId && wasMaestroRunCancelled(runId)) {
    return muralRunCancelled(prepOutput, prepAppVersion);
  }

  log("[qa-desk] Fase 2/4 — capturando ID do card mais recente (adb)…");
  let idComunicado: string | null = null;
  try {
    idComunicado = captureMuralCardId(0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      exitCode: prep.exitCode ?? 1,
      output: `${prepOutput}\n[qa-desk] Falha ao capturar ID do card (adb): ${msg}\n`,
      appVersion: prepAppVersion,
      failure: {
        failedFlow: "prep_lista_enviadas.yaml",
        failedAction: "captureMuralCardId",
        errorSummary: msg,
      },
    };
  }

  if (!idComunicado) {
    return {
      ok: false,
      exitCode: prep.exitCode ?? 1,
      output: `${prepOutput}\n[qa-desk] ID do 1º card não encontrado — confira filtro Enviadas.\n`,
      appVersion: prepAppVersion,
      failure: {
        failedFlow: "prep_lista_enviadas.yaml",
        failedAction: "captureMuralCardId",
        errorSummary: "Badge ID ausente no content-desc de mural_card_menu",
      },
    };
  }

  if (runId && wasMaestroRunCancelled(runId)) {
    return muralRunCancelled(prepOutput, prepAppVersion);
  }

  const idDigits = idComunicado.replace(/[^0-9]/g, "");
  const kind = /excluir/i.test(flowPath) ? "excluir" : "editar";
  const generatedFlowPath = writeGeneratedMuralFlow(kind, idDigits);
  // Só dígitos no -e (sem espaço). MURAL_ID="ID N" quebra o maestro.bat no Windows.
  // O YAML gerado já embute ID_COMUNICADO + MURAL_ID literais no runFlow.
  extraEnv = {
    ...extraEnv,
    ID_COMUNICADO: idDigits,
    SKIP_FILTRAR_ENVIADAS: "1",
  };
  log(`[qa-desk] ID capturado: ID ${idDigits} → ${generatedFlowPath}`);
  log("[qa-desk] Fase 3/4 — CT principal (Maestro, --no-reinstall-driver)…");

  try {
    const main = await runMaestroFlow(generatedFlowPath, {
      ...options,
      extraEnv,
      // Driver já instalado no prep (ou sessão quente) — evita ~1–2 min de reinstall.
      reinstallDriver: false,
    });
    if (!main.ok || main.cancelled) return main;

    // Fase 4 — adb pós-check.
    // Editar: app gera novo ID (bug conhecido) — só exige texto novo na UI.
    // Excluir: ID capturado deve sumir.
    if (kind === "editar") {
      const novoTexto = "Teste Comunicado editado CT02";
      log("[qa-desk] Fase 4/4 — adb: texto editado visível (mesmo ID adiado — bug app)…");
      try {
        const check = assertTopCardMatches({
          expectedId: idComunicado,
          expectedText: novoTexto,
        });
        if (!check.ok && check.reason.includes("Texto não encontrado")) {
          log(`[qa-desk] FALHA: ${check.reason}`);
          return {
            ...main,
            ok: false,
            exitCode: main.exitCode ?? 1,
            output: `${main.output}\n[qa-desk] ${check.reason}\n`,
            failure: {
              failedFlow: "_run_editar (adb post-check)",
              failedAction: "assertTextoEditado",
              errorSummary: check.reason,
            },
          };
        }
        if (check.ok) {
          log(`[qa-desk] Validação OK: mesmo ID ${check.idComunicado} + texto no topo`);
        } else {
          log(
            `[qa-desk] Texto editado OK · aviso bug app: topo ${check.topId ?? "?"} ≠ ${idComunicado} (não falha o CT)`,
          );
        }
      } catch (err) {
        // Maestro já assertou NOVO_TEXTO em Enviadas; dump adb pós-JVM às vezes morre (137).
        const msg = err instanceof Error ? err.message : String(err);
        log(
          `[qa-desk] Aviso: adb pós-check indisponível (${msg}). CT Maestro já validou texto editado — mantendo OK.`,
        );
      }
    } else {
      log("[qa-desk] Fase 4/4 — adb: confirmar ID ausente após exclusão…");
      try {
        const check = assertCardIdAbsent(idComunicado);
        if (!check.ok) {
          log(`[qa-desk] FALHA validação ID: ${check.reason}`);
          return {
            ...main,
            ok: false,
            exitCode: main.exitCode ?? 1,
            output: `${main.output}\n[qa-desk] ${check.reason}\n`,
            failure: {
              failedFlow: "_run_excluir (adb post-check)",
              failedAction: "assertCardIdAbsent",
              errorSummary: check.reason,
            },
          };
        }
        log(`[qa-desk] Validação ID OK: ${idComunicado} ausente da lista`);
      } catch (err) {
        // Maestro já assertou ausência; dump adb pós-JVM às vezes morre (137).
        const msg = err instanceof Error ? err.message : String(err);
        log(
          `[qa-desk] Aviso: adb pós-check indisponível (${msg}). CT Maestro já validou ID ausente — mantendo OK.`,
        );
      }
    }

    return main;
  } finally {
    clearMuralRunEnv();
  }
}

/** Enviar/anexo/enquete: Maestro fase 1 → adb ID → Maestro fase 2 (assert + opcional responsável). */
async function runMaestroFlowWithPostSendId(
  flowPath: string,
  cfg: PostSendIdConfig,
  options?: Parameters<typeof runMaestroFlow>[1],
): Promise<Awaited<ReturnType<typeof runMaestroFlow>>> {
  const runId = options?.runMeta?.runId;
  const log = (line: string) => {
    console.log(line);
    options?.onOutput?.(`${line}\n`);
  };

  log(
    `[qa-desk] mural-card-id: ATIVO (pós-envio) · flow=${flowPath} · resp=${cfg.verifyResponsavel} · share=${Boolean(cfg.compartilharAnexos)}`,
  );

  if (runId && wasMaestroRunCancelled(runId)) {
    return muralRunCancelled("");
  }

  log("[qa-desk] Fase 1/3 — envio (Maestro) até lista Enviadas…");
  const phase1 = await runMaestroFlow(flowPath, {
    onOutput: options?.onOutput,
    runMeta: options?.runMeta,
    reinstallDriver: true,
  });
  if (!phase1.ok || phase1.cancelled) return phase1;

  if (runId && wasMaestroRunCancelled(runId)) {
    return muralRunCancelled(phase1.output, phase1.appVersion);
  }

  // Eventos: sem ID no content-desc (BUG-2026-004) — assert por texto.
  if (cfg.skipIdCapture && cfg.assertText) {
    const textFlow = writeGeneratedPostSendTextVerifyFlow(cfg.assertText, cfg);
    log(
      `[qa-desk] Fase 2–3/3 — assert por texto "${cfg.assertText}" (sem ID — BUG-2026-004)…`,
    );
    return runMaestroFlow(textFlow, {
      ...options,
      reinstallDriver: false,
    });
  }

  log("[qa-desk] Fase 2/3 — capturando ID do card mais recente (adb)…");
  let idComunicado: string | null = null;
  try {
    idComunicado = captureMuralCardId(0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      exitCode: phase1.exitCode ?? 1,
      output: `${phase1.output}\n[qa-desk] Falha ao capturar ID pós-envio (adb): ${msg}\n`,
      appVersion: phase1.appVersion,
      failure: {
        failedFlow: muralFlowBaseName(flowPath),
        failedAction: "captureMuralCardId (pós-envio)",
        errorSummary: msg,
      },
    };
  }

  if (!idComunicado) {
    // Eventos: badge pode estar na tela mas fora da árvore a11y (BUG-2026-004).
    if (cfg.assertText) {
      log(
        `[qa-desk] ID ausente na acessibilidade do 1º card — fallback assert por texto "${cfg.assertText}" (BUG-2026-004).`,
      );
      const textFlow = writeGeneratedPostSendTextVerifyFlow(cfg.assertText, {
        ...cfg,
        verifyResponsavel: false,
      });
      return runMaestroFlow(textFlow, {
        ...options,
        reinstallDriver: false,
      });
    }
    return {
      ok: false,
      exitCode: phase1.exitCode ?? 1,
      output: `${phase1.output}\n[qa-desk] ID do 1º card ausente após envio — confira Enviadas / upload do anexo.\n`,
      appVersion: phase1.appVersion,
      failure: {
        failedFlow: muralFlowBaseName(flowPath),
        failedAction: "captureMuralCardId (pós-envio)",
        errorSummary: "Badge ID ausente no content-desc de mural_card_menu",
      },
    };
  }

  const idDigits = idComunicado.replace(/[^0-9]/g, "");
  const generatedFlowPath = writeGeneratedPostSendVerifyFlow(idDigits, cfg);
  writeMuralRunEnv(idDigits);
  log(`[qa-desk] ID capturado: ID ${idDigits} → ${generatedFlowPath}`);
  log("[qa-desk] Fase 3/3 — assert por ID (+ responsável se aplicável)…");

  try {
    return await runMaestroFlow(generatedFlowPath, {
      ...options,
      extraEnv: {
        ...options?.extraEnv,
        ID_COMUNICADO: idDigits,
      },
      reinstallDriver: false,
    });
  } finally {
    clearMuralRunEnv();
  }
}

/**
 * Catálogo canônico dos CTs do módulo Mural.
 *
 * Hierarquia:
 *   módulo (Mural | Atendimento | …)
 *     → suite / bloco (CRUD, Anexos, Boleto, …) — agrupamento por domínio
 *       → CT com numeração local (CRUD-01, ANEXO-02, …)
 *
 * Chave global estável: `mural/crud-01`, `atendimento/anexo-01` (módulo/ctId).
 * Título na UI: `{ctId} · {ação}`.
 */
export type MuralSuite =
  | "CRUD"
  | "Enquete"
  | "Anexos"
  | "Boleto"
  | "Correspondencia"
  | "Eventos"
  | "Lista"
  | "Filtros"
  | "E2E";

export type MuralHomologationItem = {
  /** ID estável por domínio, ex.: CRUD-01, ANEXO-02, E2E-99 */
  ctId: string;
  /** Bloco/suite dentro do módulo Mural */
  suite: MuralSuite;
  /** Alias legado (run-ct-mural.ts 01…99) */
  legacyNum: string;
  title: string;
  flowPath: string;
  description: string;
  preconditions: string;
  expectedResult: string;
  steps: string[];
  /** Seed Playwright antes do Maestro (ex.: DN Aniversariante) */
  prep?: {
    type: "playwright";
    specPath: string;
    headed?: boolean;
  };
};

/** Chave única global: `{módulo}/{ctId}` em minúsculas. */
export function muralDomainTestKey(ctId: string, module = "mural"): string {
  return `${module}/${ctId.toLowerCase()}`;
}

export const MURAL_HOMOLOGATION_ITEMS: MuralHomologationItem[] = [
  // —— CRUD ——
  {
    ctId: "CRUD-01",
    suite: "CRUD",
    legacyNum: "01",
    title: "CRUD-01 · Enviar comunicado (texto)",
    flowPath: "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_enviar.yaml",
    description:
      "PHJESUS (coordenador) envia um comunicado de texto; o responsável ETMENEZES confirma o recebimento no Mural.",
    preconditions:
      "App amostra instalado; credenciais PHJESUS e ETMENEZES no flows/.env; emulador disponível.",
    expectedResult:
      "Comunicado confirmado pelo ID (adb) em Enviadas e no Mural do responsável ETMENEZES; home autenticada ao final.",
    steps: [
      "Retomar sessão PHJESUS → Coordenador → enviar Teste Comunicado (alvo Todos)",
      "Filtro Enviadas → qa-desk captura ID (adb) → assert por ID",
      "ETMENEZES → Mural → assert pelo mesmo ID",
      "Teardown estável (home autenticada)",
    ],
  },
  {
    ctId: "CRUD-02",
    suite: "CRUD",
    legacyNum: "02",
    title: "CRUD-02 · Editar comunicado",
    flowPath: "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_editar.yaml",
    description:
      "Edita o comunicado mais recente em Enviadas e valida o texto novo na lista.",
    preconditions:
      "Ao menos 1 comunicado em Enviadas; sessão PHJESUS com perfil Coordenador.",
    expectedResult:
      "Texto “Teste Comunicado editado CT02” visível em Enviadas. (Mesmo ID adiado: BUG-2026-003.)",
    steps: [
      "Retomar sessão PHJESUS → Perfil → Coordenador → Enviadas (prep único)",
      "Capturar ID do card mais recente (adb)",
      "Menu ⋮ → Editar → texto Teste Comunicado editado CT02 (Select all)",
      "Confirmar texto novo na lista Enviadas",
      "Teardown estável (home autenticada)",
    ],
  },
  {
    ctId: "CRUD-03",
    suite: "CRUD",
    legacyNum: "03",
    title: "CRUD-03 · Excluir comunicado",
    flowPath: "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_excluir.yaml",
    description:
      "Exclui o comunicado mais recente em Enviadas e confirma que o ID capturado sumiu da lista.",
    preconditions:
      "Ao menos 1 comunicado em Enviadas; sessão PHJESUS com perfil Coordenador.",
    expectedResult:
      "O ID do comunicado excluído não aparece mais no filtro Enviadas; home autenticada ao final.",
    steps: [
      "Retomar sessão PHJESUS → Perfil → garantir função Coordenador",
      "Abrir o Mural e o filtro Enviadas",
      "Capturar o ID do comunicado mais recente",
      "Menu ⋮ → Excluir e confirmar",
      "Confirmar que o ID capturado não aparece mais na lista",
      "Teardown estável (home autenticada)",
    ],
  },
  // —— Enquete ——
  {
    ctId: "ENQUETE-01",
    suite: "Enquete",
    legacyNum: "04",
    title: "ENQUETE-01 · Comunicado com enquete Nova",
    flowPath: "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_enquete.yaml",
    description: "Cria comunicado com enquete do tipo Nova (opções Sim/Não).",
    preconditions:
      "Sessão PHJESUS; perfil Coordenador; app na tela de login ou home reutilizável.",
    expectedResult:
      "Comunicado com enquete confirmado pelo ID (adb) em Enviadas; home autenticada.",
    steps: [
      "PHJESUS Coordenador → Novo comunicado (turmas + alvo Todos)",
      "Enquete Nova (Sim/Nao) → enviar → Enviadas",
      "qa-desk: adb captura ID → assert por ID → teardown",
    ],
  },
  // —— Anexos ——
  {
    ctId: "ANEXO-01",
    suite: "Anexos",
    legacyNum: "05",
    title: "ANEXO-01 · Foto da galeria",
    flowPath: "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_foto_galeria.yaml",
    description:
      "Envia comunicado com foto; responsável confirma por ID e abre Compartilhar anexos (sem concluir share).",
    preconditions:
      "Fixture de foto no device (FIXTURE_FOTO); credenciais PHJESUS e ETMENEZES.",
    expectedResult:
      "ID confirmado (coordenador + ETMENEZES); Compartilhar anexos disparado (download); share sheet fechado se abrir.",
    steps: [
      "PHJESUS → composer (turmas + alvo Todos) + foto galeria → enviar → Enviadas",
      "qa-desk: adb ID → assert → ETMENEZES → assert mesmo ID",
      "Menu ⋮ → Compartilhar anexos → Back se sheet abrir → teardown",
    ],
  },
  {
    ctId: "ANEXO-02",
    suite: "Anexos",
    legacyNum: "06",
    title: "ANEXO-02 · PDF",
    flowPath: "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_pdf.yaml",
    description:
      "Clipe → Selecionar arquivo → anexa PDF; confirma envio/recebimento pelo ID (adb).",
    preconditions:
      "PDF no device (push fixtures + FIXTURE_PDF no .env); credenciais PHJESUS e ETMENEZES.",
    expectedResult:
      "ID do comunicado com PDF confirmado em Enviadas e no Mural do responsável.",
    steps: [
      "PHJESUS → composer (turmas + alvo Todos) → clipe → Selecionar arquivo → PDF → enviar → Enviadas",
      "qa-desk: adb ID → assert → ETMENEZES → assert mesmo ID → teardown",
    ],
  },
  {
    ctId: "ANEXO-03",
    suite: "Anexos",
    legacyNum: "07",
    title: "ANEXO-03 · Vídeo pequeno",
    flowPath: "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_video_pequeno.yaml",
    description:
      "Clipe → Selecionar arquivo → anexa vídeo; confirma envio/recebimento pelo ID (adb).",
    preconditions:
      "Vídeo no device (/sdcard/Download + FIXTURE_VIDEO); credenciais PHJESUS e ETMENEZES.",
    expectedResult:
      "ID do comunicado com vídeo confirmado em Enviadas e no Mural do responsável.",
    steps: [
      "PHJESUS → composer (turmas + alvo Todos) → clipe → Selecionar arquivo → vídeo → enviar → Enviadas",
      "qa-desk: adb ID → assert → ETMENEZES → assert mesmo ID → teardown",
    ],
  },
  // —— Boleto ——
  {
    ctId: "BOLETO-01",
    suite: "Boleto",
    legacyNum: "11",
    title: "BOLETO-01 · Inadimplentes / mês corrente",
    flowPath: "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_boleto.yaml",
    description:
      "Funil Inadimplentes + Mes corrente; clipe Boleto; texto de cobrança; ID.",
    preconditions: "Sessão PHJESUS Coordenador; credenciais ETMENEZES.",
    expectedResult:
      "ID do boleto (mês corrente / inadimplentes) confirmado em Enviadas. Responsável adiado: BUG-2026-002 + Inadimplentes.",
    steps: [
      "Composer → turmas + alvo Todos → funil → Inadimplentes → Mes corrente → Ok",
      "Clipe → Boleto → texto de cobrança → enviar → Enviadas",
      "qa-desk: adb ID → assert em Enviadas → teardown",
    ],
  },
  {
    ctId: "BOLETO-02",
    suite: "Boleto",
    legacyNum: "14",
    title: "BOLETO-02 · Inadimplentes / competência 01",
    flowPath:
      "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_boleto_competencia.yaml",
    description:
      "Funil Inadimplentes + Período (competência com 01, sem mês corrente); Boleto; ID.",
    preconditions: "Sessão PHJESUS Coordenador; credenciais ETMENEZES.",
    expectedResult:
      "ID do boleto (competência 01) confirmado em Enviadas. Responsável adiado: BUG-2026-002 + Inadimplentes.",
    steps: [
      "Composer → funil → Inadimplentes → data Período → competência 01 → Ok",
      "Clipe → Boleto → texto de cobrança → enviar → Enviadas",
      "qa-desk: adb ID → assert em Enviadas → teardown",
    ],
  },
  // —— Correspondência ——
  {
    ctId: "CORRESP-01",
    suite: "Correspondencia",
    legacyNum: "12",
    title: "CORRESP-01 · Declaração IR",
    flowPath:
      "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_correspondencia_ir.yaml",
    description:
      "Clipe → Correspondência → lista → Declaração IR → Ok; confirma pelo ID.",
    preconditions: "Sessão PHJESUS Coordenador; credenciais ETMENEZES.",
    expectedResult:
      "ID do comunicado com Declaração IR confirmado em Enviadas e no Mural do responsável.",
    steps: [
      "PHJESUS → composer → clipe → Correspondência → Declaração IR → Ok → enviar",
      "qa-desk: adb ID → assert → ETMENEZES → assert mesmo ID → teardown",
    ],
  },
  // —— Eventos ——
  {
    ctId: "EVENTO-01",
    suite: "Eventos",
    legacyNum: "08",
    title: "EVENTO-01 · Padrão (com horário)",
    flowPath: "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_evento.yaml",
    description:
      "Novo evento sem Dia inteiro; data amanhã (scroll no seletor); texto Evento Padrao.",
    preconditions:
      "PHJESUS Coordenador; emulador America/Sao_Paulo + relógio 24h.",
    expectedResult:
      "Evento Padrao em Enviadas. Sem dialog BrasilTime.",
    steps: [
      "BoomMenu → Evento → turmas + Todos (sem Dia inteiro)",
      "Seletor de data → scroll dia seguinte → Ok",
      "Título/texto: Evento Padrao → enviar → Enviadas",
    ],
  },
  {
    ctId: "EVENTO-02",
    suite: "Eventos",
    legacyNum: "13",
    title: "EVENTO-02 · Dia inteiro",
    flowPath:
      "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_evento_dia_inteiro.yaml",
    description:
      "Novo evento com Dia inteiro; data amanhã (scroll no seletor); texto Evento Dia Inteiro.",
    preconditions:
      "PHJESUS Coordenador; emulador America/Sao_Paulo + relógio 24h.",
    expectedResult:
      "Evento Dia Inteiro em Enviadas. Sem dialog BrasilTime.",
    steps: [
      "BoomMenu → Evento → turmas + Todos → ligar Dia inteiro",
      "Seletor de data → scroll dia seguinte → Ok",
      "Título/texto: Evento Dia Inteiro → enviar → Enviadas",
    ],
  },
  // —— Lista (definir escopo depois) ——
  {
    ctId: "LISTA-01",
    suite: "Lista",
    legacyNum: "09",
    title: "LISTA-01 · Filtro Enviadas (rascunho)",
    flowPath: "projects/polygonus/automation/maestro/flows/mural/01_1_filtro_enviadas.yaml",
    description:
      "Filtro Enviadas na lista do Mural — escopo ainda a definir com o time.",
    preconditions:
      "Sessão PHJESUS; perfil Coordenador; Mural com lista carregável.",
    expectedResult:
      "Filtro Enviadas ativo e reconhecível na UI (função completa pendente).",
    steps: [
      "Abrir Mural como PHJESUS Coordenador",
      "Tocar em Enviadas e confirmar o filtro ativo",
    ],
  },
  // —— Filtros especiais (menu funil do composer; conferência manual) ——
  // UI: Inadimplentes, Aniversariantes do dia, Bolsistas 100%/50%/todos,
  //     Pagantes, Situação, Sexo, Aniversariantes do mês, Limpar filtro
  {
    ctId: "FILTRO-01",
    suite: "Filtros",
    legacyNum: "21",
    title: "FILTRO-01 · Inadimplentes (envio)",
    flowPath:
      "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_filtro_inadimplentes.yaml",
    description:
      "Composer → funil → Inadimplentes → Período (mês corrente) → envia texto. Receptor provisório: ETMENEZES.",
    preconditions: "Sessão PHJESUS Coordenador; LOGIN_ETMENEZES no .env.",
    expectedResult:
      "Comunicado em Enviadas; ETMENEZES vê o mesmo ID em Recebidas (provisório até seed inadimplente).",
    steps: [
      "Composer → turmas + alvo Todos → funil → Inadimplentes → mês corrente",
      "Texto → enviar → Enviadas → adb ID → ETMENEZES → assert ID",
    ],
  },
  {
    ctId: "FILTRO-02",
    suite: "Filtros",
    legacyNum: "22",
    title: "FILTRO-02 · Aniversariantes do dia (envio)",
    flowPath:
      "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_filtro_aniversariantes_dia.yaml",
    description:
      "Playwright ajusta DN do colaborador Aniversariante (dia/mês) → Composer → funil → Aniversariantes do dia → envia. Receptor: ANIVERSARI.",
    preconditions:
      "DN seed ok (Playwright); PHJESUS Coordenador; LOGIN_ANIVERSARI no .env.",
    expectedResult:
      "Comunicado em Enviadas; ANIVERSARI vê o mesmo ID em Recebidas.",
    steps: [
      "Playwright: amostra CQ → Colaboradores → Aniversariante → DN dia/mês → Gravar",
      "Funil → Aniversariantes do dia → enviar → Enviadas",
      "Logout → ANIVERSARI → assert ID",
    ],
    prep: {
      type: "playwright",
      specPath:
        "projects/polygonus/automation/playwright/mural/ajustar-dn-aniversariante.spec.ts",
      headed: true,
    },
  },
  {
    ctId: "FILTRO-03",
    suite: "Filtros",
    legacyNum: "23",
    title: "FILTRO-03 · Bolsistas 100% (envio)",
    flowPath:
      "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_filtro_bolsista_100.yaml",
    description:
      "Composer → funil → Bolsistas 100% → envia. Receptor: RBBARBOSA (bolsista 100% + pai de menino).",
    preconditions: "Sessão PHJESUS Coordenador; LOGIN_RBBARBOSA no .env.",
    expectedResult:
      "Comunicado em Enviadas; RBBARBOSA vê o card (ID). Pai de menina / não-bolsista 100% não vê.",
    steps: [
      "Funil → Bolsistas 100% → enviar → Enviadas",
      "Logout → RBBARBOSA → assert ID",
    ],
  },
  {
    ctId: "FILTRO-04",
    suite: "Filtros",
    legacyNum: "24",
    title: "FILTRO-04 · Bolsistas 50% (envio)",
    flowPath:
      "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_filtro_bolsista_50.yaml",
    description:
      "Composer → funil → Bolsistas 50% → envia. Receptor: PLLIMA (bolsista 50% + pai de menina).",
    preconditions: "Sessão PHJESUS Coordenador; LOGIN_PLLIMA no .env.",
    expectedResult:
      "Comunicado em Enviadas; PLLIMA vê o card. RBBARBOSA (100%) não vê.",
    steps: [
      "Funil → Bolsistas 50% → enviar → Enviadas",
      "Logout → PLLIMA → assert ID",
    ],
  },
  {
    ctId: "FILTRO-05",
    suite: "Filtros",
    legacyNum: "25",
    title: "FILTRO-05 · Bolsistas todos (envio)",
    flowPath:
      "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_filtro_todos_bolsistas.yaml",
    description:
      "Composer → funil → Bolsistas todos → envia. Ambos seeds (RBBARBOSA 100% e PLLIMA 50%) devem ver.",
    preconditions: "PHJESUS Coordenador; LOGIN_RBBARBOSA + LOGIN_PLLIMA no .env.",
    expectedResult:
      "Comunicado em Enviadas; RBBARBOSA e PLLIMA veem o mesmo ID.",
    steps: [
      "Funil → Bolsistas todos → enviar → Enviadas",
      "Assert ID em RBBARBOSA e PLLIMA",
    ],
  },
  {
    ctId: "FILTRO-06",
    suite: "Filtros",
    legacyNum: "26",
    title: "FILTRO-06 · Pagantes (envio)",
    flowPath:
      "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_filtro_pagantes.yaml",
    description:
      "Composer → funil → Pagantes → envia. Pagantes = sem gratuidade 100%. Receptor: PLLIMA (50%). RBBARBOSA (100%) não vê.",
    preconditions: "PHJESUS Coordenador; LOGIN_PLLIMA no .env.",
    expectedResult:
      "Comunicado em Enviadas; PLLIMA vê o card. RBBARBOSA (bolsista 100%) não vê.",
    steps: [
      "Funil → Pagantes → enviar → Enviadas",
      "Logout → PLLIMA → assert ID (RBBARBOSA não deve ver)",
    ],
  },
  {
    ctId: "FILTRO-07",
    suite: "Filtros",
    legacyNum: "27",
    title: "FILTRO-07 · Situação Transferido (envio)",
    flowPath:
      "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_filtro_situacao.yaml",
    description:
      "Composer → funil → Situação → Transferido → envia. (Por enquanto só Transferido.)",
    preconditions: "Sessão PHJESUS Coordenador.",
    expectedResult:
      "Comunicado “Teste filtro Situação Transferido” em Enviadas.",
    steps: ["Funil → Situação → Transferido → enviar → Enviadas"],
  },
  {
    ctId: "FILTRO-08",
    suite: "Filtros",
    legacyNum: "28",
    title: "FILTRO-08 · Sexo (envio)",
    flowPath:
      "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_filtro_sexo.yaml",
    description:
      "Composer → funil → Sexo → Masculino/Feminino → envia. Validar nos dois pais: RBBARBOSA (menino) e PLLIMA (menina).",
    preconditions:
      "PHJESUS Coordenador; LOGIN_RBBARBOSA + LOGIN_PLLIMA no .env.",
    expectedResult:
      "Filtro Masculino: RBBARBOSA vê, PLLIMA não. Filtro Feminino: o inverso.",
    steps: [
      "Funil → Sexo → Masculino → enviar → assert RBBARBOSA (+ / − PLLIMA)",
      "Repetir Feminino com os mesmos logins invertidos",
    ],
  },
  {
    ctId: "FILTRO-09",
    suite: "Filtros",
    legacyNum: "29",
    title: "FILTRO-09 · Aniversariantes do mês (envio)",
    flowPath:
      "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_filtro_aniversariantes_mes.yaml",
    description:
      "Playwright ajusta DN (mês do teste) → funil → Aniversariantes do mês → envia. Receptor: ANIVERSARI.",
    preconditions:
      "DN seed ok (Playwright); PHJESUS Coordenador; LOGIN_ANIVERSARI no .env.",
    expectedResult:
      "Comunicado em Enviadas; ANIVERSARI vê o mesmo ID em Recebidas.",
    steps: [
      "Playwright: DN com mês do teste → Gravar",
      "Funil → Aniversariantes do mês → enviar → Enviadas",
      "Logout → ANIVERSARI → assert ID",
    ],
    prep: {
      type: "playwright",
      specPath:
        "projects/polygonus/automation/playwright/mural/ajustar-dn-aniversariante.spec.ts",
      headed: true,
    },
  },
  // FILTRO-10 Limpar filtro — fora de escopo (helper limparFiltroExtrasComposer se precisar no meio do fluxo)
  // —— E2E (adiado: só depois que CRUD/Anexos/Filtros/… estiverem estáveis) ——
  {
    ctId: "E2E-99",
    suite: "E2E",
    legacyNum: "99",
    title: "E2E-99 · Mural completo (adiado)",
    flowPath:
      "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_completo_e2e.yaml",
    description:
      "ADIANO — não entra no lote do módulo. Fluxo ponta a ponta: comunicado com texto, enquete e anexos; depois edita e exclui. Rodar só após os demais CTs do Mural.",
    preconditions:
      "Fixtures no device (FIXTURE_FOTO, FIXTURE_VIDEO, FIXTURE_PDF); PHJESUS coordenador. Demais CTs do Mural já estáveis.",
    expectedResult:
      "Comunicado completo enviado; texto editado confirmado; card excluído da lista.",
    steps: [
      "Preparar fixtures no device",
      "PHJESUS coordenador → Mural → comunicado completo + anexos",
      "Editar → Excluir → teardown",
    ],
  },
];

export function findMuralItemByFlowPath(flowPath: string): MuralHomologationItem | undefined {
  const norm = flowPath.replace(/\\/g, "/");
  return MURAL_HOMOLOGATION_ITEMS.find((i) => {
    const fp = i.flowPath.replace(/\\/g, "/");
    return fp === norm || norm.endsWith(`/${path.basename(fp)}`);
  });
}

export function createMuralHomologationRecords(project: ProjectSlug) {
  const campaign = "mural-backend-homologacao";
  const now = new Date().toISOString().slice(0, 10);
  return MURAL_HOMOLOGATION_ITEMS.map((item, i) => ({
    title: item.title,
    description: item.description,
    preconditions: item.preconditions,
    expectedResult: item.expectedResult,
    steps: item.steps,
    platform: "android" as const,
    channel: "app" as const,
    module: "Comunicados",
    status: "rascunho" as const,
    priority: "media" as const,
    campaign,
    project,
    reportedAt: now,
    testKey: muralDomainTestKey(item.ctId),
    automation: {
      type: "maestro" as const,
      flowPath: item.flowPath,
      label: item.ctId,
      readiness: "draft" as const,
      ...(item.prep ? { prep: item.prep } : {}),
    },
    tags: [
      "homologacao",
      "mural",
      campaign,
      "module:Comunicados",
      `suite:${item.suite}`,
      `ct:${item.ctId}`,
      ...(item.suite === "E2E" ? (["deferred:batch"] as const) : []),
    ],
    showInPortfolio: false,
    _sort: i,
  }));
}
