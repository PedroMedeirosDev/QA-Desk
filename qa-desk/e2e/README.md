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

## No CI

- A API dos testes sobe com dados isolados em `e2e/.dados` ([`api-server.mjs`](api-server.mjs)), apagados a cada subida.
- `bugs-v2.spec.ts` cria a própria massa pela API e roda em todo PR, com axe (WCAG 2 A/AA).
- `smoke.spec.ts` é `@local`: depende de `data/projects/polygonus` (fora do Git). Rode com `npm run e2e:local`; o CI roda `--grep-invert "@local"`.
- Relatório HTML: artefato `relatorio-playwright` do workflow.
- Carga: [`carga/api-leitura.js`](carga/api-leitura.js) (k6), com a API subida por `npm run e2e:api:carga`.

## Próximos passos (quando quiser evoluir)

1. Mock de `/api/.../run` com `page.route` — validar UI do Play **sem** Maestro
2. Auth real com `storageState` (admin vs visitor) — UI e API

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
