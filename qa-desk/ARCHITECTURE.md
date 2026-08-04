# QA Desk — o que existe hoje

Documento de **arquitetura atual**. Backlog futuro: [`VISION.md`](VISION.md). Deploy: [`DEPLOY.md`](DEPLOY.md).

## Produto

App web multi-projeto (`polygonus`, `anihype`, `desk`, …) para:

- Casos de teste (CT) e bugs
- Campanhas de homologação (ex.: Mural)
- Execução Maestro / Playwright **no PC local** (`QA_AUTOMATION_RUN=1`) ou via agente remoto
- Curadoria da base de conhecimento (PRs GitHub) — Polygonus
- Suite API (Newman / Postman) por projeto
- Auth via Supabase (`admin` / `visitor`)

Pasta no repo: `qa-desk/` · package npm: `qa-desk` · remoto: [QA-Desk](https://github.com/PedroMedeirosDev/QA-Desk).

## Stack

| Camada | Tecnologia |
|--------|------------|
| Front | React + Vite + Tailwind + React Router |
| API | Express (`server/`) — serve `dist/` em produção |
| Dados | JSON em `data/projects/` **ou** Postgres via Prisma (prod = Postgres) |
| Auth | Supabase Auth + tabela `profiles` (opcional; sem env = mock admin) |
| Automação | Maestro + Playwright (flows em `projects/polygonus/automation/`) |

## Rotas UI

| Rota | Página |
|------|--------|
| `/login` | Login (só se Supabase configurado); botão visitante via `VITE_VISITOR_*` |
| `/projects/:slug/...` | Layout do projeto |
| `…/app` \| `web` \| `portal` | Lista de CTs (métricas por runner Maestro/Playwright) |
| `…/bugs` | Lista de bugs |
| `…/homologacoes` | Campanhas |
| `…/homologacao/:homSlug` | Detalhe da campanha |
| `…/dashboard` | Métricas / resumo do dia |
| `…/curadoria-kb` | Curadoria KB (admin) |
| `…/suite-api` | Suite Newman |
| editor CT/bug | `TestEditorPage` |

**Visitante:** qualquer rota de projeto renderiza só `VisitorWelcomePage` (sidebar sem navegação operacional).

## API

| Prefixo | Função |
|---------|---------|
| `GET /api/health` | `storage`, `auth`, `automationRun`, agente |
| `/api/projects/:slug/tests` | CRUD CT/bug (`TestRecord`) |
| `/api/projects/:slug/homologations` | Campanhas |
| `/api/projects/:slug/automation` | Flows, device, run (admin) |
| `/api/projects/:slug/kb-curation` | Catálogo PRs + SSE (admin; visitante → 403) |
| `/api/projects/:slug/suite-api` | Newman (admin) |
| `/api/evidence/...` | Arquivos em `data/uploads/` |

Visitante: mutações / automation / Curadoria KB → 403. GET de testes ainda pode filtrar `showInPortfolio` (quando o portfólio público existir).

## Dados

```
data/projects/{slug}/tests.json          # seed / fallback JSON mode
data/projects/{slug}/homologations.json
data/uploads/{slug}/{testId}/            # evidências
prisma/ → projects, tests, homologations, test_runs, …
```

Com `DATABASE_URL` (+ `DIRECT_URL` para migrate), a API usa Postgres. `bugs.json` é só legado de migração.

## Auth

- Front: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (+ opcional `VITE_VISITOR_EMAIL` / `VITE_VISITOR_PASSWORD`)
- Server: `SUPABASE_*` + `SUPABASE_SERVICE_ROLE_KEY` (nunca no Vite)
- Roles em `profiles.role`: `admin` \| `visitor`
- Senha do Auth fica em `auth.users` (bcrypt) — **não** no Prisma
- SQL: [`supabase/migrations/001_profiles.sql`](supabase/migrations/001_profiles.sql)

Sem essas vars: modo mock admin (dev / Maestro local).

## Discord hoje

- Existe: botão **Copiar report Discord** (clipboard)
- Não existe: bot, reação ✅, envio automático ao Moacir — ver [`VISION.md`](VISION.md)
