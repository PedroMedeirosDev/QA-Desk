# CT — Sentry `fcfdd4f8` — iOS `ERROR_ALREADY_REQUESTING_PERMISSIONS` (gravador / chat áudio)

**Tipo:** Regressão / incidente Sentry  
**Plataforma:** iOS  
**Prioridade:** Média  
**Origem:** Issue `fcfdd4f8` — fix **6.05.16**: `_recorderOpening` **estático** em `mobile_audio_player.dart`

## Objetivo

Homologar que **múltiplas instâncias** de player de áudio em lista longa **não** disparam pedidos simultâneos de permissão de microfone.

## Pré-requisitos

- Build **6.05.16+** no iOS físico.  
- Chat com **muitas** mensagens de áudio (scroll rápido).

## Passos

1. Abrir conversa com lista longa de áudios.  
2. Scroll rápido para forçar `initialize()` em várias células.  
3. Conceder permissão na primeira solicitação; repetir após reinstalar se necessário para testar fluxo limpo.

## Resultado esperado

- Uma única janela de permissão ou sequência controlada; sem `ERROR_ALREADY_REQUESTING_PERMISSIONS`.

## Evidência

- Gravação de tela no iOS + build.

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
| descricao_erro (suporte) | Erro ao pedir permissão de microfone ao rolar várias mensagens de áudio. |
| descricao_solucao | |
