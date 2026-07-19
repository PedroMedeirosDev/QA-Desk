# QA Desk

Repositório **multi-projeto** de qualidade de software: homologação, casos de teste, automação (Maestro) e aplicação web de registro.

> **Produto:** [QA Desk](https://github.com/PedroMedeirosDev/QA-Desk)  
> **App:** pasta `qa-desk/` (antes `qa-app/`) · projetos `polygonus`, `anihype`, …

## Projetos

| Slug | Pasta | Status |
|------|-------|--------|
| **polygonus** | [`projects/polygonus/`](projects/polygonus/) | Ativo — Mural / Maestro / homologação |
| **anihype** | [`projects/anihype/`](projects/anihype/) | Em setup |

Detalhes: [`projects/README.md`](projects/README.md)

## Estrutura na raiz

| Pasta / item | Uso |
|--------------|-----|
| **`projects/`** | Um diretório por cliente/produto (cases, automação, evidência) |
| **`shared/`** | Templates e recursos comuns |
| **`qa-desk/`** | App web — [`ARCHITECTURE.md`](qa-desk/ARCHITECTURE.md) · [`DEPLOY.md`](qa-desk/DEPLOY.md) · [`VISION.md`](qa-desk/VISION.md) |
| **`scripts/`** | Utilitários locais (ex. rename) |
| **`polygonus-mobile/`**, **`polygonus-react/`** | Clones locais (gitignored — não versionar) |

## Escopo de homologação

| Plataforma | Cobertura |
|------------|-----------|
| Android | Sim (emulador + smoke no físico) |
| Web | Sim |
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

## Deploy

| Alvo | Doc |
|------|-----|
| Local / túnel | [`qa-desk/DEPLOY.md`](qa-desk/DEPLOY.md) |
| Oracle Always Free | [`qa-desk/deploy/oracle/README.md`](qa-desk/deploy/oracle/README.md) |
| Supabase (keys / Connect) | [`qa-desk/deploy/SUPABASE_CREDENTIALS.md`](qa-desk/deploy/SUPABASE_CREDENTIALS.md) |

## Maestro (Polygonus Mural)

Flows em `projects/polygonus/automation/maestro/`. Skill do agente: `.cursor/skills/polygonus-mural-maestro/`.

## Clones locais (somente leitura)

```powershell
.\sync.bat
```
