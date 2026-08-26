/**
 * Homologação a partir do PDF "POLYGONUS_INCONSISTÊNCIAS NO SISTEMA 24 agosto 26".
 *
 *   cd qa-desk
 *   npx tsx scripts/seed-inconsistencias-diario-24ago.ts
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "../server/load-env.ts";

loadEnv();

import {
  appendHomologationHistory,
  createHomologation,
  findHomologationBySlug,
  linkTestsToHomologation,
  readHomologationCatalog,
  writeHomologationCatalog,
} from "../server/homologations.ts";
import {
  appendHistory,
  nextTestId,
  readCatalog,
  writeCatalog,
} from "../server/storage.ts";
import { findByTestKey } from "../server/test-key.ts";
import type { TestRecord } from "../server/types.ts";

const project = "polygonus" as const;
const SLUG = "inconsistencias-diario-tarefas-notas-24-08";
const now = new Date().toISOString();
const reportedAt = now.slice(0, 10);

const EVIDENCE_PDF =
  "projects/polygonus/evidence/homologacao-2026-08-24-inconsistencias/POLYGONUS_INCONSISTENCIAS_24_ago_26.pdf";

type Draft = Omit<TestRecord, "id" | "history" | "evidence"> & {
  testKey: string;
};

const DRAFTS: Draft[] = [
  {
    testKey: "academico/inc-diario-01",
    recordType: "teste",
    title: "INC-01 · Conteúdo: não consegue acrescentar no mesmo dia",
    description:
      "Relato 24/08: após registrar conteúdo no dia da aula, não foi possível acrescentar mais conteúdo mesmo ainda em sala / no mesmo dia de aplicação.",
    preconditions:
      "Professor com turma em aula no dia; conteúdo já lançado uma vez na data.",
    steps: [
      "Abrir Diário / Conteúdo lecionado (App ou WEB conforme o fluxo do professor)",
      "Registrar um conteúdo no dia da aula e gravar",
      "Ainda no mesmo dia, tentar acrescentar outro trecho/conteúdo à mesma aula",
      "Observar se permite editar/acrescentar ou bloqueia indevidamente",
    ],
    expectedResult:
      "Permitir acrescentar/editar conteúdo no mesmo dia da aula enquanto a janela de lançamento for válida.",
    reportedAt,
    project,
    channel: "app",
    platform: "app_web",
    module: "Diário",
    status: "rascunho",
    homologationStatus: "pendente",
    executionMode: "manual",
    priority: "alta",
    severity: "alta",
    campaign: SLUG,
    tags: [
      "homologacao",
      SLUG,
      "suite:Conteudo",
      "ct:INC-01",
      "module:Diário",
      "relato-24-08",
    ],
  },
  {
    testKey: "academico/inc-diario-02",
    recordType: "teste",
    title: "INC-02 · Horário de aula incorreto (aula dupla)",
    description:
      "Relato 24/08: aula dupla era 1º e 2º horários, mas a plataforma indicava 2º e 3º.",
    preconditions:
      "Turma com aula dupla cadastrada (1º+2º); professor no horário correto da grade.",
    steps: [
      "Identificar na grade oficial os horários reais da aula dupla",
      "Abrir o Diário / lançamento no App ou WEB no horário da aula",
      "Conferir o intervalo de horários exibido pela plataforma",
      "Comparar com a grade (ex.: esperado 1º+2º vs exibido 2º+3º)",
    ],
    expectedResult:
      "Horários exibidos batem com a grade da turma (aula dupla correta).",
    reportedAt,
    project,
    channel: "app",
    platform: "app_web",
    module: "Diário",
    status: "rascunho",
    homologationStatus: "pendente",
    executionMode: "manual",
    priority: "alta",
    severity: "media",
    campaign: SLUG,
    tags: [
      "homologacao",
      SLUG,
      "suite:Horario",
      "ct:INC-02",
      "module:Diário",
      "relato-24-08",
    ],
  },
  {
    testKey: "academico/inc-diario-03",
    recordType: "teste",
    title: "INC-03 · Lançamento de tarefa abre tarefa de outro dia",
    description:
      "Relato 24/08: ao lançar/abrir a tarefa a ser cobrada, a listagem abre outra tarefa (dia diferente).",
    preconditions: "Professor com mais de uma tarefa em datas distintas.",
    steps: [
      "Criar ou localizar tarefa do dia A",
      "Na listagem, tocar/abrir a tarefa do dia A",
      "Conferir título, data e conteúdo abertos",
      "Repetir com tarefa do dia B e verificar se não troca indevidamente",
    ],
    expectedResult:
      "Abrir a tarefa selecionada (mesma data/conteúdo), sem pular para outra data.",
    reportedAt,
    project,
    channel: "app",
    platform: "app_web",
    module: "Tarefas",
    status: "rascunho",
    homologationStatus: "pendente",
    executionMode: "manual",
    priority: "alta",
    severity: "alta",
    campaign: SLUG,
    tags: [
      "homologacao",
      SLUG,
      "suite:Tarefas",
      "ct:INC-03",
      "module:Tarefas",
      "relato-24-08",
    ],
  },
  {
    testKey: "academico/inc-diario-04",
    recordType: "teste",
    title: "INC-04 · Relatório de tarefa em branco vs não entregues futuros",
    description:
      "Relato 24/08: relatório do dia 17/08 veio todo em branco (sem tarefas), mas já marcava tarefas não entregues de alguns alunos nos dias 26 e 29/08 (ainda sem aula).",
    preconditions:
      "Acesso ao relatório de tarefas do professor; datas 17/08, 26/08 e 29/08 (ou equivalentes na amostra).",
    steps: [
      "Abrir relatório de tarefas referente a 17/08",
      "Conferir se tarefas lançadas aparecem ou se o relatório fica em branco",
      "Abrir/conferir marcação de não entregues em 26/08 e 29/08",
      "Validar se datas futuras sem aula não deveriam gerar cobrança indevida",
    ],
    expectedResult:
      "Relatório reflete o lançamento real; não marca não-entrega em dias sem aula/tarefa válida.",
    reportedAt,
    project,
    channel: "web",
    platform: "web",
    module: "Tarefas",
    status: "rascunho",
    homologationStatus: "pendente",
    executionMode: "manual",
    priority: "alta",
    severity: "alta",
    campaign: SLUG,
    tags: [
      "homologacao",
      SLUG,
      "suite:Tarefas",
      "ct:INC-04",
      "module:Tarefas",
      "relato-24-08",
      "relatorio",
    ],
  },
  {
    testKey: "academico/inc-diario-05",
    recordType: "teste",
    title: "INC-05 · Relação de tarefa sem entregue vs atraso",
    description:
      "Relato 24/08: a relação de tarefa não diferencia tarefas entregues das entregues com atraso.",
    preconditions:
      "Turma com ao menos uma entrega no prazo e uma entrega atrasada.",
    steps: [
      "Abrir a relação/listagem de tarefas do professor",
      "Localizar aluno que entregou no prazo e aluno com atraso",
      "Conferir se há status/indicação visual distinta (entregue × atrasado)",
    ],
    expectedResult:
      "Interface diferencia claramente entregue no prazo vs entregue com atraso.",
    reportedAt,
    project,
    channel: "app",
    platform: "app_web",
    module: "Tarefas",
    status: "rascunho",
    homologationStatus: "pendente",
    executionMode: "manual",
    priority: "media",
    severity: "media",
    campaign: SLUG,
    tags: [
      "homologacao",
      SLUG,
      "suite:Tarefas",
      "ct:INC-05",
      "module:Tarefas",
      "relato-24-08",
    ],
  },
  {
    testKey: "academico/inc-diario-06",
    recordType: "teste",
    title: "INC-06 · Tarefas somem ao abrir lançamento de notas",
    description:
      "Relato 24/08: a guia mostra registro de tarefa, mas ao marcar entregas / abrir lançamento de notas não há registro (indica que não teve tarefa).",
    preconditions: "Tarefa já registrada e visível na guia/listagem.",
    steps: [
      "Confirmar tarefa visível na guia/listagem",
      "Abrir o fluxo de lançamento de notas / marcar entregas",
      "Verificar se a tarefa continua listada para marcação",
      "Voltar à guia e conferir se o registro ainda existe",
    ],
    expectedResult:
      "Tarefa permanece disponível para marcação de entrega; não some ao abrir notas.",
    reportedAt,
    project,
    channel: "app",
    platform: "app_web",
    module: "Tarefas",
    status: "rascunho",
    homologationStatus: "pendente",
    executionMode: "manual",
    priority: "alta",
    severity: "alta",
    campaign: SLUG,
    tags: [
      "homologacao",
      SLUG,
      "suite:Tarefas",
      "ct:INC-06",
      "module:Tarefas",
      "relato-24-08",
    ],
  },
  {
    testKey: "academico/inc-diario-07",
    recordType: "teste",
    title: "INC-07 · Conteúdo no App some no dispositivo de mesa",
    description:
      "Relato 24/08: conteúdo registrado no App desaparece quando há acesso por dispositivo de mesa (desktop/WEB).",
    preconditions:
      "Mesmo professor/turma; App amostra + WEB/gestão (mesa) na mesma unidade/ano.",
    steps: [
      "No App, registrar conteúdo lecionado e gravar",
      "Confirmar conteúdo visível no App",
      "Abrir o mesmo recorte no dispositivo de mesa (WEB)",
      "Conferir se o conteúdo aparece ou sumiu",
      "Recarregar App e WEB para descartar cache",
    ],
    expectedResult:
      "Conteúdo gravado no App permanece visível no App e no acesso de mesa (mesma fonte).",
    reportedAt,
    project,
    channel: "app",
    platform: "app_web",
    module: "Diário",
    status: "rascunho",
    homologationStatus: "pendente",
    executionMode: "manual",
    priority: "critica",
    severity: "alta",
    campaign: SLUG,
    tags: [
      "homologacao",
      SLUG,
      "suite:Conteudo",
      "ct:INC-07",
      "module:Diário",
      "relato-24-08",
      "sync",
    ],
  },
  {
    testKey: "academico/inc-diario-08",
    recordType: "teste",
    title: "INC-08 · Notas no App: valor da atividade some (vermelho)",
    description:
      "Relato 24/08: no App, valor das atividades/avaliações some, notas ficam em vermelho; é preciso registrar o valor da atividade mais de uma vez.",
    preconditions: "Professor no App; lançamento de notas/atividades da turma.",
    steps: [
      "Abrir lançamento de notas no App",
      "Informar valor máximo/peso da atividade ou nota do aluno",
      "Gravar e reabrir a tela",
      "Observar se o valor permanece ou some (células vermelhas)",
      "Tentar relançar o valor e conferir persistência",
    ],
    expectedResult:
      "Valores de atividade/avaliação persistem após gravar; sem sumiço nem necessidade de lançar duas vezes.",
    reportedAt,
    project,
    channel: "app",
    platform: "android",
    module: "Notas",
    status: "rascunho",
    homologationStatus: "pendente",
    executionMode: "manual",
    priority: "critica",
    severity: "alta",
    campaign: SLUG,
    tags: [
      "homologacao",
      SLUG,
      "suite:Notas",
      "ct:INC-08",
      "module:Notas",
      "relato-24-08",
    ],
  },
  {
    testKey: "academico/inc-diario-09",
    recordType: "teste",
    title: "INC-09 · Relatório: quantidade de aulas divergente da grade",
    description:
      "Relato 24/08 (anexo): relatório mostra quantidade errada de aulas — ex. 11/08 (2 aulas → aparece 1) e 18/08 (2 aulas → aparece 3). Professor precisa de relatório confiável para responsáveis.",
    preconditions:
      "Grade com aulas duplas/simples conhecidas nas datas citadas (ou equivalentes na amostra).",
    steps: [
      "Anotar na grade quantas aulas existem em cada data (ex.: 11/08 e 18/08)",
      "Emitir o relatório usado pelo professor para responsáveis",
      "Comparar contagem de aulas por dia no relatório vs grade",
      "Registrar divergências (faltando ou sobrando aulas)",
    ],
    expectedResult:
      "Relatório lista a quantidade correta de aulas por dia, alinhada à grade.",
    reportedAt,
    project,
    channel: "web",
    platform: "web",
    module: "Diário",
    status: "rascunho",
    homologationStatus: "pendente",
    executionMode: "manual",
    priority: "alta",
    severity: "alta",
    campaign: SLUG,
    tags: [
      "homologacao",
      SLUG,
      "suite:Relatorio",
      "ct:INC-09",
      "module:Diário",
      "relato-24-08",
      "relatorio",
    ],
  },
];

const SCOPE = `## Fonte
PDF do relato: \`${EVIDENCE_PDF}\`
Título original: *Problemas e inconsistências no sistema polygonos* (24/08/2026).

## Escopo (só os itens do PDF)
1. Conteúdo — não acrescenta no mesmo dia
2. Horário de aula incorreto (aula dupla)
3. Tarefa abre outra (dia diferente)
4. Relatório de tarefa em branco × não entregues em datas futuras
5. Sem diferenciação entregue × atraso
6. Tarefas somem ao abrir notas
7. Conteúdo no App some no dispositivo de mesa
8. Valores de atividade/notas somem no App (vermelho)
9. Relatório com quantidade de aulas divergente da grade

## Como homologar hoje
- Reproduzir cada INC na amostra (App e/ou WEB conforme o CT).
- Evidência: print/vídeo + data/turma/login.
- Se confirmar: abrir bug Desk (APP/WEB) e, se for o caso, issue na KB.
- Se não reproduzir: marcar CT como passou / não reproduzido com nota.

## Fora deste recorte
Demais deploys do digest (chat encaminhada, conciliação, orçamento, histórico escolar) — não misturar nesta homologação.
`;

async function main() {
  const homCatalog = await readHomologationCatalog(project);
  let hom = findHomologationBySlug(homCatalog, SLUG);
  if (!hom) {
    hom = createHomologation(homCatalog, {
      project,
      title: "Inconsistências Diário/Tarefas/Notas — relato 24/08",
      description:
        "Homologação dos 8 itens (+ relatório de aulas) do PDF de inconsistências enviado em 24–25/08. Evidência: " +
        EVIDENCE_PDF,
      channel: "app",
      changeScope: "fullstack",
      testKeys: [],
    });
    hom.slug = SLUG;
    hom.campaign = SLUG;
    hom.scope = SCOPE;
  } else {
    hom.description =
      "Homologação dos 8 itens (+ relatório de aulas) do PDF de inconsistências enviado em 24–25/08. Evidência: " +
      EVIDENCE_PDF;
    hom.changeScope = "fullstack";
    hom.scope = SCOPE;
    if (!hom.channel) hom.channel = "app";
  }

  const catalog = await readCatalog(project);
  let created = 0;
  let updated = 0;
  const keys: string[] = [];

  for (const draft of DRAFTS) {
    keys.push(draft.testKey);
    const existing = findByTestKey(catalog, draft.testKey);
    if (existing) {
      Object.assign(existing, {
        title: draft.title,
        description: draft.description,
        preconditions: draft.preconditions,
        steps: draft.steps,
        expectedResult: draft.expectedResult,
        channel: draft.channel,
        platform: draft.platform,
        module: draft.module,
        tags: draft.tags,
        priority: draft.priority,
        severity: draft.severity,
        campaign: SLUG,
        homologationId: hom.id,
        homologationStatus: existing.homologationStatus ?? "pendente",
        executionMode: "manual",
        recordType: "teste",
      });
      appendHistory(existing, {
        at: now,
        actor: "Pedro",
        action: "updated",
        detail: "Atualizado a partir do PDF de inconsistências 24/08",
      });
      updated += 1;
      continue;
    }

    const id = nextTestId(project, catalog);
    const report: TestRecord = {
      ...draft,
      id,
      homologationId: hom.id,
      history: [
        {
          at: now,
          actor: "Pedro",
          action: "created",
          detail: "Criado a partir do PDF de inconsistências 24/08",
        },
      ],
      evidence: [],
    };
    catalog.reports.unshift(report);
    created += 1;
  }

  hom.testKeys = keys;
  const linked = linkTestsToHomologation(catalog, hom);
  appendHomologationHistory(hom, {
    actor: "system",
    action: "homologation_synced",
    detail: `Checklist PDF 24/08: ${keys.length} no escopo · ${created} novo(s) · ${updated} atualizado(s) · ${linked} vinculado(s)`,
  });

  await writeCatalog(project, catalog);
  await writeHomologationCatalog(project, homCatalog);

  console.log(`OK homologação ${hom.id} · slug=${hom.slug}`);
  console.log(`CTs: ${keys.length} · criados=${created} · atualizados=${updated}`);
  console.log(`UI: http://localhost:5174/projects/polygonus/homologacoes/${hom.slug}`);
  console.log(`PDF: ${EVIDENCE_PDF}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
