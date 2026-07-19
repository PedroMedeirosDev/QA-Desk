# Projetos

Cada cliente/produto tem sua pasta em `projects/<slug>/`. O repositório **QA Automate** é multi-projeto; Polygonus foi o primeiro e não define o escopo do repo.

## Projetos ativos

| Slug | Pasta | Descrição |
|------|-------|-----------|
| `polygonus` | [`polygonus/`](polygonus/) | App mobile, web react, homologação CQ, Maestro, Playwright, Sentry |
| `anihype` | [`anihype/`](anihype/) | Em setup — casos, automação e evidências futuras |

## Estrutura padrão por projeto

```
projects/<slug>/
├── cases/           # Casos de teste (CT-*.md)
├── checklists/      # Checklists de homologação
├── automation/      # Maestro, Playwright, scripts
├── evidence/        # Prints e logs locais (gitignored)
├── homologacao/     # Playbook, inbox, sessão por versão
├── support/         # Integração Sentry → suporte (se aplicável)
└── notes/           # Notas de exploração
```

## Compartilhado entre projetos

| Pasta | Uso |
|-------|-----|
| [`../shared/templates/`](../shared/templates/) | Modelos de relatório, caso de teste, checklist |
| [`../qa-desk/`](../qa-desk/) | Aplicação web de registro de bugs (multi-projeto) |
| [`../scripts/`](../scripts/) | Sync de clones, automações globais |

## Convenção de slug

- Minúsculas, sem espaços: `polygonus`, `anihype`
- Usado na aplicação QA, filtros e caminhos `data/projects/<slug>/`

## Migração

Conteúdo que estava em `testes/` foi movido para `projects/polygonus/` (jul/2026).  
Se encontrar link antigo `testes/...`, substitua por `projects/polygonus/...`.
