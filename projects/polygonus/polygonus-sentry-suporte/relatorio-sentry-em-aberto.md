

## Caso 1 — Falha de conexão ao abrir o app

| Campo | Valor |
|--------|--------|
| **Event ID** | `2eb390701fba49f7bfc0c3bcfbe7d0c6` |
| **App** | Colégio Dom Bosco |
| **Build** | 6.05.24 (60524) |
| **Quando** | 25/05/2026, ~09:10 (Manaus) |
| **Plataforma** | Android 15 — Samsung Galaxy A14 5G |
| **Ambiente** | Produção |

### O que aconteceu

Ao abrir o app com login já salvo, uma chamada para atualizar a sessão do usuário (`POST /auth/entidade`) falhou por **queda ou interrupção da conexão** (*Software caused connection abort*).

O erro **não foi tratado na interface**: não há indício de mensagem amigável ao usuário. Foi registrado no Sentry como **fatal** e **não tratado**.

### Em que situação costuma ocorrer

Pelos registros da sessão, o cenário mais provável é:

1. Usuário **já logado** — o app tenta sincronizar ao abrir.
2. Rede **instável** ou **troca de rede** no meio do processo (no evento: começou em **dados móveis** e passou para **Wi‑Fi** enquanto as requisições rodavam).
3. Outras chamadas na sequência (menu, matrícula etc.) podem responder ou falhar antes; a que quebrou foi a de **atualização de entidade/sessão**.

Não parece timeout de 30 segundos nem “sem internet” clara — parece **conexão cortada no meio da requisição**, comum ao trocar de rede ou com sinal fraco.

### Impacto para o usuário

- App pode abrir “estranho”, sem feedback claro, ou parecer que travou na inicialização.
- Erro vai para o monitoramento como incidente grave, mesmo sendo situação de rede.

### Observação (contexto interno)

Há tratamento parecido para timeout e outros erros de rede no startup (`selecionarEntidade`), mas este tipo específico (`ClientException` / conexão abortada) **ainda escapa** desse fluxo na build 6.05.24.

### Sugestão 

Vale incluir esse tipo de falha de rede no mesmo tratamento dos demais erros de conexão no startup, para o usuário ver algo como *“Sem conexão com o servidor”* em vez de ir direto ao Sentry.

**Link Sentry:** https://sentry.io/organizations/polygonus/issues/?project=4511175512883200&query=2eb390701fba49f7bfc0c3bcfbe7d0c6

---

## Caso 2 — Falha de rede ao registrar conteúdo da aula (Diário de Classe)

| Campo | Valor |
|--------|--------|
| **Event ID** | `f42ead8c132d4eb7b27827cdff81358d` |
| **App** | Congregação de São Bento |
| **Build** | 6.05.24 (60524) |
| **Quando** | 25/05/2026, ~09:58 (São Paulo) |
| **Plataforma** | Android 14 — Samsung Galaxy S22 |
| **Ambiente** | Produção |

### O que aconteceu

Durante o uso do **Diário de Classe** (fluxo do professor), uma requisição para carregar ou salvar a **matéria diária** da aula falhou porque o celular **não conseguiu resolver o endereço do servidor** (*Failed host lookup / No address associated with hostname*).

A chamada era para `service.polygonus.com.br` — turma **8° Ano B**, disciplina **L.E.M - Inglês**, aula do dia **25/05/2026**, 4º horário.

O erro **não foi tratado na interface** e foi registrado no Sentry como **fatal** e **não tratado**.

### Em que situação costuma ocorrer

Pelos registros da sessão, o professor estava em pleno fluxo de trabalho:

1. Selecionou turma, disciplina, bimestre e dia letivo — várias consultas **funcionaram** normalmente.
2. Registrou conteúdo da aula (*“Páginas 65 e 66”*) — o **POST chegou a responder com sucesso** em alguns momentos.
3. Em seguida o app foi para **segundo plano** mais de uma vez (professor alternando entre apps ou bloqueando a tela).
4. O sistema Android sinalizou **pouca memória** duas vezes durante a sessão.
5. A rede estava em **dados móveis**, com qualidade variando; no momento do erro o aparelho aparecia **sem conexão** (`online: false`).
6. O app tentou **reenviar** a requisição várias vezes (`RETRY 0`, `1`, `2`), com intervalos longos entre tentativas, até estourar sem recuperação.

Ou seja: não parece bug de conteúdo ou de dados da turma — parece **perda de conectividade** (ou DNS indisponível) enquanto o professor usa o diário, especialmente com app em background e memória apertada.

### Impacto para o usuário

- Professor pode achar que o conteúdo da aula ou a frequência **não foi salvo**, sem nenhum aviso claro.
- Tela pode ficar em loading ou “parada” após voltar do segundo plano.
- Erro grave no monitoramento, embora a causa seja ambiental (rede/memória).

### Observação (contexto interno)

Fluxo relacionado ao **Diário de Classe** / lançamento de frequência e matéria diária. Diferente do Caso 1 (startup), mas mesma família: falha de rede **sem feedback** ao usuário.

### Sugestão 

Quando a rede cair nesse fluxo, o ideal seria o app avisar o professor (ex.: *“Sem conexão — tente novamente”*) em vez de deixar a operação pendurada e ir ao Sentry.

**Link Sentry:** https://sentry.io/organizations/polygonus/issues/?project=4511175512883200&query=f42ead8c132d4eb7b27827cdff81358d

---


