# CT — Sentry `cb1d5a2b` — `NotificationData.fromMessageData` (null / background / LOW_MEMORY)

**Tipo:** Regressão / incidente Sentry  
**Plataforma:** Android  
**Prioridade:** Média-Alta  
**Origem:** Issue `cb1d5a2b` — empresa classifica como **duplicata** de `3a338a00`; mesmo fix **6.05.15**

## Objetivo

Repetir cenário enriquecido do incidente: app **horas em background**, bateria baixa / **LOW_MEMORY**, depois **push** com campo null — confirmar que não há crash (coberto pelo mesmo fix que `3a338a00`).

## Pré-requisitos

- Build **6.05.15+**.  
- Push de teste + transição `DREAMING_STOPPED → SCREEN_ON → foreground` se reproduzível em lab.

## Passos

1. Homologar primeiro `CT-sentry-3a338a00-notification-frommessagedata-null.md`.  
2. Se o time exigir evidência separada por ID Sentry: repetir com cenário de longa permanência em background.  
3. Registrar no Sheets **mesma** `versao_corrigida`/`descricao_solucao` se o comportamento for idêntico ao `3a338a00`.

## Resultado esperado

- Mesmo que `3a338a00`: sem `TypeError` em `fromMessageData`.

## Evidência

- Notas + build; pode compartilhar evidência com o CT `3a338a00` com referência cruzada.

## Execução

| Data | Build | Executor | Resultado | Notas |
|------|-------|----------|-----------|--------|
| | | | | |

## Registro para suporte / Sheets

| Campo | Valor |
|--------|--------|
| versao_com_problema (referência) | 6.05.10 |
| versao_corrigida | |
| data_correcao | |
| descricao_erro (suporte) | Crash ao processar dados de notificação push após longo período em segundo plano. |
| descricao_solucao | |
