# Postman / Newman — API QA Desk

Collection de contratos HTTP do **próprio** QA Desk (dogfooding).  
Útil no currículo: Postman Desktop + **Newman** (CLI).

## O que cobre (MVP)

| Pasta | Requests |
|-------|----------|
| Health | `GET /api/health` |
| Tests CRUD | listar → criar CT → buscar por id → atualizar título |

Auth: **mock admin** (`QA_E2E_MOCK=1`), porta **3011** — sem JWT.

## No Postman Desktop

1. Import → `qa-desk-api.postman_collection.json`
2. Import → `local.postman_environment.json` e selecione o environment
3. Suba a API: `npm run e2e:api` (outro terminal)
4. Run collection

## Via CLI (Newman)

```powershell
cd qa-desk
npm install
npm run test:api:postman
```

O script sobe a API mock, roda a collection e encerra.

Equivalente manual:

```powershell
npm run e2e:api
# outro terminal:
npx newman run postman/qa-desk-api.postman_collection.json -e postman/local.postman_environment.json
```

## Par Playwright

Mesmos cenários em código: `npm run test:api` → [`../e2e/api/`](../e2e/api/).

## Entrevista (falar assim)

- Montei collection Postman com asserts (`pm.test`) para health e CRUD de CT
- Automatizei no CI/local com **Newman**
- Espelhei os mesmos casos em Playwright `APIRequestContext` no monorepo
