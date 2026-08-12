/**
 * Gera YAMLs smoke (abrir/voltar) + seeda CTs no Desk para menus home.
 * Uso: npx tsx scripts/seed-menu-smokes.ts
 *
 * Fora: Aula Online, Chegando. Atendimento já tem CHAT-00. Mural já tem CTs densos.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "../server/load-env.ts";
loadEnv();

import {
  appendHistory,
  nextTestId,
  readCatalog,
  writeCatalog,
} from "../server/storage.ts";
import type { TestRecord } from "../server/types.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FLOWS_ROOT = path.resolve(
  __dirname,
  "../../projects/polygonus/automation/maestro/flows",
);
const OUT_DIR = path.join(FLOWS_ROOT, "smoke", "menus");

type MenuSmoke = {
  ctId: string;
  title: string;
  module: string;
  /** Coord/Prof = PHJESUS coordenador; Resp = ETMENEZES */
  profile: "coord" | "resp";
  cardId?: string;
  /** Se setado, usa smoke_abrir_voltar_menu.yaml (texto) em vez de id */
  cardHomeText?: string;
  slug: string;
};

const ITEMS: MenuSmoke[] = [
  // Coord/Prof (perfil coordenador no smoke — mesmo PHJESUS)
  {
    ctId: "SMOKE-CAL",
    title: "SMOKE · Calendário",
    module: "Calendario",
    profile: "coord",
    cardId: "home_card_calendario",
    slug: "calendario",
  },
  {
    ctId: "SMOKE-NOTAS",
    title: "SMOKE · Notas",
    module: "Notas",
    profile: "coord",
    cardId: "home_card_notas",
    slug: "notas",
  },
  {
    ctId: "SMOKE-CONT-FREQ",
    title: "SMOKE · Conteúdo e Frequência",
    module: "ConteudoFrequencia",
    profile: "coord",
    cardId: "home_card_conteudo_frequencia",
    slug: "conteudo_frequencia",
  },
  {
    ctId: "SMOKE-TAREFAS",
    title: "SMOKE · Tarefas",
    module: "Tarefas",
    profile: "coord",
    cardId: "home_card_tarefas",
    slug: "tarefas",
  },
  {
    ctId: "SMOKE-OCORR",
    title: "SMOKE · Ocorrências",
    module: "Ocorrencias",
    profile: "coord",
    cardId: "home_card_ocorrencias",
    slug: "ocorrencias",
  },
  {
    ctId: "SMOKE-ALUNOS",
    title: "SMOKE · Meus Alunos",
    module: "MeusAlunos",
    profile: "coord",
    cardId: "home_card_meus_alunos",
    slug: "meus_alunos",
  },
  {
    ctId: "SMOKE-CARDAPIO",
    title: "SMOKE · Cardápio",
    module: "Cardapio",
    profile: "coord",
    cardHomeText: "CARDÁPIO|CARDAPIO|.*CARD[AÁ]PIO.*",
    slug: "cardapio",
  },
  // Responsável
  {
    ctId: "SMOKE-BOLETIM",
    title: "SMOKE · Boletim Online",
    module: "Boletim",
    profile: "resp",
    cardId: "home_card_boletim",
    slug: "boletim",
  },
  {
    ctId: "SMOKE-NOTAS-P",
    title: "SMOKE · Notas Parciais",
    module: "NotasParciais",
    profile: "resp",
    cardId: "home_card_notas_parciais",
    slug: "notas_parciais",
  },
  {
    ctId: "SMOKE-MENSAL",
    title: "SMOKE · Mensalidade",
    module: "Mensalidade",
    profile: "resp",
    cardId: "home_card_mensalidade",
    slug: "mensalidade",
  },
  {
    ctId: "SMOKE-CONT-LEC",
    title: "SMOKE · Conteúdo Lecionado",
    module: "ConteudoLecionado",
    profile: "resp",
    cardId: "home_card_conteudo_lecionado",
    slug: "conteudo_lecionado",
  },
  {
    ctId: "SMOKE-FREQ-AL",
    title: "SMOKE · Frequência do Aluno",
    module: "FrequenciaAluno",
    profile: "resp",
    cardId: "home_card_frequencia_aluno",
    slug: "frequencia_aluno",
  },
  {
    ctId: "SMOKE-DOCS",
    title: "SMOKE · Meus Documentos",
    module: "MeusDocumentos",
    profile: "resp",
    cardId: "home_card_meus_documentos",
    slug: "meus_documentos",
  },
  {
    ctId: "SMOKE-HORARIO",
    title: "SMOKE · Horário",
    module: "Horario",
    profile: "resp",
    cardId: "home_card_horario",
    slug: "horario",
  },
  {
    ctId: "SMOKE-TAR-CASA",
    title: "SMOKE · Tarefas para Casa",
    module: "TarefasCasa",
    profile: "resp",
    cardId: "home_card_tarefas_casa",
    slug: "tarefas_casa",
  },
  {
    ctId: "SMOKE-AV-CONH",
    title: "SMOKE · Avaliação do Conhecimento",
    module: "AvaliacaoConhecimento",
    profile: "resp",
    cardId: "home_card_avaliacao_conhecimento",
    slug: "avaliacao_conhecimento",
  },
  {
    ctId: "SMOKE-AV-HAB",
    title: "SMOKE · Avaliação de Habilidades",
    module: "AvaliacaoHabilidades",
    profile: "resp",
    cardId: "home_card_avaliacao_habilidades",
    slug: "avaliacao_habilidades",
  },
  {
    ctId: "SMOKE-NF",
    title: "SMOKE · Notas Fiscais",
    module: "NotasFiscais",
    profile: "resp",
    cardId: "home_card_notas_fiscais",
    slug: "notas_fiscais",
  },
  // Calendário também no resp — já coberto pelo SMOKE-CAL (coord). Resp tem o mesmo id.
];

