# CT — Sentry `f03837da` — Timeout em `selecionarEntidade` ao iniciar app

**Tipo:** Regressão / incidente Sentry  
**Plataforma:** Android  
**Prioridade:** Alta  
**Origem:** Issue `f03837da` — `TimeoutException` 30s; fix **6.05.16** (`_erroDeRede()` em `utils.dart`)

## Objetivo

Confirmar que **timeout de rede** no startup (seleção de entidade) exibe feedback **"Sem conexão com o servidor"** (ou equivalente) e **não** envia `TimeoutException` ao Sentry como não tratada.

## Pré-requisitos

- Build **6.05.16+**.  
- Ferramenta para simular rede lenta/indisponível (Throttling, modo avião momentâneo, etc.) **somente** conforme política de teste.

## Passos

1. Instalar o build.  
2. Com rede **estável**, login completo (baseline).  
3. Repetir com rede **instável** ou servidor lento (>30s) no momento de `selecionarEntidade`.  
4. Observar toast e ausência de crash / Sentry indevido.

## Resultado esperado

- Tratamento como erro de rede; usuário informado; sem `Zone.handleUncaughtError` por timeout isolado.

## Evidência

- Print + anotação de condição de rede (sem PII).

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
| descricao_erro (suporte) | App não abre / trava fluxo inicial quando o servidor demora ou não responde (timeout). |
| descricao_solucao | |
