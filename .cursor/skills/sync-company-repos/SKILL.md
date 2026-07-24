---
name: sync-company-repos
description: >-
  Sincroniza SOMENTE os clones da empresa ativa no QA Desk (hoje Polygonus /
  polygonus-br), listados em scripts/company-repos.json — nunca repositórios
  pessoais nem pastas fora desse mapa. Use ANTES de homologação Polygonus (KB,
  Mural, bancada CQ), quando o usuário pedir sync dos repos/código da empresa,
  ou ao começar sessão que precisa cruzar PR/artigo com Delphi/Go/Flutter/React.
---

# Sync — clones da empresa (não pessoais)

## Escopo (crítico)

Esta skill atualiza **apenas** repositórios de **empresa** definidos no mapa. Não é um `git pull` genérico do workspace.

| Inclui | Não inclui |
|--------|------------|
| Entradas de `scripts/company-repos.json` (ou mapa da empresa ativa) | Repos **pessoais** do Pedro |
| Clones sob a raiz do QA Desk com `name` no mapa | O próprio **qa-desk**, `projects/`, `shared/`, scripts do portfolio |
| Org/repos da empresa ativa (hoje **Polygonus** / `polygonus-br`) | Outras pastas em `Projetos Portfolio` fora do mapa |
| | Qualquer `.git` que não esteja no mapa |

**Fonte da verdade:** o JSON do mapa. Se não está no mapa → **não** fetch/pull/clone/checkout via esta skill.

### Empresa atual

- **Ativa hoje:** Polygonus (`empresa: polygonus` no mapa).
- Clones típicos: `polygonus-mobile`, `polygonus-react`, `polygonus-go`, `acropoly-server`, `polygonus-server`, `polygonus-suporte-kb`.
- Branches no mapa Polygonus: **`cq`** nos fontes; **`master`** só em `polygonus-suporte-kb`.

### Outras empresas (futuro)

Quando houver outra empresa no QA Desk:

1. Ter um mapa próprio (ex. `scripts/<empresa>-repos.json`) **ou** campo `empresa` + lista filtrável no mapa.
2. Rodar o sync **só** desse mapa / filtro — nunca misturar clones de empresas diferentes num único “sync all” cego.
3. Homologação de produto X → sync da empresa X; não puxar Polygonus “por hábito”.

Até existir segundo mapa, assume **Polygonus** e o arquivo `scripts/company-repos.json`.

## Quando rodar

1. **Início de sessão de homologação Polygonus** (KB, Mural, review com grounding em código) — **antes** do primeiro PR/artigo.
2. Usuário pedir sync dos **repos da empresa** / `sync.bat` / “atualizar clones Polygonus”.
3. Grounding falhou e há suspeita de clone atrasado **dessa** empresa.

Não re-sincronizar entre cada PR da mesma sessão, salvo pedido explícito ou tip remoto avançou (ex. vários merges na KB).

Se o pedido for ambíguo (“atualiza meus repos”) → **perguntar**: empresa (Polygonus) vs pessoais. Pessoais ficam fora desta skill.

## Como executar (Polygonus)

Na raiz do QA Desk:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts/sync-company-repos.ps1"
```

Atalho: `.\sync.bat` (mesmo script; só o mapa Polygonus).

Filtros (`-Only`) limitam **dentro do mapa**, não expandem o escopo:

| Flag | Efeito |
|------|--------|
| `-Only suporte-kb` | só a KB Polygonus |
| `-Only backend` | go + acropoly + server + suporte-kb |
| `-Only frontend` | mobile + react |
| `-Only go` / `react` / `mobile` / `acropoly` / `server` | um repo do mapa |

**Nunca** `-Hard` sem o usuário pedir (descarta alterações locais).

Linux/mac: `scripts/sync-company-repos.sh`.

## Comportamento esperado

- Ausente → clone da `url`/`branch` do mapa.
- Limpo → fetch + checkout da branch do mapa + `pull --ff-only`.
- Sujo → **não** atualiza; AVISO ao usuário; `-Hard` só com autorização.

Resumir por repo (OK + tip, ou AVISO dirty). Não mencionar/atualizar repos pessoais.

## Relação com outras skills

- [homologacao-suporte-kb](../homologacao-suporte-kb/SKILL.md) — passo 0 = sync **Polygonus** via esta skill.
- Grounding usa só os clones do mapa da empresa do produto sob review.
