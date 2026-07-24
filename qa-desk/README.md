# QA Desk (app)

Aplicação web do **QA Desk** — registro de testes e homologação multi-projeto.

**Demo:** [https://qa-desk-pedro.duckdns.org](https://qa-desk-pedro.duckdns.org) (Oracle Always Free + Supabase `sa-east-1`).  
Acesso **visitante** = portfólio em construção (ainda sem conteúdo público). **Admin** vê tudo.

| Doc | Uso |
|-----|-----|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Como funciona hoje |
| [`VISION.md`](VISION.md) | Backlog (Discord bot, etc.) |
| [`DEPLOY.md`](DEPLOY.md) | Local, túnel, Oracle, Koyeb |
| [`deploy/SUPABASE_CREDENTIALS.md`](deploy/SUPABASE_CREDENTIALS.md) | Onde achar URL/keys/pooler no painel atual |
| [`deploy/oracle/README.md`](deploy/oracle/README.md) | VM Always Free + systemd + Caddy |

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
- SQL inicial: [`supabase/migrations/001_profiles.sql`](supabase/migrations/001_profiles.sql).

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

## Homologação Mural

Checklist canônico por suite (`CRUD-01`, `ANEXO-02`, …):

1. Na app → homologação **mural-backend-homologacao** → **Sincronizar checklist Mural**  
   (ou `npx tsx scripts/apply-mural-checklist.ts`)
2. Emulador + `QA_AUTOMATION_RUN=1` no PC para **Executar**
3. Flows: `projects/polygonus/automation/maestro/`

## Status

- [x] CRUD + homologação + checklist Mural (nomes por suite)
- [x] Maestro one-click (PC local)
- [x] Postgres + Prisma (`qa-desk/`)
- [x] Auth Supabase (admin / visitor + `showInPortfolio`)
- [x] Footer na login e nas telas do app
- [x] Cache Auth + leituras Postgres sem re-sync em todo GET
- [x] Deploy Oracle em produção — [https://qa-desk-pedro.duckdns.org](https://qa-desk-pedro.duckdns.org) ([`deploy/oracle/`](deploy/oracle/))
- [ ] Portfólio visitante (casos com `showInPortfolio`) — aviso “em construção” no ar
- [ ] Bot Discord — [`VISION.md`](VISION.md)
