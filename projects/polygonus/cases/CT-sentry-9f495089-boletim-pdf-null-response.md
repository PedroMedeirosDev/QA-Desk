# CT — Sentry `9f495089` — Crash ao abrir boletim PDF (`[]` em null)

**Tipo:** Regressão / incidente Sentry  
**Plataforma:** Android (contexto original); validar em outros alvos se o fluxo existir  
**Prioridade:** Alta  
**Origem:** Issue `9f495089` — `HttpRepository.get()` retornava null; acesso `response['url']` sem guard; fix **trunk** (`montarUrlRelatorio` / `extrairUrlRelatorio`)

## Objetivo

Homologar abertura de **boletim PDF** quando a API retorna erro (ex.: **401** token expirado): app **não** crasha com `NoSuchMethodError`; usuário recebe fluxo seguro (mensagem / re-login conforme produto).

## Pré-requisitos

- Build **trunk** com utilitários de URL do relatório.  
- Conta com acesso ao boletim; roteiro para token expirado **apenas** se aprovado pelo time.

## Passos

1. Abrir boletim PDF com sessão válida — deve funcionar.  
2. Se possível com segurança: repetir com sessão/token inválido para forçar resposta que antes gerava `null`.  
3. Observar ausência de crash e mensagem adequada.

## Resultado esperado

- Sem `response['url']` em null; tratamento centralizado de URL/não-Map.

## Evidência

- Print da tela de erro esperada ou sucesso + build.

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
| descricao_erro (suporte) | App fecha ou trava ao abrir boletim em PDF quando a sessão ou resposta da API falha. |
| descricao_solucao | |
