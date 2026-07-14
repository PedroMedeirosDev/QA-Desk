# Comandos de terminal — `polygonus-sentry-suporte`

Sempre comece entrando na pasta do registro (ajuste o caminho se o seu for diferente).

## PowerShell (Windows)

```powershell
cd "C:\Users\PEDRO\Documents\Projetos Portfolio\QA Automate\testes\polygonus-sentry-suporte"
```

## bash / zsh / Git Bash

```bash
cd "/c/Users/PEDRO/Documents/Projetos Portfolio/QA Automate/testes/polygonus-sentry-suporte"
```

---

## Gerar CSV completo (todas as correções)

Gera ou sobrescreve `data/sentry_correcoes_suporte_copilot.csv`.

**Node (recomendado se o Dart não estiver no PATH):**

```powershell
node tool/gen_csv_suporte.mjs
```

**Dart:**

```powershell
dart run tool/export_suporte_por_versao.dart
```

---

## Gerar CSV só de uma versão do app

Exemplo: apenas itens com `versao_correcao` = `6.05.16` no JSON.

**Node:**

```powershell
node tool/gen_csv_suporte.mjs --versao=6.05.16 --saida=data/release_6_05_16.csv
```

**Dart:**

```powershell
dart run tool/export_suporte_por_versao.dart --versao=6.05.16 --saida=data/release_6_05_16.csv
```

Troque `6.05.16` por outra versão (`6.05.15`, `trunk`, etc.) conforme o JSON.

---

## Só mudar o nome do arquivo de saída (export completo)

**Node:**

```powershell
node tool/gen_csv_suporte.mjs --saida=data/meu_export.csv
```

**Dart:**

```powershell
dart run tool/export_suporte_por_versao.dart --saida=data/meu_export.csv
```

---

## Resumo rápido

| Objetivo | Comando |
|----------|---------|
| CSV geral para Sheets/Copilot | `node tool/gen_csv_suporte.mjs` |
| CSV filtrado por versão | `node tool/gen_csv_suporte.mjs --versao=VERSAO --saida=data/arquivo.csv` |
| Mesmo com Dart | `dart run tool/export_suporte_por_versao.dart` (+ mesmos argumentos opcionais) |

A fonte dos dados é sempre `data/sentry_correcoes_suporte.json` (editar esse arquivo ao registrar casos novos).

## Colunas do CSV (padrão atual)

| Coluna | Conteúdo |
|--------|----------|
| Versão (correção) | Ex.: `6.05.16`, `trunk`, vazio se não aplicável |
| ID triagem | Ex.: `fcfdd4f8` — conferir sempre no JSON (evita typo ao copiar) |
| Data registro | Data do registro do caso |
| Título do erro | Resumo |
| Descrição para suporte | Linguagem simples (pode estar vazio até preencher) |
| Detalhes técnicos | Arquivo, causa, solução no código |
| Query Sentry | Busca em issues |
| Event IDs | Exemplos separados por `; ` |
| Link Sentry | URL pronta para abrir no navegador |

Importar no **Google Sheets**: Arquivo → Importar → upload do CSV, separador vírgula, **UTF-8**.
