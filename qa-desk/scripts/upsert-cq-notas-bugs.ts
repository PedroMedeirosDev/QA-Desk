/**
 * Cria/atualiza os 2 bugs da homologação CQ Notas parciais (canal WEB).
 *
 *   cd qa-desk
 *   npx tsx scripts/upsert-cq-notas-bugs.ts
 */
import { loadEnv } from "../server/load-env.ts";

loadEnv();

import {
  appendHistory,
  nextBugCode,
  nextBugId,
  readCatalog,
  writeCatalog,
} from "../server/storage.ts";
import type { TestRecord } from "../server/types.ts";

const project = "polygonus" as const;
const now = new Date().toISOString();
const reportedAt = now.slice(0, 10);

const KEY_CONCEITO = "academico/bug-cq-conceito-av";
const KEY_AMARELO = "academico/bug-cq-celula-amarela";

function common(): Pick<
  TestRecord,
  | "recordType"
  | "project"
  | "channel"
  | "platform"
  | "module"
  | "status"
  | "executionMode"
  | "campaign"
  | "showInPortfolio"
  | "browser"
  | "testLogin"
  | "reportedAt"
> {
  return {
    recordType: "bug",
    project,
    channel: "web",
    platform: "web",
    module: "Acadêmico",
    status: "rascunho",
    executionMode: "manual",
    campaign: "diario-cq-homologacao",
    showInPortfolio: false,
    browser: "Opera",
    testLogin: "SUPPETER",
    reportedAt,
  };
}

