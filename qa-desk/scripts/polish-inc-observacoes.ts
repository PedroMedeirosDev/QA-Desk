/**
 * Revisa observações dos INC da campanha 24/08 (clareza para suporte/cliente).
 *
 *   cd qa-desk
 *   npx tsx scripts/polish-inc-observacoes.ts
 */
import { loadEnv } from "../server/load-env.ts";

loadEnv();

import { appendHistory, readCatalog, writeCatalog } from "../server/storage.ts";

const updates: Record<string, string> = {
  "academico/inc-diario-01":
    "Testei no Android e consegui acrescentar e editar o conteúdo normalmente, tanto na tela de lançamento de conteúdo quanto na de tarefas, ainda no mesmo dia — sem bloqueio.",
  "academico/inc-diario-02":
    "Testei no app, na turma do 7º ano: aparecem apenas as aulas 1 e 2; não há aula 3 listada — e isso bate com o cadastro dessa turma. A diferença do relato (horários 2º e 3º em vez de 1º e 2º) pode ter ocorrido se, no momento, estava sendo visualizada outra turma da mesma série, com quadro de horários diferente.\n\nPara confirmar, precisamos: (1) perguntar ao cliente qual turma e data estavam abertas quando viu o horário errado; (2) um print ou vídeo da tela de conteúdo/horário mostrando a turma selecionada e os horários exibidos; (3) se possível, um print da grade/quadro de horários dessa turma no mesmo dia. Sem isso, não dá para afirmar o problema.",
  "academico/inc-diario-06":
    "Hoje, a tela de lançamento de notas não tem ligação com o registro de tarefas — são áreas separadas. Também vale confirmar se a intenção era falar de faltas (e não de notas). Mesmo considerando faltas, o comportamento descrito não foi reproduzido nos testes.\n\nPara confirmar, precisamos: (1) perguntar ao cliente se o problema foi ao abrir notas ou faltas; (2) um print ou vídeo mostrando a guia com a tarefa registrada e, em seguida, a tela em que a tarefa “some” ou aparece como se não houvesse registro; (3) informar turma, data e login usados. Sem essa evidência, não dá para comprovar o caso.",
  "academico/inc-diario-08":
    "Pelo relato, o caso parece ser do lançamento pela WEB quando a sessão expira (é preciso informar de novo o valor da atividade). Foi feita uma nova tela de lançamento de notas, que mantém o trabalho por mais tempo e mostra melhor o que ainda falta gravar.\n\nPara confirmar, precisamos: (1) perguntar ao cliente se usava App ou WEB, e se a sessão tinha “caído” / pedido login de novo; (2) um print ou vídeo no momento em que o valor da atividade some e a nota fica vermelha; (3) turma, disciplina/avaliação e data. Se for sessão expirada na WEB, a correção já está na tela nova. Se não for isso, com essas evidências conseguimos investigar de novo.",
  "academico/inc-diario-09":
    "Há um equívoco sobre o relatório: o print anexado é do relatório de tarefas, não do de aulas. O professor pode cadastrar mais de uma tarefa no mesmo dia, então o número de tarefas pode ser maior que o de aulas. As datas de entrega das avaliações já foram atualizadas pela professora, e o sistema reflete essas datas corretamente.",
};

async function main() {
  const catalog = await readCatalog("polygonus");
  let n = 0;
  for (const [key, text] of Object.entries(updates)) {
    const t = catalog.reports.find((r) => r.testKey === key);
    if (!t) {
      console.log("ausente:", key);
      continue;
    }
    if (t.actualResult === text) {
      console.log("já ok:", key);
      continue;
    }
    t.actualResult = text;
    appendHistory(t, {
      actor: "Pedro",
      action: "updated",
      detail: "Observação revisada para clareza (relatório ao suporte/cliente)",
    });
    n += 1;
    console.log("atualizado:", key);
  }
  await writeCatalog("polygonus", catalog);
  console.log(`Gravado: ${n} observação(ões).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
