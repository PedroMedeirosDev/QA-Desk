# Polygonus

Homologação e automação do ecossistema Polygonus (mobile Flutter, web React, integrações Sentry/Linear).

## Clones locais (raiz do repo, gitignored)

| Pasta | Repositório |
|-------|-------------|
| `polygonus-mobile/` | App Android/iOS |
| `polygonus-react/` | Portal web |
| `polygonus-go/` | Backend Go (quando aplicável) |

Atualizar: `.\sync.bat` na raiz.

## Conteúdo desta pasta

| Subpasta | Uso |
|----------|-----|
| [`cases/`](cases/) | Casos de teste CT-*.md |
| [`checklists/`](checklists/) | Checklists por módulo |
| [`HOMOLOGACAO_INVENTARIO.md`](HOMOLOGACAO_INVENTARIO.md) | **Escopo regressão APP+WEB** (menus × perfil) + checklist smokes |
| [`automation/`](automation/) | Maestro, Playwright, sentry-linear |
| [`automation/maestro/flows/smoke/`](automation/maestro/flows/smoke/) | Smokes menus Responsável / Coordenador / Professor |
| [`evidence/`](evidence/) | Evidências locais |
| [`homologacao/`](homologacao/) | Playbook CQ, inbox GitHub → Cursor |
| [`support/`](support/) | Sentry → registro suporte |
| [`polygonus-sentry-suporte/`](polygonus-sentry-suporte/) | Exportações Sentry |
| [`notes/`](notes/) | Notas de exploração |

## Aplicação QA

Bugs e CTs deste projeto na **QA Desk** com `project: polygonus`.  
Ver [`../../qa-desk/ARCHITECTURE.md`](../../qa-desk/ARCHITECTURE.md) e [`../../qa-desk/README.md`](../../qa-desk/README.md).
