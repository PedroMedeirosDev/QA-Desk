# Logos

## Marca QA Desk (oficial)

- **UI:** componente React `BrandLogo` / `BrandMarkSvg` (Stack SVG).
- **Favicon / estático:** `qa_desk.svg` (ícone com fundo escuro + check vermelho).
- PNG antigo `qa_desk.png` é legado — não usar na UI.

## Projetos

Logos versionados em `src/assets/logos/` e registrados em `src/config/logos.ts` (ex.: Polygonus).

Arquivos em **esta pasta** (`public/logos/`) servem projetos ainda não bundlados. A app resolve por nome:

`{logoFile}.png` · `{slug}.png` · `{slug}_logo.png` (+ svg/webp/jpg)

Ex.: `anihype_logo.png` → `/logos/anihype_logo.png`.

O projeto **desk** (`logoFile: qa_desk`) usa o monograma Stack via `BrandLogo`, não o PNG.
