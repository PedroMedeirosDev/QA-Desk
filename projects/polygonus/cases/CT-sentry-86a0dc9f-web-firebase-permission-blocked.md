# CT — Sentry `86a0dc9f` — Flutter Web `firebase_messaging/permission-blocked`

**Tipo:** Regressão / incidente Sentry  
**Plataforma:** Web (Chrome)  
**Prioridade:** Média  
**Origem:** Issue `86a0dc9f` — fix **6.05.16**: `.catchError()` na cadeia de `requestPermission()` em `web_main.dart`

## Objetivo

Homologar com **notificações bloqueadas no navegador** que o app **inicia normalmente** e **não** envia `FirebaseException(permission-blocked)` ao Sentry.

## Pré-requisitos

- Build **6.05.16+** web.  
- Chrome com notificações **bloqueadas** para o domínio de teste.

## Passos

1. Bloquear notificações do site antes de abrir o app.  
2. Carregar o app; completar fluxo inicial que chama `notificationController.requestPermission()`.  
3. Verificar console/Sentry (ambiente de staging se disponível).

## Resultado esperado

- App funcional sem notificações; exceção tratada silenciosamente no fluxo.

## Evidência

- Print das permissões do site + tela do app carregada.

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
| descricao_erro (suporte) | Erro ao iniciar o app no navegador quando notificações estão bloqueadas. |
| descricao_solucao | |
