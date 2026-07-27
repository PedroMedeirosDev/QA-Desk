# Agente QA Desk (PC)

Console no seu PC que executa **Maestro**, **Playwright** e **emulador** a pedido do QA Desk online (`QA_AUTOMATION_RUN=0` na Oracle).

## Pré-requisitos

- Checkout deste repositório no PC
- Node.js, Maestro, Android SDK / emulador (mesmo setup do `QA_AUTOMATION_RUN=1` local)
- Token igual ao do servidor: `QA_AGENT_TOKEN`

## Configuração

No `.env` do **PC** (pasta `qa-desk/`):

```env
QA_AUTOMATION_RUN=1
QA_DESK_URL=https://qa-desk-pedro.duckdns.org
QA_AGENT_TOKEN=cole-o-mesmo-token-do-servidor
```

No **servidor** (Oracle / `.env` de produção):

```env
QA_AUTOMATION_RUN=0
QA_AGENT_TOKEN=mesmo-token
```

## Uso

```bash
cd qa-desk
npm run agent
```

Deixe o terminal aberto. A UI online mostra **Agente: online** e passa a:

- enfileirar **Executar** Maestro/Playwright
- aceitar **Ligar emulador**

Logs do job aparecem no console do agente e no stream da UI.

## Cancelar

O botão cancelar na web marca o job; o agente mata Maestro/Playwright no próximo ciclo (~2s).

## Variáveis opcionais

| Variável | Default | Função |
| --- | --- | --- |
| `QA_AGENT_POLL_MS` | `2500` | Intervalo entre claims |
| `QA_AGENT_HEARTBEAT_MS` | `15000` | Heartbeat (online se visto há menos de 45s) |
