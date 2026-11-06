# Captura de demandas e bugs pelo Discord — especificação (rascunho para revisão)

Status: **proposta**, nada implementado.

## Problema

Demandas e bugs chegam pelo Discord da empresa (suporte, gestor, escolas) e se perdem: registrar no QA Desk à mão dá trabalho, e o resto fica na memória. A empresa não usa ferramenta de tarefas e não vai aceitar um bot no servidor dela.

## Solução

**Encaminhar** a mensagem (recurso nativo do Discord) para um servidor pessoal. O bot **QA Desk**, que só existe nesse servidor, transforma a mensagem em registro no QA Desk.

| Canal (servidor "QA Desk") | Vira | Id |
|---|---|---|
| `#demandas` | Demanda | `1564623854859452536` |
| `#capturas` | Bug em rascunho | `1564623891954012210` |
| `#painel` | Painel fixo com botões e menus | `1564630421558394921` |

```text
Discord da empresa ──encaminhar──► #demandas ──bot──► Demanda no QA Desk ──► ✅ + link
                                   #capturas ──bot──► Bug (rascunho)     ──► ✅ + link
QA Desk ──captura rápida (uma frase + Enter)──► Demanda
```

O bot nunca entra no servidor da empresa: só lê o que for encaminhado para o servidor pessoal.

## A demanda

| Campo | Regra |
|---|---|
| `codigo` | Sequencial público: `D-001`, `D-002`… (o que se fala com as pessoas) |
| `titulo` | Primeira linha do texto (até 120 caracteres); editável |
| `texto` | Mensagem encaminhada, com o mascaramento de dados pessoais (`redact-pii`) |
| `status` | `a_fazer` · `fazendo` · `aguardando` (alguém de fora) · `feito` |
| `solicitante` | Autor da mensagem original, quando o Discord informar |
| `comQuem` | Pessoa de quem a demanda depende (ex.: Moacir, Sandra); obrigatório em `aguardando` |
| `origem` | `discord` (com link da mensagem encaminhada e data original) ou `manual` |
| `anexos` | Prints e arquivos da mensagem, guardados no Storage (o link do Discord expira) |
| `bugId` | Preenchido quando a demanda vira bug |
| `criadaEm`, `atualizadaEm`, `historico` | Automáticos |

Persistência: tabela `demandas` no Postgres (Prisma), como a de testes — colunas indexadas + `payload` JSON. No modo JSON local, `data/projects/polygonus/demandas.json`.

## O bug capturado

Mensagem em `#capturas` vira `TestRecord` com `recordType: "bug"`, `status: "rascunho"`, título da primeira linha, texto em `description`, anexos em `evidence[]` e tag `captura:discord`. Você completa no formato Bug v2 (passos, esperado × obtido, severidade, prioridade) antes de mudar o status.

## Resposta no Discord

- Deu certo: o bot reage ✅ na mensagem e responde com o link no QA Desk.
- Deu errado: reage ❌ e responde com o motivo (ex.: "mensagem sem texto nem anexo").
- Mensagem que não é encaminhada também vale: escrever direto no canal cria do mesmo jeito.

## A tela de Demandas (admin)

- Item **Demandas** na sidebar do Polygonus, só para admin (o visitante nunca vê: tem dado da empresa).
- Topo: **captura rápida** — um campo, Enter cria a demanda.
- Lista agrupada por status, com contagem e "parada há N dias" nas que estão em `aguardando`.
- Detalhe: texto, origem com link, anexos, histórico, botões de status e **Virar bug** (abre o editor de bug já preenchido, com o vínculo).

## Pendências com uma pessoa ("o que eu tenho de pendência com você?")

Na tela de Demandas, o filtro **Com quem** lista tudo o que depende de uma pessoa, numerado, e o botão **Copiar lista** gera o texto para colar no Discord. Só **o nome e o link da mensagem**:

```text
1. Limite de 4 lançamentos na composição da venda (Carmo) — https://discord.com/channels/…
2. APP-07 Mural: anexo PDF some após enviar — https://discord.com/channels/…
3. Caixa Comunidade IMMC: confirmar conta contábil — https://discord.com/channels/…
```

O link é o da **mensagem original** no servidor da empresa, não o da cópia no servidor pessoal: a mensagem encaminhada guarda a referência (servidor, canal e mensagem) de onde veio. Sem referência (demanda criada à mão), a linha sai só com o nome.

A lista junta duas fontes:

