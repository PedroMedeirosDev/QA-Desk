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
npm run e2e          # UI smoke (headless)
npm run e2e:ui       # Playwright UI
npm run e2e:headed   # browser visível
npm run test:api          # contratos HTTP (Playwright request)
npm run test:api:postman  # mesma suite via Newman (Postman CLI)
```

Não precisa parar o `npm run dev` — o E2E sobe stack própria (5175 / 3011).

`QA_E2E_MOCK=1` força auth mock na API (e anula keys do Supabase no `.env`, inclusive contra o re-load do Prisma).

## API (Postman + Playwright)

- Postman collection / Newman: [`../postman/`](../postman/)
- Specs Playwright: [`api/`](api/) · config [`api.playwright.config.ts`](api.playwright.config.ts)

## Próximos passos (quando quiser evoluir)

1. Mock de `/api/.../run` com `page.route` — validar UI do Play **sem** Maestro
2. Auth real com `storageState` (admin vs visitor) — UI e API
3. CI no GitHub Actions (E2E + Newman)

## Estrutura

```
e2e/
  playwright.config.ts      # UI: webServer API + Vite
  api.playwright.config.ts  # API: só webServer API
  smoke.spec.ts
  api/
    health.spec.ts
    tests-crud.spec.ts
  README.md
postman/                    # collection + Newman
```
