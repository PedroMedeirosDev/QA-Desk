# CT — Sentry `5ab3ed0d` — Timeout 30s em `MenuController._loadMenuItems` (`/mobile_menu`)

**Tipo:** Regressão / incidente Sentry  
**Plataforma:** Android  
**Prioridade:** Alta  
**Origem:** Issue `5ab3ed0d` — correção em **trunk**: `PolyHttpClient` converte `TimeoutException` → `ApiException(statusCode: 0)` para o `catchError` existente (`polyShowToast`)

## Objetivo

Homologar que timeout no carregamento do **menu mobile** não estoura exceção bruta; usuário recebe feedback (toast) coerente com outros erros de API/rede.

## Pré-requisitos

- Build de **trunk** / release que contenha o fix do `PolyHttpClient._request`.  
- Conta válida; rede simulável.

## Passos

1. Login e chegada na home que dispara `loadMenuItems`.  
2. Simular timeout na chamada `/mobile_menu` (throttling ou ambiente de homolog com latência).  
3. Confirmar **toast** e continuidade do app (sem crash silencioso não tratado).

## Resultado esperado

- `TimeoutException` tratada como falha de rede/API com código 0, com feedback ao usuário.

## Evidência

- Print/vídeo curto.

## Execução

| Data | Build | Executor | Resultado | Notas |
|------|-------|----------|-----------|--------|
| 2026-04-17 | Versões de teste (amostra) | | OK — solucionado | Deixei a sessão expirar algumas vezes no amostra e em nenhum momento gerou log das versões de teste, então podemos considerar como solucionado. |

## Registro para suporte / Sheets

| Campo | Valor |
|--------|--------|
| versao_com_problema (referência) | 6.05.10 |
| versao_corrigida | *(build trunk com fix)* |
| data_correcao | |
| descricao_erro (suporte) | Menu não carrega após espera longa; timeout de rede na API do menu. |
| descricao_solucao | |
