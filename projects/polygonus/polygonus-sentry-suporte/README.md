# Registro Sentry + export para suporte / Google Sheets

Esta pasta fica em **`projects/polygonus/polygonus-sentry-suporte`**, separada do clone do app na raiz do QA Desk (`polygonus-mobile`), para que o repositório da empresa permaneça só código, sem arquivos extras de QA misturados.

## Conteúdo

| Item | Descrição |
|------|-----------|
| `data/sentry_correcoes_suporte.json` | Fonte estruturada (versão, título, texto para suporte, fix técnico, query Sentry). |
| `data/sentry_correcoes_suporte_copilot.csv` | Gerado — planilha única com colunas em **português**: versão, ID, data, título, **texto amigável**, **detalhes técnicos**, query/eventos Sentry e **link** para o painel. UTF-8 com BOM (Excel). |

## Gerar o CSV

Lista completa de comandos (PowerShell, bash, filtros): **[COMANDOS_TERMINAL.md](COMANDOS_TERMINAL.md)**.

Na pasta **`polygonus-sentry-suporte`** (esta):

```bash
node tool/gen_csv_suporte.mjs
```

Só uma versão (ex.: 6.05.16):

```bash
node tool/gen_csv_suporte.mjs --versao=6.05.16 --saida=data/release_6_05_16.csv
```

Com Dart (se estiver no PATH):

```bash
dart run tool/export_suporte_por_versao.dart
dart run tool/export_suporte_por_versao.dart --versao=6.05.16
```

## Manutenção

Ao fechar um caso novo: edite o JSON (novo objeto em `correcoes`). Opcionalmente mantenha a tabela “Issues Rastreadas” no skill do repositório da empresa em sincronia manualmente.

No `meta` do JSON, o campo **`codigo_referencia`** aponta para o clone do mobile na raiz do QA Desk (`../../../polygonus-mobile`).
