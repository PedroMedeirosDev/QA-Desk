# Postman / Newman — suites por projeto

Collections de contratos HTTP, uma pasta por produto:

```
postman/projects/
  desk/         # dogfood da API do QA Desk (mock 3011)
  polygonus/    # amostra — Auth SUPPETER + ficha (aluno/contexto)
```

## CLI

```powershell
cd qa-desk
npm run test:api:postman              # suite desk
npm run test:api:postman:polygonus    # precisa POLY_API_SENHA no .env
```

## UI no Desk

Projeto → **Suite API** (`/projects/:slug/suite-api`):

- botão **Rodar suite**
- resumo mastigado (requests / asserts / falhas)
- toggle **Ver log Newman (fiel)**

## Polygonus — variáveis

No `.env` do `qa-desk` (não commitar senha):

```
POLY_API_BASE_URL=https://amostra.polygonus.com.br/api/v2
POLY_API_LOGIN=SUPPETER
POLY_API_SENHA=...
POLY_API_UNIDADE=Colégio Demonstração
POLY_API_HOSTNAME=amostra.polygonus.com.br
POLY_API_ANO=2026
```

Fallback: se `POLY_API_SENHA` estiver vazia, usa `PLAYWRIGHT_SENHA`.

## Postman Desktop

1. Import `projects/desk/collection.json` + environment  
2. Ou `projects/polygonus/collection.json` + `amostra.postman_environment.json`  
3. Preencha `senha` no environment local  

## Par Playwright API (Desk)

`npm run test:api` — mesma ideia em TypeScript (`e2e/api/`).
