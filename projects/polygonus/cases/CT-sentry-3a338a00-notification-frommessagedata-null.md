# CT — Sentry `3a338a00` — `NotificationData.fromMessageData` (null não é String)

**Tipo:** Regressão / incidente Sentry  
**Plataforma:** Android  
**Prioridade:** Média-Alta  
**Origem:** Issue `3a338a00` — fix **6.05.15**: null-safety em `params` + helper `_obterValorMensagem`  
**Relacionado:** `cb1d5a2b` (duplicata no rastreamento da empresa)

## Objetivo

Homologar que **push** com `message.data` contendo **campos null** (ex.: `params`) **não** causa `TypeError` ao parsear notificação.

## Pré-requisitos

- Build **6.05.15+**.  
- Meio de enviar push de teste com payload parcial/null conforme roteiro Firebase/time.

## Passos

1. Colocar app em **background** por período prolongado (opcional: condições de baixa memória se ambiente permitir).  
2. Receber notificação de teste com dados incompletos (null em chaves que antes eram cast direto para `String`).  
3. Trazer app a **foreground** após `SCREEN_ON` / ciclo similar ao incidente.

## Resultado esperado

- App continua estável; dados ausentes viram string vazia ou equivalente seguro.

## Evidência

- Log interno ou confirmação Sentry sem novo evento + build.

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
| descricao_erro (suporte) | App fecha ao receber notificação push com dados incompletos. |
| descricao_solucao | |
