# QA Desk

Repositório **multi-projeto** de qualidade de software: homologação, casos de teste, automação (Maestro / Playwright) e aplicação web de registro.

> **Produto:** [QA Desk](https://github.com/PedroMedeirosDev/QA-Desk)  
> **Demo online:** [https://qa-desk-pedro.duckdns.org](https://qa-desk-pedro.duckdns.org)  
> **App:** pasta `qa-desk/` · projetos `polygonus`, `anihype`, `desk`, …

**Login visitante** (`visitante@qa-desk.local`): tela de boas-vindas apenas — portfólio público ainda em configuração (sem CTs, métricas, Curadoria KB). **Admin** vê o conteúdo completo.

## Projetos

| Slug | Pasta | Status |
|------|-------|--------|
| **polygonus** | [`projects/polygonus/`](projects/polygonus/) | Ativo — Mural / Maestro / Playwright / Curadoria KB |
| **anihype** | [`projects/anihype/`](projects/anihype/) | Em setup |
| **desk** | (só no app) | Dogfood — Suite API do próprio QA Desk |

Detalhes: [`projects/README.md`](projects/README.md)

## Estrutura na raiz

| Pasta / item | Uso |
|--------------|-----|
| **`projects/`** | Um diretório por cliente/produto (cases, automação, evidência) |
| **`shared/`** | Templates e recursos comuns |
| [`docs/COLORS.md`](qa-desk/docs/COLORS.md) | Cores: marca, projetos, claro/escuro |
| **`qa-desk/`** | App web — [`ARCHITECTURE.md`](qa-desk/ARCHITECTURE.md) · [`DEPLOY.md`](qa-desk/DEPLOY.md) · [`VISION.md`](qa-desk/VISION.md) · [`docs/COLORS.md`](qa-desk/docs/COLORS.md) |
| **`scripts/`** | Utilitários locais (ex. sync repos empresa) |
| **`polygonus-mobile/`**, **`polygonus-react/`**, … | Clones locais (gitignored — não versionar) |

## Escopo de homologação

| Plataforma | Cobertura |
|------------|-----------|
| Android | Sim (emulador + smoke no físico) |
| Web | Sim (Playwright / Newman) |
| iOS | Não neste ambiente |

## QA Desk (app) — início rápido

```powershell
cd qa-desk
copy .env.example .env
# Preencha Supabase (Auth + Postgres) — ver qa-desk/deploy/SUPABASE_CREDENTIALS.md
# Preferir região sa-east-1 (São Paulo) para latência no Brasil
npm install
npm run dev
```

| Serviço | URL |
|---------|-----|
| UI (Vite) | http://localhost:5174 |
| API | http://localhost:3001 |

Com Auth ligado, use **só** `:5174` em desenvolvimento (a API em modo production serviria `dist/` antigo).

```powershell
npx prisma migrate deploy   # schema no Postgres (Supabase ou Docker)
npm run db:migrate-json     # importa JSON → Postgres
npx tsx scripts/apply-mural-checklist.ts   # checklist Mural canônico (CRUD-01…)
```

Credenciais ficam **só locais** (`.env` gitignored). Modelo: [`qa-desk/.env.example`](qa-desk/.env.example) e [`.env.production.example`](qa-desk/.env.production.example).

Para o botão **Acessar como visitante** no login: `VITE_VISITOR_EMAIL` + `VITE_VISITOR_PASSWORD` (a senha também precisa estar no usuário Supabase Auth).

## Deploy

| Alvo | Doc |
|------|-----|
| Local / túnel | [`qa-desk/DEPLOY.md`](qa-desk/DEPLOY.md) |
| Oracle Always Free | [`qa-desk/deploy/oracle/README.md`](qa-desk/deploy/oracle/README.md) |
| Supabase (keys / Connect) | [`qa-desk/deploy/SUPABASE_CREDENTIALS.md`](qa-desk/deploy/SUPABASE_CREDENTIALS.md) |

## Maestro / Playwright (Polygonus Mural)

Flows Maestro: `projects/polygonus/automation/maestro/`. Specs Playwright: `projects/polygonus/automation/playwright/`.  
Na lista de testes, o toggle **Maestro | Playwright** por suite mostra métricas **separadas** por runner.  
Skill do agente: `.cursor/skills/polygonus-mural-maestro/`.

## Suite API (Newman)

No app: **Suite API** (sidebar do projeto). Collections em `qa-desk/postman/projects/` (`desk` · `polygonus` ficha/amostra).  
CLI: `cd qa-desk` → `npm run test:api:postman` / `npm run test:api:postman:polygonus`. Detalhes: [`qa-desk/postman/README.md`](qa-desk/postman/README.md).

## Clones locais (somente leitura)

```powershell
.\sync.bat
```
