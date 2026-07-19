# QA Desk — o que existe hoje

Documento de **arquitetura atual**. Backlog futuro: [`VISION.md`](VISION.md). Deploy: [`DEPLOY.md`](DEPLOY.md).

## Produto

App web multi-projeto (`polygonus`, `anihype`, …) para:

- Casos de teste (CT) e bugs
- Campanhas de homologação (ex.: Mural)
- Execução Maestro **no PC local** (`QA_AUTOMATION_RUN=1`)
- Auth opcional via Supabase (admin / visitor)

Pasta no repo: `qa-desk/` · package npm: `qa-desk` · remoto GitHub: [QA-Desk](https://github.com/PedroMedeirosDev/QA-Desk).

## Stack

| Camada | Tecnologia |
|--------|------------|
| Front | React + Vite + Tailwind + React Router |
| API | Express (`server/`) — serve `dist/` em produção |
| Dados | JSON em `data/projects/` **ou** Postgres via Prisma |
| Auth | Supabase Auth + tabela `profiles` (opcional; sem env = mock admin) |
| Automação | Maestro (flows em `projects/polygonus/automation/maestro/`) |

## Rotas UI

| Rota | Página |
|------|--------|
| `/login` | Login (só se Supabase configurado) |
| `/projects/:slug/...` | Layout do projeto |
| `…/app` \| `web` \| `portal` | Lista de CTs |
| `…/bugs` | Lista de bugs |
| `…/homologacoes` | Campanhas |
| `…/homologacao/:homSlug` | Detalhe da campanha |
| `…/dashboard` | Métricas |
| editor CT/bug | `TestEditorPage` |

## API

| Prefixo | Função |
|---------|---------|
| `GET /api/health` | `storage`, `auth`, `automationRun` |
| `/api/projects/:slug/tests` | CRUD CT/bug (`TestRecord`) |
| `/api/projects/:slug/homologations` | Campanhas |
| `/api/projects/:slug/automation` | Flows, device, run Maestro |
| `/api/evidence/...` | Arquivos em `data/uploads/` |

Visitante: GET filtrado por `showInPortfolio`; mutações e automation → 403.

## Dados

```
data/projects/{slug}/tests.json          # catálogo (JSON mode)
data/projects/{slug}/homologations.json
data/uploads/{slug}/{testId}/            # evidências
prisma/ → projects, tests, homologations, test_runs
```

Com `DATABASE_URL` (+ `DIRECT_URL` para migrate), a API usa Postgres. `bugs.json` é só legado de migração.

## Auth

- Front: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
- Server: `SUPABASE_*` + `SUPABASE_SERVICE_ROLE_KEY` (nunca no Vite)
- Roles em `profiles.role`: `admin` \| `visitor`
- SQL: [`supabase/migrations/001_profiles.sql`](supabase/migrations/001_profiles.sql)

Sem essas vars: modo mock admin (dev / Maestro local).

## Discord hoje

- Existe: botão **Copiar report Discord** (clipboard)
- Não existe: bot, reação ✅, envio automático ao Moacir — ver [`VISION.md`](VISION.md)
