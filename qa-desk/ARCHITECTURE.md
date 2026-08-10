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
| Arquivos | Supabase Storage (`evidence` privado, `avatars` público) via `service_role`; fallback `data/uploads/` |
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

**Visitante:** portfólio público (`VisitorPortfolioPage`) — métricas diárias liberadas + cases `showInPortfolio` (sidebar sem nav operacional).

## API

| Prefixo | Função |
|---------|---------|
| `GET /api/health` | `storage`, `auth`, `automationRun`, agente |
| `/api/projects/:slug/tests` | CRUD CT/bug (`TestRecord`) |
| `/api/projects/:slug/homologations` | Campanhas |
| `/api/projects/:slug/automation` | Flows, device, run (admin) |
| `/api/projects/:slug/kb-curation` | Catálogo PRs + SSE (admin; visitante → 403) |
| `/api/projects/:slug/suite-api` | Newman (admin) |
| `/api/evidence/...` | Evidências: Storage (signed URL) ou `data/uploads/` legado |
| `/api/me` | Perfil + `PUT /avatar` (admin → bucket `avatars`) |

Visitante (API):
- `rejectVisitorMutations` — só GET/HEAD/OPTIONS (403 genérico em mutação)
- Testes: filtro hardcoded `showInPortfolio === true` + `sanitizeVisitorData` (PII)
- Homologações / KB / Suite API / Automação: `forbidVisitor` ou `requireAdmin`
- Evidências: autenticadas; visitante só sob CT público
- UI visitante: `VisitorPortfolioPage` (métricas + cases públicos sanitizados)

## Dados

```
data/projects/{slug}/tests.json          # seed / fallback JSON mode
data/projects/{slug}/homologations.json
data/uploads/{slug}/{testId}/            # evidências legado (sem SERVICE_ROLE)
prisma/ → projects, tests, homologations, test_runs, …
supabase/migrations/004_storage_buckets.sql  # buckets evidence + avatars + profiles.avatar_path
```

**Storage (com `SUPABASE_SERVICE_ROLE_KEY`):**

| Bucket | Público | Uso |
|--------|---------|-----|
| `evidence` | não | Prints de bug/CT — upload via Express; serve signed URL |
| `avatars` | sim | Foto de perfil (`profiles.avatar_path`) |

`storageKey` novo: `evidence/{project}/{testId}/{file}` · legado: `uploads/...`

Com `DATABASE_URL` (+ `DIRECT_URL` para migrate), a API usa Postgres. `bugs.json` é só legado de migração.

## Auth

- Front: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (+ opcional `VITE_VISITOR_EMAIL` / `VITE_VISITOR_PASSWORD`)
- Server: `SUPABASE_*` + `SUPABASE_SERVICE_ROLE_KEY` (nunca no Vite) — **obrigatório** para Storage
- Roles em `profiles.role`: `admin` \| `visitor`; `profiles.avatar_path` opcional
- Senha do Auth fica em `auth.users` (bcrypt) — **não** no Prisma
- SQL: [`supabase/migrations/001_profiles.sql`](supabase/migrations/001_profiles.sql) · Storage: [`004_storage_buckets.sql`](supabase/migrations/004_storage_buckets.sql)
- Seed avatar: `npm run storage:seed-avatar`

Sem essas vars: modo mock admin (dev / Maestro local).

## UI / design tokens

- Shell: sidebar `16rem` + header `4rem` + conteúdo `flex-1` (`App.tsx`)
- Highlights: `--project-highlight-bg|text|border` por `data-theme` (`index.css`)
- Componentes: `PremiumTooltip`, `DesignCheckbox`, UserBar (menu no avatar) + status Agente/AVD
- Global: scrollbar WebKit, `::selection` temática, `focus-visible` em controles

## Handoff de bugs (GitHub)

- **Abrir issue GitHub** — [`server/github/create-bug-issue.ts`](server/github/create-bug-issue.ts) via `gh` · repo `polygonus-br/polygonus-suporte-kb` · label `bug` · evidências na branch `bug-evidence`
- Body: [`src/lib/bug-report-markdown.ts`](src/lib/bug-report-markdown.ts)
- Bugs → `enviado_gestor`; grava `githubIssueNumber` / `githubIssueUrl`
- **Volta issue:** webhook `issues` closed/reopened → [`sync-bug-issue.ts`](server/github/sync-bug-issue.ts); `issue_dependencies` → histórico (label `bug` + vínculo Desk)
- Discord: legado (código no repo; **não** é o handoff oficial) — ver [`docs/BUG_REPORT.md`](docs/BUG_REPORT.md)
