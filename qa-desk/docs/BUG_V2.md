# Bug v2 — especificação (rascunho para revisão)

Status: **implementado** (26/10/2026). Complementa o [padrão atual](BUG_REPORT.md), que continua valendo para handoff (Discord), visitante e `consolidated`.

Onde está no código: tipos em `src/types/test-record.ts` (`linkedTestIdOf`, `BUG_STATUS_ORDER`, `REPRODUCIBILITY_LABELS`), cartão em `src/components/BugCard.tsx`, rastreabilidade e modelo Gherkin em `src/components/BugTraceability.tsx`, handoff em `src/lib/bug-report-markdown.ts`, testes em `server/bug-v2.test.ts`.

## Objetivo

1. Escrever o bug no formato de **relatório de incidente** usado no mercado, para que qualquer QA, dev ou recrutador reconheça a estrutura.
2. Ligar o bug ao **caso de teste** e à **execução** em que ele apareceu (rastreabilidade).
3. Exibir o bug de forma **resumida**, expansível até o detalhe completo.

## Referências

| Referência | O que usamos dela |
|---|---|
| ISO/IEC/IEEE 29119-3 — *Incident Report* | Campos do bug: identificação, contexto, descrição, impacto, status |
| Glossário ISTQB | Separação **severidade** (impacto) × **prioridade** (urgência); termos *defeito* e *falha* |
| Gherkin (BDD, Cucumber) | Cenário do caso de teste em Dado / Quando / Então |

## O que muda em relação a hoje

| Hoje | v2 |
|---|---|
| Severidade e prioridade gravadas com o mesmo valor no editor | Campos independentes |
| Vínculo bug → teste só pela tag `origem:<id>` | Campos `linkedTestId` e `linkedRunId` |
| Caso de teste só com passos | Cenário Gherkin + passos detalhados opcionais |
| Status desenhados para o fluxo com o gestor | Ciclo de vida padrão, com o fluxo do gestor mapeado dentro dele |
| Sem reprodutibilidade | Campo `reproducibility` |
| Detalhe do bug é o editor inteiro | Leitura resumida → expandida; o editor fica para quem edita |

## 1. O bug (relatório de incidente)

### Campos

Campos **novos** marcados com ★. Os demais já existem em `TestRecord`.

| Grupo | Campo | Regra |
|---|---|---|
| Identificação | `bugCode` (APP-01), `id` | Já existe |
| | `title` | Sintoma em uma linha: **onde + o quê**. Ex.: "Mural — anexo PDF some após enviar" |
| Contexto | `channel`, `platform`, `module` | Já existe |
| | `build`, `runtimeEnv`, `unitLabel`, `osVersion`, `deviceLabel`, `browser` | Já existe; exibidos juntos como "Ambiente" |
| | `preconditions` | Já existe |
| Descrição | `stepsDetailed` | Passos para reproduzir, 1 ação por linha |
| | `expectedResult` × `actualResult` | Obrigatórios para sair de rascunho |
| | ★ `reproducibility` | `sempre` · `intermitente` · `uma_vez` |
| | `evidence[]`, `technicalEvidence` | Já existe |
| Impacto | `severity` | **Impacto no usuário/sistema** — ver tabela abaixo |
| | `priority` | **Urgência de corrigir** — independente da severidade |
| Rastreabilidade | ★ `linkedTestId` | Caso de teste que revelou o bug (opcional: bug exploratório não tem) |
| | ★ `linkedRunId` | Execução (`test_runs.id`) em que falhou |
| | `discordMessageId`, `discordSentAt` | Handoff ao time pelo Discord (`githubIssue*` fica só nos bugs antigos) |
| Status | `status` | Ciclo de vida da seção 3 |

### Severidade × prioridade

São perguntas diferentes, por isso campos diferentes:

| Severidade (impacto) | Quando usar |
|---|---|
| `critica` | Bloqueia uma função essencial, perde ou corrompe dados, sem contorno |
| `alta` | Função importante quebrada, com contorno difícil |
| `media` | Função funciona errado, com contorno razoável |
| `baixa` | Cosmético, texto, alinhamento |

| Prioridade (urgência) | Quando usar |
|---|---|
| `critica` | Corrigir já (hotfix) |
| `alta` | Próxima entrega |
| `media` | Planejar |
| `baixa` | Quando der |

Exemplo clássico: erro de digitação no nome da escola na tela de login → severidade **baixa**, prioridade **alta**.

Na migração, os bugs atuais mantêm o valor nos dois campos (já é assim hoje); só os novos passam a ser preenchidos separadamente.

## 2. O caso de teste (Gherkin + passos)

O caso de teste continua sendo `TestRecord` com `recordType = "teste"`. Ganha:

| Campo | Regra |
|---|---|
| ★ `scenario` | Cenário Gherkin (texto). Linguagem do negócio, sem cliques |
| `stepsDetailed` | Continua, **opcional**: o roteiro de execução (cliques, telas) e as âncoras Maestro |
| `preconditions`, `expectedResult` | Continuam; no Gherkin viram o *Dado* e o *Então* |

