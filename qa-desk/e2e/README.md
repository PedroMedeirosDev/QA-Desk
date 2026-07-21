# E2E — QA Desk (Playwright)

Dogfooding: testes do **próprio** QA Desk. Separado do Playwright do Polygonus (`projects/.../playwright`).

## Ideia

| | |
|--|--|
| Auth | **Mock** (sem `VITE_SUPABASE_*`) — admin local, sem `/login` |
| Maestro | **Desligado** (`QA_AUTOMATION_RUN=0`) — não dispara emulador |
| Portas | UI `5175` · API `3011` (não colide com `npm run dev` em 5174/3001) |

## Setup (1×)

```bash
cd qa-desk
npm install
npx playwright install chromium
```

## Rodar

```bash
npm run e2e          # headless
npm run e2e:ui       # Playwright UI
npm run e2e:headed   # browser visível
```

Não precisa parar o `npm run dev` — o E2E sobe stack própria (5175 / 3011).

`QA_E2E_MOCK=1` força auth mock na API (e anula keys do Supabase no `.env`, inclusive contra o re-load do Prisma).

## Próximos passos (quando quiser evoluir)

1. CRUD de CT (criar rascunho → aparecer na lista) — ideal com Postgres local / JSON descartável
2. Mock de `/api/.../run` com `page.route` — validar UI do Play **sem** Maestro
3. Auth real com `storageState` (admin vs visitor)
4. CI no GitHub Actions

## Estrutura

```
e2e/
  playwright.config.ts   # webServer API + Vite
  smoke.spec.ts          # 1º spec
  README.md
```