const drafts: Array<Omit<TestRecord, "id" | "history" | "evidence" | "bugCode">> = [
  {
    ...common(),
    testKey: KEY_CONCEITO,
    title: "Notas parciais (WEB): não lança conceito nas avaliações (AV1, AV2…)",
    description:
      "Na gestão React (Amostra), as colunas das avaliações (AV1, AV2…) não aceitam conceito. Ao digitar A, B ou C, a letra não aparece no campo — só número (e NF).\n\nA turma está em conceito: a API devolve A, B e C em tiposConceito. A aluna Ana Carolina já tem C na AV1 (lançado no sistema antigo); isso só exibe, não dá para alterar nem lançar nas outras AVs.\n\nDois comportamentos na mesma tela (não misturar):\n1) Se a linha Pontos da avaliação estiver vazia, a célula fica bloqueada (“Defina a nota máxima da avaliação”). Preencher Pontos e Gravar libera o campo.\n2) Com a célula liberada, a digitação ainda recusa letra.\n\nA coluna Conceito no fim da linha é outro campo (conceito da etapa). Não substitui o lançamento na AV.\n\nTela já publicada no Amostra.",
    preconditions:
      "Amostra — gestão WEB React. Login SUPPETER. Curso EM, grade 2026-EM, período 3aS, turma M3A26, situações Ativo, etapa B3 (3º bimestre), disciplina Química.",
    expectedResult:
      "Dá para lançar A, B ou C nas colunas AV, como no lançamento antigo. Conceito já gravado permanece e pode ser alterado.",
    actualResult:
      "A letra não aparece ao digitar. Só entra número. O C da Ana na AV1 continua visível (dado antigo). Com Pontos vazio, a AV fica bloqueada (editavel false). Com Pontos preenchido, a letra continua sem entrar.",
    steps: [
      "Abrir Acadêmico → Avaliação → Notas parciais",
      "Selecionar: EM, 2026-EM, 3aS, M3A26, Ativo, B3, Química",
      "Conferir AV1 da Ana Carolina Teixeira de Menezes: já mostra C",
      "Clicar na AV2 (ou outra AV vazia) e digitar B",
      "Observar se a letra permanece no campo",
      "Se a célula estiver bloqueada: preencher Pontos da avaliação, clicar em Gravar, e tentar digitar a letra de novo",
    ],
    priority: "critica",
    severity: "alta",
    technicalEvidence:
      "GET …/notas_parciais/lancamento/grid?id_turma=45063 → contexto.tiposConceito = A/B/C. Ana: notas[].valor = C, editavel = false, motivoBloqueio = Defina a nota máxima da avaliação. Front filtra letra no onChange da AV (só dígito/vírgula/NF). Backend já aceita sigla na gravação.",
    tags: ["cq", "notas-parciais", "conceito", "web"],
  },
  {
    ...common(),
    testKey: KEY_AMARELO,
    title: "Notas parciais (WEB): célula continua amarela após Gravar",
    description:
      "Na gestão React (Amostra), o amarelo na célula significa alteração ainda não gravada.\n\nDepois de clicar em Gravar com sucesso, o rodapé passa a “Nenhuma alteração pendente”, mas a célula da nota (e às vezes a linha Pontos da avaliação) continua amarela. O botão Gravar segue clicável.\n\nNão misturar com o WEB-01 (conceito nas AVs).",
    preconditions:
      "Amostra — gestão WEB React. Login SUPPETER. Curso EM, grade 2026-EM, período 3aS, turma M3A26, situações Ativo, etapa B3 (3º bimestre), disciplina Química (ou História, se a Química estiver só em conceito).",
    expectedResult:
      "Após Gravar sem recusa, as células voltam à cor padrão e o rodapé permanece em “Nenhuma alteração pendente”.",
    actualResult:
      "Rodapé: Nenhuma alteração pendente. Célula da AV (e/ou Pontos) continua amarela. Gravar continua habilitado.",
    steps: [
      "Abrir Acadêmico → Avaliação → Notas parciais",
      "Selecionar: EM, 2026-EM, 3aS, M3A26, Ativo, B3, Química",
      "Alterar a nota de um aluno numa coluna AV (ex.: AV2 da Ana Carolina Teixeira de Menezes)",
      "Conferir: célula amarela e rodapé “Alterações não gravadas”",
      "Clicar em Gravar e esperar o toast de sucesso",
      "Conferir: rodapé “Nenhuma alteração pendente” e se a célula (e a linha Pontos) voltou à cor padrão",
    ],
    priority: "media",
    severity: "media",
    technicalEvidence:
      "Gravar só zera o flag dirty do rodapé. Não atualiza o baseline das células (amarelo = valor ≠ baseline). Excluir zera a chave e refaz o seed; Gravar não. Seed só na troca turma|etapa|disciplina.",
    tags: ["cq", "notas-parciais", "ui", "web"],
  },
];

const catalog = await readCatalog(project);
let created = 0;
let updated = 0;

for (const draft of drafts) {
  const existing = catalog.reports.find((r) => r.testKey === draft.testKey);
  if (existing && draft.testKey === KEY_CONCEITO) {
    console.log(`Pula ${existing.bugCode ?? existing.id} (texto do Pedro)`);
    continue;
  }
  if (existing) {
    const { id, bugCode, evidence, history } = existing;
    Object.assign(existing, draft, { id, bugCode, evidence, history });
    appendHistory(existing, {
      actor: "qa",
      action: "updated",
      detail: "Passos completos e filtros (WEB-02)",
    });
    updated++;
    console.log(`Atualizado ${existing.bugCode ?? existing.id}`);
  } else {
    const record: TestRecord = {
      ...draft,
      id: nextBugId(project, catalog),
      bugCode: nextBugCode(catalog, "web", "web"),
      evidence: [],
      comments: [],
      history: [],
    };
    appendHistory(record, {
      actor: "qa",
      action: "created",
      detail: "Homologação CQ Notas parciais (Amostra React)",
    });
    catalog.reports.unshift(record);
    created++;
    console.log(`Criado ${record.bugCode} ${record.id}`);
  }
}

catalog.meta.updatedAt = reportedAt;
await writeCatalog(project, catalog);
console.log(`OK ${created} novo(s), ${updated} atualizado(s). Abrir Polygonus → WEB → Bugs`);
