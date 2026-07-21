# Logos dos projetos

## Marca QA Desk

`qa_desk.png` — favicon, login e topo da sidebar (não é logo de projeto).

## Preferência (bundled)

Logos versionados em `src/assets/logos/` e registrados em `src/config/logos.ts` (ex.: Polygonus). Esse caminho entra no build do Vite.

## Fallback público

Arquivos em **esta pasta** (`public/logos/`) servem projetos ainda não bundlados. A app resolve por nome:

| Projeto   | Nomes aceitos (sem extensão)    |
|-----------|----------------------------------|
| Polygonus | `polygonus_logo` ou `polygonus`  |
| Anihype   | `anihype_logo` ou `anihype`      |
| QA Desk   | `qa_desk`                        |

Extensões (ordem de tentativa): `.png`, `.svg`, `.webp`, `.jpg`, `.jpeg`.

Ex.: `anihype_logo.png` → acessível em runtime como `/logos/anihype_logo.png`.
