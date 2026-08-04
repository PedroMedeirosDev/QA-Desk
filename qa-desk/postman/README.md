# Postman / Newman — suites por projeto

Collections de contratos HTTP. Cada pasta em `postman/projects/<suiteId>/` com `manifest.json` vira um card na Suite API.

```
postman/projects/
  desk/                    # dogfood da API do QA Desk (mock 3011)
  polygonus-auth/          # pronta — Auth SUPPETER (+ contexto aluno até a Ficha separar)
  polygonus-ficha/         # pendente
  polygonus-matronline/    # pendente
  polygonus-grade/         # pendente
  polygonus-findocs/       # pendente
  polygonus-cobranca/      # pendente
  polygonus-gateways/      # pendente
  polygonus-contab/        # pendente
  polygonus-pedagogico/    # pendente
  polygonus-portal/        # pendente
  polygonus-cadastros/     # pendente
  polygonus-sistema/       # pendente
```

O campo `project` no manifest agrupa várias suites no mesmo projeto da UI (`polygonus`, `desk`). `order` define a ordem dos cards. Suites com `ready: false` aparecem como **pendente** e não precisam de `collection.json` ainda.

## CLI

```powershell
cd qa-desk
npm run test:api:postman              # suite desk
npm run test:api:postman:polygonus    # polygonus-auth — precisa POLY_API_SENHA no .env
```

## UI no Desk

Projeto → **Suite API** (`/projects/:slug/suite-api`):

- botão **Rodar suite** (só se `ready`)
- resumo mastigado (requests / asserts / falhas)
- toggle **Ver log Newman (fiel)**

## Polygonus — variáveis

No `.env` do `qa-desk` (não commitar senha):

```
# CQ: gestão …:8443/web/react/gestao — API = mesmo host + /api/v2
POLY_API_BASE_URL=https://amostra.polygonus.com.br:8443/api/v2
POLY_API_LOGIN=SUPPETER
POLY_API_SENHA=...
POLY_API_UNIDADE=Colégio Demonstração
POLY_API_HOSTNAME=amostra.polygonus.com.br
POLY_API_ANO=2026
```

Fallback: se `POLY_API_SENHA` estiver vazia, usa `PLAYWRIGHT_SENHA`.

## Postman Desktop

1. Import `projects/desk/collection.json` + environment  
2. Ou `projects/polygonus-auth/collection.json` + `amostra.postman_environment.json`  
3. Preencha `senha` no environment local  

## Par Playwright API (Desk)

`npm run test:api` — mesma ideia em TypeScript (`e2e/api/`).