- **Demandas** com `status = aguardando` e `comQuem` = a pessoa;
- **Casos do Repasse** com status `pendente`, quando a pessoa é o gestor (link = `discordUrl` do caso).

Ordem: a mais antiga primeiro. O código `D-nnn` e a data ficam na tela do QA Desk, fora do texto copiado.

## Comandos e painel no Discord (clicar em vez de digitar)

Tudo pela mesma conexão do bot (eventos `interactionCreate`), sem webhook nem endereço público. As respostas de consulta são **efêmeras**: só você vê.

**Painel fixo** — mensagem do bot fixada num canal `#painel`, com:

| Componente | O que faz |
|---|---|
| Menu **Pendências com…** (lista de pessoas já usadas em `comQuem`) | Responde a lista numerada da seção anterior, dentro de um bloco de código, pronta para copiar |
| Botão **Minhas abertas** | Demandas `a_fazer` e `fazendo`, numeradas |
| Botão **Nova demanda** | Abre um formulário (título, texto, com quem) e cria a demanda |

**Botões na confirmação de cada captura** — a resposta do bot em `#demandas` traz **Fazendo**, **Aguardando…** (abre o menu de pessoas), **Feito** e **Virar bug**. O status muda no QA Desk na hora e a mensagem do bot é atualizada.

**Comando de texto, como atalho:** `/pendencias pessoa:Moacir` dá o mesmo resultado do menu. Os comandos são registrados só no servidor pessoal (aparecem na hora, sem espera de propagação).

Só o dono do bot pode usar os botões e comandos (conferência pelo id do usuário), mesmo que alguém seja convidado para o servidor.

## Padronizar com IA (sob demanda)

Botões **Gerar Gherkin** e **Formatar como bug v2**, na demanda (tela e Discord) e no bug capturado:

- Gherkin: transforma a descrição livre em `Funcionalidade` / `Cenário` / `Dado` / `Quando` / `Então`, declarativo (sem cliques).
- Bug v2: separa sintoma, passos, esperado × obtido e sugere severidade e prioridade, com o motivo.
- O resultado entra como **rascunho**, ao lado do texto original, e só vale depois que você aceitar ou editar. A IA nunca muda status nem sobrescreve o que você escreveu.
- **Nenhum dado sensível chega à IA.** O filtro roda no servidor do QA Desk, antes de qualquer chamada, em três camadas:
  1. `redact-pii`: CPF, CNPJ, telefone e e-mail viram `[CPF]`, `[CNPJ]`, `[TELEFONE]`, `[EMAIL]`;
  2. nomes e identificadores conhecidos viram marcadores neutros (`[PESSOA_1]`, `[ESCOLA]`, `[LOGIN]`, `[RA]`): solicitante, `comQuem`, autores e menções do Discord, logins e RAs (sequências numéricas longas), mais uma lista de termos bloqueados configurável (nomes de escolas e unidades);
  3. trava final: se, depois das camadas 1 e 2, o texto ainda tiver sequência numérica longa, e-mail ou um termo da lista, **a chamada é cancelada** e a tela mostra o trecho que barrou.
- **Prévia obrigatória:** antes de enviar, a tela mostra exatamente o texto filtrado que vai sair. Só envia depois que você confirmar.
- A resposta da IA volta com os marcadores; os nomes reais não são recolocados automaticamente.
- Só roda quando você clica (sem custo parado).

Provedor: **a definir** (precisa de chave de API; não há nenhuma configurada).

## Uma instância só

O mesmo token no PC (`npm run dev`) e na VM faria cada mensagem ser capturada duas vezes. A captura só liga com `DISCORD_CAPTURA_ATIVA=1`, definida **apenas no `.env` da VM**. No PC, o bot de captura fica desligado, salvo para teste com o servidor de produção parado.

## Variáveis

| Variável | Onde |
|---|---|
| `DISCORD_BOT_TOKEN` | já existe |
| `DISCORD_CAPTURA_DEMANDAS_CHANNEL_ID`, `DISCORD_CAPTURA_BUGS_CHANNEL_ID` | `.env` local e da VM |
| `DISCORD_CAPTURA_ATIVA=1` | só na VM |
| Intent **Message Content** | ligada no portal (já feito) |

## Fora de escopo agora

- IA para resumir o dia ou achar recorrência — depois, quando houver dado registrado. (A padronização em Gherkin / bug v2 entra, ver acima.)
- Prazo e prioridade na demanda.
- Notificação ativa (o bot avisar o que está parado). Primeiro, o resumo na tela.
