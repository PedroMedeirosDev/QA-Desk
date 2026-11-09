# Integração com o Slack

Socket Mode: o bot se conecta ao Slack (sem endereço público nem webhook). Mesmo núcleo da captura do Discord (`server/captura-core.ts`).

## O que faz

| Onde | O quê |
|---|---|
| `#demandas` | Mensagem sua (texto e/ou anexos) vira demanda. Link de mensagem do Discord da empresa colado no texto vira o "link original" da pendência. |
| `#bugs` | Mensagem sua vira bug em rascunho (APP). |
| `#entrada` | Mensagem sua (texto e/ou print) é classificada como bug, sugestão, demanda, dúvida ou configuração. O bot responde na thread com o tipo provável, título, registros parecidos e os botões **Bug / Demanda / Sugestão / Descartar**. Nada é gravado antes do seu clique. |
| `#avisos` | Resumo de cada importação da suíte web (`npm run importar:playwright`). |
| `/pendencias [pessoa]` | Pendências com a pessoa (padrão: o gestor), numeradas com nome e link. |
| `/demandas` | Demandas abertas. |
| `/suite` | Execuções das últimas 24 h: passou, falhou e quais falharam. |

Respostas dos comandos são visíveis só para você. Mensagens e comandos de outras pessoas são ignorados.

## Configuração

1. Criar o app em `api.slack.com/apps` → **From a manifest** (manifesto no histórico do chat de 06/11 ou abaixo).
2. **App-Level Token** com `connections:write` (`xapp-…`) e instalar no workspace (`xoxb-…`).
3. `/invite @QA Desk` em `#demandas`, `#bugs`, `#entrada` e `#avisos`.
   Botões (lembretes e entrada) exigem **Interactivity & Shortcuts** ligado no app.
4. `.env` (nunca no chat):

```env
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
SLACK_DEMANDAS_CHANNEL_ID=C...
SLACK_BUGS_CHANNEL_ID=C...
SLACK_AVISOS_CHANNEL_ID=C...
SLACK_DONO_USER_ID=U...
SLACK_ATIVO=1   # só em UMA máquina
```

`SLACK_ATIVO` liga a captura e os comandos. Os avisos do importador só precisam do token e do canal de avisos.

### Canal de entrada (classificação)

```env
SLACK_ENTRADA_CHANNEL_ID=C...
XAI_API_KEY=xai-...              # opcional: sem ela, classifica por regras locais
XAI_MODEL=grok-4.7               # opcional
IA_OCULTAR_TERMOS=Carmo,Viçosa   # opcional: termos extras a ocultar (escolas, clientes)
```

O print é lido **no computador** (OCR local). Para o Grok vai **só o texto**, depois de `filtrarParaIaExterna` (`server/classificacao.ts`): além de CPF, CNPJ, telefone e e-mail, saem links, nomes (sequências com maiúscula, menções, saudações e autor de chat), valores em R$, números com 5 ou mais dígitos e os termos de `IA_OCULTAR_TERMOS`. A imagem nunca sai. Se o Grok falhar ou responder fora do esquema, valem as regras locais.

A proposta vale 24 h e fica só na memória: se o QA Desk reiniciar, mande a mensagem de novo.

## Manifesto

```yaml
display_information:
  name: QA Desk
features:
  bot_user: { display_name: QA Desk, always_online: true }
  slash_commands:
    - { command: /pendencias, description: Pendências com uma pessoa, usage_hint: "[pessoa]" }
    - { command: /demandas, description: Demandas abertas }
    - { command: /suite, description: Última execução de testes }
oauth_config:
  scopes:
    bot: [chat:write, channels:history, groups:history, files:read, reactions:write, commands]
settings:
  event_subscriptions:
    bot_events: [message.channels, message.groups]
  interactivity:
    is_enabled: true
  socket_mode_enabled: true
```