Exemplo (Mural):

```gherkin
Funcionalidade: Envio de comunicado no Mural

  Cenário: Coordenador envia comunicado com PDF para todas as turmas
    Dado que estou logado como coordenador no app
    E estou na tela de novo comunicado
    Quando escrevo o texto "Reunião de pais"
    E anexo o arquivo "pauta.pdf"
    E seleciono todas as turmas
    E envio o comunicado
    Então o comunicado aparece em "Enviadas" com o anexo "pauta.pdf"
```

Regra de escrita: **um cenário = um comportamento**. *Dado* é o estado inicial, *Quando* é a ação, *Então* é o resultado observável. Cliques e seletores ficam nos passos detalhados ou na automação, não no Gherkin.

## 3. Ciclo de vida do bug

```text
Rascunho → Novo → Confirmado → Em correção → Corrigido → Em reteste → Fechado
                     │                                       │
                     ├→ Não reproduzido                      └→ Reaberto → Em correção
                     └→ Rejeitado (não é bug / duplicado / sem correção)
```

Mapeamento dos status atuais (sem perder o fluxo do gestor):

| Atual | v2 |
|---|---|
| `rascunho` | Rascunho |
| `reportado` | Novo |
| `enviado_gestor` | Confirmado (enviado ao Discord) |
| `em_tratamento` | Em correção |
| `corrigido_gestor` | Corrigido → aguarda reteste |
| `homologado` | Fechado |
| `nao_reproduzido` | Não reproduzido |
| `sem_correcao`, `cancelado` | Rejeitado (motivo no histórico) |
| `arquivado` | Fechado (arquivado) |
| — | ★ Em reteste, ★ Reaberto |

**Em reteste** e **Reaberto** são os que faltam hoje: o bug corrigido volta para o QA, que roda de novo o teste vinculado. Se passar, fecha; se falhar, reabre e registra a nova execução.

## 4. Vínculo bug ↔ teste ↔ execução

```text
Caso de teste (Gherkin) ──► Execução (test_runs) ──falhou──► Bug
       ▲                                                      │
       └──────────────── reteste (nova execução) ◄────────────┘
```

- **Reportar bug a partir do teste** (já existe: `reportBugFromTest`) passa a gravar `linkedTestId` e, quando houver, o `linkedRunId` da última execução com falha — em vez da tag `origem:<id>`.
- Migração: bugs com tag `origem:<id>` ganham `linkedTestId = <id>`; a tag pode ficar.
- No caso de teste: seção **Bugs encontrados por este teste** (lista dos bugs com `linkedTestId` igual).
- Continua valendo o padrão atual: **nada de bug automático** a cada falha; a sugestão só para CT `consolidated`.

## 5. Exibição

### Resumida (lista, homologação, portfólio)

```text
┌────────────────────────────────────────────────────────────┐
│ APP-07  Mural — anexo PDF some após enviar                 │
│ [Severidade alta] [Prioridade média] [Em reteste]          │
│ Falhou no CT-MURAL-03 · execução 26/10 · Android 16 · 6.06 │
└────────────────────────────────────────────────────────────┘
```

Três linhas: identificação, impacto e status, rastreabilidade e ambiente. Clicar expande.

### Expandida (detalhe de leitura)

Seções, nesta ordem (a mesma do relatório Markdown do bug):

1. **Sintoma** — descrição
2. **Esperado × Obtido** — lado a lado
3. **Reproduzir** — pré-condições + passos + reprodutibilidade
4. **Evidências** — miniaturas
5. **Ambiente** — linha compacta
6. **Teste vinculado** — cenário Gherkin do CT + link da execução que falhou
7. **Histórico** — linha do tempo (status, reações do gestor no Discord)

O editor atual continua existindo para **editar**; a leitura deixa de exigir abrir o formulário inteiro.

### Visitante

O cartão resumido é o mesmo, com a sanitização atual (`sanitizeVisitorTestRecord`). O cenário Gherkin pode aparecer — não tem PII por construção.

## Fora de escopo (v2)

- Criar bug automaticamente a cada falha de execução
- Importar ou exportar `.feature` (Cucumber) — o Gherkin aqui é texto do caso de teste
- Rodar Gherkin como teste (step definitions)
- Métricas novas (densidade de defeitos, taxa de reabertura) — ficam para uma v3, depois que o ciclo de vida tiver dados

## Decisões da implementação

1. O CT de origem aparece só na linha de rastreabilidade do cartão; o `bugCode` não muda.
2. **Rejeitado** não ganhou campo próprio: o motivo está no próprio status (`Rejeitado · sem correção`, `Rejeitado · cancelado`) e o detalhe fica no histórico.
3. A lista de bugs tem filtros separados de status, severidade e prioridade.
4. A migração da tag `origem:<id>` é na leitura (`linkedTestIdOf`): nenhum dado antigo foi reescrito.
