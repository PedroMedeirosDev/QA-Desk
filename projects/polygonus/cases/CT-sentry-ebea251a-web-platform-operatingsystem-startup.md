# CT — Sentry `ebea251a` — Web startup `UnsupportedError: Platform._operatingSystem`

**Tipo:** Regressão / incidente Sentry  
**Plataforma:** Web (Chrome)  
**Prioridade:** Média  
**Origem:** Issue `ebea251a` — fix **trunk**: guard `kIsWeb` + path `_webIsolate` em `poly_replicate.dart` (evita `IsolateRunner.spawn` na web)

## Objetivo

Confirmar que o app **web** abre após inicialização Hive/cache **sem** crash por uso de `dart:io` / `Platform` em isolate incompatível com web.

## Pré-requisitos

- Build **trunk** web com o guard citado.  
- URL de homolog (ex.: domínio `*.polygonus.com.br` conforme time).

## Passos

1. Limpar cache do browser (opcional).  
2. Abrir o app; aguardar fase pós-abertura dos boxes Hive.  
3. Navegar brevemente pelas telas iniciais.

## Resultado esperado

- Sem `UnsupportedError` no startup; replicação/web isolate no path correto.

## Evidência

- Print da home carregada + versão do build.

## Execução

| Data | Build | Executor | Resultado | Notas |
|------|-------|----------|-----------|--------|
| | | | | |

## Registro para suporte / Sheets

| Campo | Valor |
|--------|--------|
| versao_com_problema (referência) | 6.05.14 (citado no rastro) |
| versao_corrigida | |
| data_correcao | |
| descricao_erro (suporte) | Página do app não carrega no navegador (erro interno na inicialização). |
| descricao_solucao | |

## Nota interna (não exportar como erro de usuário)

O texto da empresa menciona **source maps** (403 no scrape) — tarefa de release/CI separada do comportamento do app.
