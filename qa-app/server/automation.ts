import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readEnvFile } from "./load-env.js";
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

export async function runMaestroFlow(
  flowPath: string,
  options?: { onOutput?: (chunk: string) => void },
): Promise<{
  ok: boolean;
  exitCode: number | null;
  output: string;
  appVersion?: string;
  failure?: import("./maestro-diagnostics.js").MaestroFailureInfo;
}> {
  const {
    resolveAppVersionForRun,
    parseMaestroFailure,
  } = await import("./maestro-diagnostics.js");

  const appVersion = resolveAppVersionForRun();

  const abs = resolveFlowPath(flowPath);
  const flowArg = path.relative(MAESTRO_ROOT, abs).replace(/\\/g, "/");

  if (flowArg.startsWith("..")) {
    throw new Error(`Flow fora do diretório Maestro: ${flowPath}`);
  }

  const { spawn } = await import("node:child_process");
  const fileEnv = readEnvFile(path.join(MAESTRO_ROOT, ".env"));
  const maestroEnv = {
    ...process.env,
    ...fileEnv,
  };

  // Maestro NÃO usa process.env para ${VAR} nos YAML — só -e ou .env no cwd.
  // No Windows, .bat exige shell; valores com espaço (Pedro Jesus) precisam de aspas.
  const args: string[] = ["test"];
  for (const [key, value] of Object.entries(fileEnv)) {
    if (!key || value === undefined || value === "") continue;
    args.push("-e", `${key}=${value}`);
  }
  args.push(flowArg);

  return new Promise((resolve) => {
    const chunks: string[] = [];
    const onOutput = options?.onOutput;
    const push = (raw: string) => {
      chunks.push(raw);
      onOutput?.(raw);
    };

    const quoteWin = (s: string) =>
      /[\s"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;

    const maestroBin = process.platform === "win32" ? "maestro.bat" : "maestro";
    const child =
      process.platform === "win32"
        ? spawn(
            `${quoteWin(maestroBin)} ${args.map(quoteWin).join(" ")}`,
            {
              cwd: MAESTRO_ROOT,
              shell: true,
              env: maestroEnv,
              windowsHide: true,
            },
          )
        : spawn(maestroBin, args, {
            cwd: MAESTRO_ROOT,
            shell: false,
            env: maestroEnv,
          });

    child.on("error", (err) => {
      push(`\n[spawn error] ${err.message}\n`);
      resolve({
        ok: false,
        exitCode: null,
        output: chunks.join("").slice(-8000) || err.message,
        appVersion,
        failure: parseMaestroFailure(err.message),
      });
    });

    child.stdout?.on("data", (d) => push(String(d)));
    child.stderr?.on("data", (d) => push(String(d)));

    child.on("close", (code) => {
      const output = chunks.join("").slice(-8000);
      const ok = code === 0;
      const versionAfter = resolveAppVersionForRun() ?? appVersion;
      resolve({
        ok,
        exitCode: code,
        output,
        appVersion: versionAfter,
        failure: ok ? undefined : parseMaestroFailure(output),
      });
    });
  });
}

export const MURAL_HOMOLOGATION_ITEMS: Array<{
  title: string;
  flowPath: string;
  description: string;
  steps: string[];
}> = [
  {
    title: "Mural — enviar comunicado de texto",
    flowPath: "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_enviar.yaml",
    description:
      "PHJESUS (coordenador) envia um comunicado de texto; ETMENEZES confirma que o texto aparece no Mural.",
    steps: [
      "Abrir o app na tela de login (ENTRAR)",
      "Entrar como PHJESUS → foto/nome → Perfil → garantir função Coordenador",
      "Abrir o card MURAL e a aba Mural",
      "Abrir Novo comunicado (BoomMenu → Comunicado)",
      "Selecionar turmas (Todas / Selecionar)",
      "Escrever o texto: Teste Comunicado",
      "Enviar o comunicado",
      "Confirmar que Teste Comunicado aparece na lista",
      "Sair e entrar como ETMENEZES",
      "Abrir o Mural e confirmar que Teste Comunicado está visível",
      "Sair até a tela de login",
    ],
  },
  {
    title: "Mural — editar comunicado",
    flowPath: "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_editar.yaml",
    description:
      "Edita o comunicado Teste Comunicado e valida o texto atualizado na lista. Pré-requisito: CT enviar.",
    steps: [
      "Abrir o app na tela de login (ENTRAR)",
      "Entrar como PHJESUS → foto/nome → Perfil → garantir função Coordenador",
      "Abrir o Mural e o filtro Enviadas",
      "Localizar Teste Comunicado",
      "Abrir o menu ⋮ do item → Editar",
      "Alterar o texto para: Teste Comunicado editado",
      "Enviar / salvar a edição",
      "Confirmar que Teste Comunicado editado aparece na lista",
      "Sair até a tela de login",
    ],
  },
  {
    title: "Mural — enquete",
    flowPath: "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_enquete.yaml",
    description: "Cria comunicado com enquete do tipo Nova (opções Sim/Não).",
    steps: [
      "Abrir o app na tela de login (ENTRAR)",
      "Entrar como PHJESUS → foto/nome → Perfil → garantir função Coordenador",
      "Abrir o Mural e Novo comunicado",
      "Selecionar turmas",
      "Escrever o texto: Teste Comunicado enquete",
      "Abrir enquete (ícone Adicionar enquete…) e escolher Nova",
      "Preencher Opção 1 = Sim e Opção 2 = Não",
      "Enviar o comunicado",
      "Confirmar que Teste Comunicado enquete aparece na lista",
      "Sair até a tela de login",
    ],
  },
  {
    title: "Mural — foto da galeria",
    flowPath: "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_foto_galeria.yaml",
    description:
      "Envia comunicado com foto da galeria; ETMENEZES salva e compartilha o anexo.",
    steps: [
      "Preparar fixture de foto no device (FIXTURE_FOTO)",
      "Abrir o app na tela de login (ENTRAR)",
      "Entrar como PHJESUS → foto/nome → Perfil → garantir função Coordenador",
      "Abrir o Mural e Novo comunicado",
      "Selecionar turmas e escrever: Teste Comunicado foto",
      "Anexar imagem da galeria e confirmar no picker Android",
      "Enviar o comunicado",
      "Sair e entrar como ETMENEZES",
      "Abrir o Mural e localizar Teste Comunicado foto",
      "Menu ⋮ → Salvar anexos",
      "Menu ⋮ → Compartilhar anexos",
      "Sair até a tela de login",
    ],
  },
  {
    title: "Mural — excluir comunicado",
    flowPath: "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_excluir.yaml",
    description:
      "Exclui o comunicado Teste Comunicado editado. Pré-requisito: CT editar.",
    steps: [
      "Abrir o app na tela de login (ENTRAR)",
      "Entrar como PHJESUS → foto/nome → Perfil → garantir função Coordenador",
      "Abrir o Mural e o filtro Enviadas",
      "Localizar Teste Comunicado editado",
      "Menu ⋮ → Excluir e confirmar",
      "Confirmar que o texto não aparece mais na lista",
      "Sair até a tela de login",
    ],
  },
  {
    title: "Mural — anexo PDF",
    flowPath: "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_pdf.yaml",
    description:
      "PHJESUS anexa PDF (FIXTURE_PDF) ao comunicado; ETMENEZES confirma na lista.",
    steps: [
      "Preparar PDF no device (push fixtures + FIXTURE_PDF no .env)",
      "Abrir o app na tela de login (ENTRAR)",
      "Entrar como PHJESUS → foto/nome → Perfil → garantir função Coordenador",
      "Abrir o Mural e Novo comunicado",
      "Selecionar turmas e escrever: Teste Comunicado PDF",
      "Anexar arquivo → selecionar o PDF pelo nome",
      "Enviar o comunicado",
      "Sair e entrar como ETMENEZES",
      "Abrir o Mural e confirmar Teste Comunicado PDF",
      "Sair até a tela de login",
    ],
  },
  {
    title: "Mural — vídeo pequeno",
    flowPath: "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_video_pequeno.yaml",
    description:
      "Envia comunicado com vídeo pequeno da galeria (addMedia + FIXTURE_VIDEO).",
    steps: [
      "Preparar vídeo no device (FIXTURE_VIDEO)",
      "Abrir o app na tela de login (ENTRAR)",
      "Entrar como PHJESUS → foto/nome → Perfil → garantir função Coordenador",
      "Abrir o Mural e Novo comunicado",
      "Selecionar turmas e escrever: Teste Comunicado video",
      "Anexar mídia da galeria e confirmar no picker",
      "Enviar o comunicado",
      "Sair e entrar como ETMENEZES",
      "Abrir o Mural e confirmar Teste Comunicado video",
      "Sair até a tela de login",
    ],
  },
  {
    title: "Mural — criar evento",
    flowPath: "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_evento.yaml",
    description: "Abre Evento pelo BoomMenu do Mural e envia um texto de teste.",
    steps: [
      "Abrir o app na tela de login (ENTRAR)",
      "Entrar como PHJESUS → foto/nome → Perfil → garantir função Coordenador",
      "Abrir o Mural",
      "BoomMenu → Evento",
      "Escrever: Teste Evento mural",
      "Enviar",
      "Confirmar (quando possível) que o texto aparece",
      "Sair até a tela de login",
    ],
  },
  {
    title: "Mural — filtro Enviadas",
    flowPath: "projects/polygonus/automation/maestro/flows/mural/01_1_filtro_enviadas.yaml",
    description: "Smoke do filtro Enviadas (e opcionalmente Recebidas) no Mural.",
    steps: [
      "Abrir o app na tela de login (ENTRAR)",
      "Entrar como PHJESUS → foto/nome → Perfil → garantir função Coordenador",
      "Abrir o Mural",
      "Tocar em Enviadas e confirmar o filtro ativo",
      "Opcional: voltar para Recebidas",
      "Sair até a tela de login",
    ],
  },
  {
    title: "Mural — professor deixa Pendente",
    flowPath:
      "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_professor_pendente.yaml",
    description:
      "PHJESUS envia como Professor; em seguida troca para Coordenador na tela Perfil e confere Pendentes. (ACMENEZES é aluno — não envia.)",
    steps: [
      "Abrir o app na tela de login (ENTRAR)",
      "Entrar como PHJESUS",
      "Tocar foto/nome → Perfil → garantir função Professor na lista",
      "Abrir o Mural e Novo comunicado",
      "Selecionar turmas e escrever: Teste Comunicado professor",
      "Enviar o comunicado",
      "Tocar foto/nome → Perfil → alternar para Coordenador na lista",
      "Abrir o Mural → Pendentes",
      "Confirmar Teste Comunicado professor (quando aplicável)",
      "Sair até a tela de login",
    ],
  },
];

export function createMuralHomologationRecords(project: ProjectSlug) {
  const campaign = "mural-backend-homologacao";
  const now = new Date().toISOString().slice(0, 10);
  return MURAL_HOMOLOGATION_ITEMS.map((item, i) => ({
    title: item.title,
    description: item.description,
    steps: item.steps,
    platform: "android" as const,
    channel: "app" as const,
    module: "Mural",
    status: "rascunho" as const,
    priority: "media" as const,
    campaign,
    project,
    reportedAt: now,
    automation: {
      type: "maestro" as const,
      flowPath: item.flowPath,
      label: path.basename(item.flowPath, path.extname(item.flowPath)),
      readiness: "draft" as const,
    },
    tags: ["homologacao", "mural", campaign],
    showInPortfolio: false,
    _sort: i,
  }));
}
