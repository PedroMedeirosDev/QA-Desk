# QA Desk (app)

Aplicação web do **QA Desk** — registro de testes e homologação multi-projeto.

**Demo:** [https://qa-desk-pedro.duckdns.org](https://qa-desk-pedro.duckdns.org) (Oracle Always Free + Supabase `sa-east-1`).

| Perfil | O que vê |
|--------|----------|
| **Admin** | Tudo — CTs, homologações, Curadoria KB, Suite API, métricas, execução |
| **Visitante** | Só tela de boas-vindas (portfólio público ainda em configuração) |

| Doc | Uso |
|-----|-----|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Como funciona hoje |
| [`docs/COLORS.md`](docs/COLORS.md) | Cores: marca, projetos, claro/escuro |
| [`VISION.md`](VISION.md) | Backlog (Discord bot, portfólio rico, etc.) |
| [`DEPLOY.md`](DEPLOY.md) | Local, túnel, Oracle, Koyeb |
| [`deploy/SUPABASE_CREDENTIALS.md`](deploy/SUPABASE_CREDENTIALS.md) | Onde achar URL/keys/pooler no painel atual |
| [`deploy/oracle/README.md`](deploy/oracle/README.md) | VM Always Free + systemd + Caddy |
| [`postman/`](postman/) | Suites API por projeto (Newman) + UI **Suite API** |
| [`e2e/`](e2e/) | E2E UI + `npm run test:api` |
| [`SPEC.md`](SPEC.md) | Aposentado — não usar |

## Suite API (Newman / Postman)

No app: projeto → menu **Suite API** (`/projects/:slug/suite-api`).

- Collections em [`postman/projects/`](postman/projects/) (`desk` dogfood · `polygonus` amostra/ficha)
- Botão **Rodar suite** → resumo mastigado + toggle do log Newman fiel
- CLI:
  - `npm run test:api:postman` — Desk (mock :3011)
  - `npm run test:api:postman:polygonus` — Auth SUPPETER + `GET /academico/aluno/contexto` (CQ `…:8443/api/v2`)
- Credenciais Polygonus: `POLY_API_*` no `.env` (ver `.env.example`) — **não** commitar senha

Detalhes: [`postman/README.md`](postman/README.md).

## Rodar (dev)

```powershell
cd qa-desk
copy .env.example .env
# NODE_ENV=development (nunca production no .env local com npm run dev)
# Supabase: preferir região sa-east-1 — us-west-2 fica ~2–3s por query do Brasil
npm install
npm run dev              # UI :5174 + API :3001
```

Abra **http://localhost:5174** (não a `:3001` no browser em modo dev).

**Parar o dev (`Ctrl+C`):** no Windows, se aparecer `Deseja finalizar o arquivo em lotes (S/N)?`, digite `S` e Enter.

```powershell
npm run start:prod       # build + API em :3001 (serve dist/)
```

## Auth (Supabase)

- Sem `VITE_SUPABASE_URL` → modo mock admin (dev / Maestro).
- Com Auth → login em `/login` · roles `admin` | `visitor` (`profiles`).
- Botão **Acessar como visitante** → `VITE_VISITOR_EMAIL` + `VITE_VISITOR_PASSWORD` (mesmo user no Supabase Auth; senha em hash no `auth.users`).
- SQL inicial: [`supabase/migrations/001_profiles.sql`](supabase/migrations/001_profiles.sql).
- RLS nas tabelas Prisma (obrigatório em prod): [`supabase/migrations/002_rls_prisma_tables.sql`](supabase/migrations/002_rls_prisma_tables.sql).
- Trava RPC `handle_new_user`: [`supabase/migrations/003_lock_handle_new_user.sql`](supabase/migrations/003_lock_handle_new_user.sql).
- Auth: no Dashboard → Authentication → Providers → Email, ligue **Prevent use of leaked passwords** (HaveIBeenPwned; plano Pro+).

E-mail canônico do visitante: `visitante@qa-desk.local` (role `visitor` em `profiles`).

## Persistência

**JSON** em `data/projects/{slug}/` se não houver `DATABASE_URL`.

**Postgres (recomendado — Supabase):**

```powershell
# .env: DATABASE_URL (pooler :6543) + DIRECT_URL (session/direct :5432)
npx prisma migrate deploy
npm run db:migrate-json
npx tsx scripts/apply-mural-checklist.ts
```

`/api/health` → `"storage":"postgres"`, `"auth":"supabase"`. Evidências em `data/uploads/`.

Em produção a fonte da verdade é o **Postgres**; o JSON em `data/` é seed / fallback local — evite commitar dumps de execução.

## Privacidade (PII)

Textos livres e logs passam por redação automática (CPF, CNPJ, telefone, e-mail → `[CPF]` / `[CNPJ]` / `[TELEFONE]` / `[EMAIL]`):

- na **gravação** (API → Postgres/JSON)
- na **exibição**/export (logs, Discord, HTML)

Para limpar dados já salvos:

```powershell
npx tsx server/scripts/redact-pii-catalog.ts
```

## Homologação Mural

Checklist canônico por suite (`CRUD-01`, `ANEXO-02`, …):

1. Na app → homologação **mural-backend-homologacao** → **Sincronizar checklist Mural**  
   (ou `npx tsx scripts/apply-mural-checklist.ts`)
2. Emulador + `QA_AUTOMATION_RUN=1` no PC **ou** agente remoto (`npm run agent` — ver [`agent/README.md`](agent/README.md))
3. Flows: `projects/polygonus/automation/maestro/` · Playwright: `projects/polygonus/automation/playwright/`
4. Na UI, toggle **Maestro | Playwright** por suite — progresso e rodadas são **por runner**

## UI (design system)

- Tokens por projeto: `--project-highlight-*` em [`docs/COLORS.md`](docs/COLORS.md) / `src/index.css`
- Tooltips premium (`PremiumTooltip`) — sem `title` nativo nas tabelas/userbar
- Checkbox do sistema (`DesignCheckbox`) — aparência própria, cores do tema
- Scrollbar custom + `::selection` temática + focus-visible (teclado)

## Status

- [x] CRUD + homologação + checklist Mural (nomes por suite)
- [x] Maestro one-click (PC local) + toggle Playwright na lista
- [x] Métricas de suite separadas por runner (Maestro ≠ Playwright)
- [x] Agente remoto (API online → PC com Maestro/emulador)
- [x] Postgres + Prisma (`qa-desk/`)
- [x] Auth Supabase (admin / visitor)
- [x] Login visitante → tela de boas-vindas (sem dados operacionais)
- [x] Curadoria KB (SSE + webhook GitHub) — admin only
- [x] Suite API na UI (Newman por projeto)
- [x] Shell rígido + highlights CSS + polimento UI (tooltip / scrollbar / checkbox)
- [x] Deploy Oracle — [https://qa-desk-pedro.duckdns.org](https://qa-desk-pedro.duckdns.org)
- [ ] Portfólio visitante rico (`showInPortfolio` + cases públicos) — ver [`VISION.md`](VISION.md)
- [ ] Bot Discord — [`VISION.md`](VISION.md)
