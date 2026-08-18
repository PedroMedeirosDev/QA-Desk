# Anihype

Projeto em setup. Mesma pasta padrão de [`../README.md`](../README.md).

## Como começar (Desk → tela → Playwright)

Não gerar spec Playwright “no vazio”. Ordem:

1. **Mapa de telas** — lista curta (login, home, fluxo crítico). Sem pixel.
2. **Campanha no QA Desk** (`anihype`) — homologação + CTs com `testKey` estável, passos manuais, canal WEB. Smoke primeiro.
3. **Telas do produto** — `data-testid` / papel alinhado ao `testKey`.
4. **Playwright** — um spec por CT; `automation.playwright.specPath` no mesmo registro do Desk; `readiness: draft` até passar 2×.
5. **Só então** ampliar (anexo, negativo, mobile).

Espelha o que funcionou no Polygonus CQ: escopo no Desk → HTML para o gestor → script depois que a tela existe.

## Subpastas

| Subpasta | Status |
|----------|--------|
| `cases/` | Pronto para casos CT |
| `checklists/` | Pronto para checklists |
| `automation/` | Pronto para Playwright/Maestro |
| `evidence/` | Evidências locais (gitignored) |

## Aplicação QA

Bugs e CTs com `project: anihype` no [`../../qa-desk/`](../../qa-desk/).