function yamlFor(item: MenuSmoke): string {
  const auth =
    item.profile === "resp"
      ? "../../shared/auth/resume_etmenezes_responsavel.yaml"
      : "../../shared/auth/resume_phjesus_coordenador.yaml";

  const open = item.cardId
    ? `- runFlow:
    file: ../../shared/nav/smoke_abrir_voltar_menu_id.yaml
    env:
      CARD_ID: "${item.cardId}"`
    : `- runFlow:
    file: ../../shared/nav/smoke_abrir_voltar_menu.yaml
    env:
      CARD_HOME: "${item.cardHomeText}"`;

  return `# ${item.ctId} — smoke abrir/voltar menu (APK ≥ 6.06.14)
# Fora de escopo global: Aula Online, Chegando.

appId: br.com.polygonus.mobile.amostra
---
- runFlow: ${auth}

${open}
`;
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const catalog = await readCatalog("polygonus");
const now = new Date().toISOString().slice(0, 10);
let created = 0;
let skipped = 0;
let yamlWritten = 0;

for (const item of ITEMS) {
  const fileName = `${item.slug}.yaml`;
  const abs = path.join(OUT_DIR, fileName);
  fs.writeFileSync(abs, yamlFor(item), "utf8");
  yamlWritten++;

  const flowPath = `projects/polygonus/automation/maestro/flows/smoke/menus/${fileName}`;
  const testKey = `smoke/${item.slug}`;

  const exists = catalog.reports.find(
    (r) =>
      r.testKey === testKey ||
      r.automation?.flowPath?.replace(/\\/g, "/") === flowPath ||
      r.tags?.includes(`ct:${item.ctId}`),
  );
  if (exists) {
    console.log("skip", exists.id, exists.title);
    skipped++;
    continue;
  }

  const id = nextTestId("polygonus", catalog);
  const report: TestRecord = {
    id,
    testKey,
    recordType: "teste",
    title: item.title,
    description: `Smoke home: abrir ${item.title.replace(/^SMOKE · /, "")} e voltar (${item.profile === "resp" ? "ETMENEZES" : "PHJESUS coordenador"}).`,
    steps: [
      item.profile === "resp"
        ? "Login ETMENEZES responsável"
        : "Login PHJESUS coordenador",
      `Abrir tile ${item.cardId ?? "Cardápio (texto)"}`,
      "Voltar à home",
    ],
    expectedResult: "Menu abre e volta sem crash; home estável.",
    reportedAt: now,
    project: "polygonus",
    channel: "app",
    platform: "android",
    module: item.module,
    status: "rascunho",
    homologationStatus: "pendente",
    executionMode: "automated",
    priority: "media",
    evidence: [],
    comments: [],
    history: [],
    showInPortfolio: false,
    automation: {
      type: "maestro",
      flowPath,
      label: item.ctId,
      readiness: "ready",
    },
    tags: [
      "smoke",
      "home",
      `module:${item.module}`,
      "suite:Smoke",
      `ct:${item.ctId}`,
      "maestro",
      item.profile === "resp" ? "perfil:responsavel" : "perfil:coordenador",
    ],
  };

  appendHistory(report, {
    actor: "system",
    action: "test_created",
    detail: "CT smoke menu home (abrir/voltar)",
    meta: { testKey, flowPath },
  });
  catalog.reports.unshift(report);
  created++;
  console.log("create", id, item.title);
}

if (created > 0) {
  await writeCatalog("polygonus", catalog);
}

console.log({ yamlWritten, created, skipped, totalReports: catalog.reports.length });
