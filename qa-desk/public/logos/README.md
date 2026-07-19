# Logos dos projetos

## Preferência (bundled)

Logos versionados em `src/assets/logos/` e registrados em `src/config/logos.ts` (ex.: Polygonus). Esse caminho entra no build do Vite.

## Fallback público

Arquivos em **esta pasta** (`public/logos/`) servem projetos ainda não bundlados. A app resolve por nome:

| Projeto   | Nomes aceitos (sem extensão)    |
|-----------|----------------------------------|
| Polygonus | `polygonus_logo` ou `polygonus`  |
| Anihype   | `anihype_logo` ou `anihype`      |

Extensões (ordem de tentativa): `.png`, `.svg`, `.webp`, `.jpg`, `.jpeg`.

Ex.: `anihype_logo.png` → acessível em runtime como `/logos/anihype_logo.png`.
