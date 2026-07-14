# CT — Sentry `3c8b22f4` — SIGABRT no startup (Android / símbolos ausentes)

**Tipo:** Documentação / triagem Sentry  
**Plataforma:** Android (evento em ambiente tipo **emulador / cloud test** — não reproduzível em usuário real segundo a empresa)  
**Prioridade:** Baixa  
**Origem:** Issue `3c8b22f4` — status **❌ Não reproduzível**; símbolos nativos **missing** no Sentry

## Objetivo

**Não** é homologação de correção de produto: registrar que o incidente foi **arquivado** com justificativa (símbolos, ambiente x86_64/emulador). Opcional: validar que **releases futuras** sobem **debug symbols** `.so` ao Sentry.

## Pré-requisitos

- Leitura do parecer da empresa no `issues_rastreadas.md`.  
- Alinhamento com time de build sobre upload de símbolos nativos.

## Passos

1. Não gastar tempo em reprodução funcional a menos que o time peça.  
2. Se desejado: confirmar no CI que `sentry-cli` / plugin envia **Android NDK symbols** para a release.

## Resultado esperado

- Planilha: linha com **observação** de não reproduzível + ação de CI se aplicável.

## Evidência

- Link Sentry + nota de ambiente (sem PII).

## Execução

| Data | Build | Executor | Resultado | Notas |
|------|-------|----------|-----------|--------|
| | | N/A homolog app | Documentado | Não reproduzível — ver rastro |

## Registro para suporte / Sheets

| Campo | Valor |
|--------|--------|
| versao_com_problema (referência) | 6.05.14 |
| versao_corrigida | *(vazio ou "N/A")* |
| data_correcao | *(vazio)* |
| descricao_erro (suporte) | Crash nativo no início do app em ambiente de teste automatizado; causa indeterminada sem símbolos. |
| descricao_solucao | Sem correção de app; melhorar upload de símbolos para próximas releases. |
