# CT — Sentry `8a56fb06` — Null check em `MensagemWidget` durante scroll/desmontagem

**Tipo:** Regressão / incidente Sentry  
**Plataforma:** Android 13 (original: motorola edge 20); replicar em equivalente  
**Prioridade:** Alta  
**Origem:** Issue `8a56fb06` — fix **6.05.16**: listener removido em `deactivate()` em vez de só em `dispose()`

## Objetivo

Homologar que rolagem em **lista de mensagens** durante **desmontagem** do widget não gera `Null check operator used on a null value` em `localToGlobal` / cadeia de `RenderObject`.

## Pré-requisitos

- Build **6.05.16+**.  
- Chat com lista longa o suficiente para scroll contínuo.

## Passos

1. Abrir conversa com muitas mensagens.  
2. Scroll rápido para cima/baixo.  
3. Navegar **para fora** da tela (voltar, trocar aba) **durante** o scroll.  
4. Repetir 10+ vezes.

## Resultado esperado

- Nenhum crash; listener não dispara após desativação insegura da árvore.

## Evidência

- Vídeo curto do gesto + build.

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
| descricao_erro (suporte) | App fecha ao rolar mensagens e sair da tela ao mesmo tempo. |
| descricao_solucao | |
