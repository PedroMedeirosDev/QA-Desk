# Contexto do projeto QA Desk — para assistentes de IA (Gemini, Cursor, etc.)

> **Leia isto antes de sugerir código, stack ou arquitetura.**  
> Instruções genéricas do tipo “React + Next.js + SQLite” **não se aplicam** a este repositório.

Documento irmão (humano): [`../ARCHITECTURE.md`](../ARCHITECTURE.md) · backlog: [`../VISION.md`](../VISION.md).

---

## 1. O que é o produto

**QA Desk** é um app de **portfólio + operação de QA** multi-projeto:

- Registro de **casos de teste (CT)** e **bugs**
- **Homologações** (campanhas, ex.: Mural; **CQ diário** WEB React no Amostra). Página da campanha: briefing + **Exportar escopo HTML**. Campo `scope` no registro.
- Execução **Maestro** (Android) e **Playwright** (web) — no PC local ou via **agente remoto**
- **Curadoria KB** (PRs GitHub da base de conhecimento) — Polygonus, admin only
- **Suite API** (Newman / Postman)
- Auth: perfil **admin** (tudo) e **visitor** (hoje só tela de boas-vindas; portfólio rico no backlog)

**Demo:** https://qa-desk-pedro.duckdns.org  
**Repo:** https://github.com/PedroMedeirosDev/QA-Desk  
**Idioma da UI:** português (Brasil).

---

## 2. Stack real (obrigatório respeitar)

| Camada | Tecnologia | NÃO usar / NÃO assumir |
|--------|------------|-------------------------|
| Front | **React 18 + Vite + TypeScript + Tailwind CSS + React Router** | Next.js, Pages Router, App Router |
| API | **Express 5** em `qa-desk/server/` (mesmo processo serve `dist/` em prod) | Next API routes, Hono como app principal |
| Dados (prod) | **Postgres (Supabase sa-east-1) via Prisma** | SQLite como banco principal |
| Dados (dev fallback) | JSON em `qa-desk/data/projects/{slug}/` | — |
| Auth | **Supabase Auth (JWT Bearer)** + tabela `profiles` (`admin` \| `visitor`) | bcrypt local como auth de produção, cookies de sessão Next |
| Deploy | **Oracle Always Free** (VM Ubuntu) + **Caddy** + systemd + cron `auto-deploy.sh` | Vercel-only como default |
| Automação | Maestro + Playwright + Newman; agente Node (`npm run agent`) | — |

**Monorepo na prática:**

```
Qa Desk/                          # raiz do git
├── projects/                     # artefatos por cliente (maestro, playwright, homologação)
│   ├── polygonus/
│   ├── anihype/
│   └── …
├── qa-desk/                      # ★ aplicação web (npm package)
│   ├── src/                      # React (Vite)
│   ├── server/                   # Express API
│   ├── prisma/                   # schema + migrations Postgres
│   ├── data/                     # JSON seed / uploads (git parcial)
│   ├── deploy/oracle/            # VM, Caddy, auto-deploy
│   ├── docs/                     # COLORS.md, este arquivo, …
│   ├── ARCHITECTURE.md
│   ├── VISION.md
│   └── package.json
├── shared/
└── README.md
```

Comandos típicos (PowerShell):

```powershell
cd qa-desk
npm run dev          # UI :5174 + API :3001
npm run build && npm start   # produção local
```

---

## 3. Papéis e segurança (visitante)

| Role | UI | API |
|------|----|-----|
| `admin` | App completo | CRUD + automation + KB + suite |
| `visitor` | **Portfólio** (`VisitorPortfolioPage`: métricas + cases `showInPortfolio`) | GET limitado; **sem mutações** |

Regras de backend (já implementadas — não reinventar com `/api/public` Next):

- Middleware `rejectVisitorMutations` → métodos ≠ GET/HEAD/OPTIONS → **403** genérico
- Testes: filtro **hardcoded** `showInPortfolio === true` (nunca confiar em query/body)
- Respostas de visitante passam por `sanitizeVisitorData` (`server/privacy/sanitize-visitor.ts`)
- Homologações / KB / Suite API / Automação: `forbidVisitor` ou `requireAdmin`
- Evidências: `/api/evidence` **autenticado**; visitante só sob CT público
- PII: e-mails mascarados (`j****@dominio`), docs/tel → `[CONFIDENCIAL]`, nomes abreviados

Portfólio rico (listar CTs públicos na UI) = **backlog** (`VISION.md`) — a API já está preparada; a UI ainda não libera.

---

## 4. Estrutura de pastas relevantes (`qa-desk/`)

```
src/
  App.tsx                 # shell: sidebar + header + rotas; visitante → welcome
  pages/                  # Login, TestList, TestEditor, Homologation*, Dashboard, Kb*, ApiSuite, VisitorWelcome
  components/             # UI: PremiumTooltip, DesignCheckbox, OpsStatusCluster, ProjectSidebar, UserBar, …
  lib/                    # api.ts, suite metrics, visitor-ui.ts, redact-pii (client display)
  auth/                   # AuthProvider (Supabase)
  index.css               # tokens --project-highlight-*, scrollbar, selection, themes

server/
  index.ts                # Express entry, helmet, CORS, rotas
  middleware/auth.ts      # attachUser, requireAdmin, isVisitor, rejectVisitorMutations, forbidVisitor
  middleware/security.ts  # rate limit, CORS
  routes/                 # tests, homologations, automation, kb-curation, daily-summary, api-suite, evidence, agent
  privacy/                # redact-pii.ts, sanitize-visitor.ts
  db/                     # Prisma helpers
  agent-jobs.ts           # fila remota Maestro
```

---

## 5. UI / design system (padrões atuais)

- **Sem** Material UI / Bootstrap / shadcn “pesado” como base — componentes próprios + Tailwind
- Tooltips: **`PremiumTooltip`** (`side`: top|bottom|left|right) — **proibido** `title=` nativo em controles
- Checkbox: **`DesignCheckbox`**
- UserBar: status **Agente** + **AVD** (`OpsStatusCluster`) + tema + logout
- Sidebar: botão expandir/recolher **circular flutuante** na borda (`-right-[0.75rem]`), tooltip à direita
- Shell rígido: sidebar `16rem` / colapsada `4.5rem`, header `4rem`, conteúdo `flex-1`
- Tokens: `--project-highlight-bg|text|border`, temas claro/escuro — ver `docs/COLORS.md`
- Preferir `rem` / escala Tailwind; evitar libs de UI genéricas
- Micro-interações: `duration-150` / `duration-200`

---

## 6. Projetos de negócio

| Slug | Uso |
|------|-----|
| `polygonus` | Principal — Mural, Maestro, Playwright, Curadoria KB, homologação **CQ diário** (notas/conteúdo/frequência WEB React no Amostra) |
| `anihype` | Em setup — CTs e Playwright ainda não são o default; registrar campanha no Desk **antes** de gerar spec |
| `desk` | Dogfood — Suite API do próprio Desk |

Artefatos de automação Polygonus: `projects/polygonus/automation/maestro|playwright/`.

---

## 7. Deploy (Oracle)

- Host SSH alias típico: `qa-desk-oracle`
- Repo na VM: `~/QA-Desk`
- Script: `qa-desk/deploy/oracle/auto-deploy.sh` (`git pull` + `npm ci` + `prisma migrate deploy` + `npm run build` + `systemctl restart qa-desk`)
- Domínio: DuckDNS + Caddy (TLS)
- Env de produção **só na VM** (`.env`) — nunca no git

---

## 8. Anti-padrões (erros comuns de IAs)

1. Sugerir **Next.js / App Router / `app/api`** — este app é **Vite + Express**.
2. Sugerir **SQLite** como store — prod é **Postgres/Supabase**; JSON é fallback/seed. Com `DATABASE_URL`, `writeCatalog` grava **Postgres + JSON** (espelho). Live ≠ localhost se o `DATABASE_URL` for outro.
2b. Listar bugs Polygonus no canal **App** quando o defeito é **WEB** (gestão React) — usar **WEB → Bugs** (`WEB-01`, `WEB-02`, …).
2c. Recarregar o editor no `TOKEN_REFRESHED` / Alt+Tab — apaga texto não salvo; o Auth ignora refresh de token para remount.
3. Criar rotas `/api/public/...` no estilo Next sem encaixar no Express existente.
4. Confiar em filtro `is_public` vindo do cliente — o campo real é **`showInPortfolio`**, filtrado **no servidor**.
5. Sanitizar PII **só no React** — Network vaza; sanitização é **backend**.
6. Usar `title=` nativo em botões/ícones — usar `PremiumTooltip`.
7. Expor Curadoria KB / homologações / automation ao visitante.
8. Assumir dark-mode purple glow / cards genéricos de “AI landing” — seguir `COLORS.md` e tokens do projeto.

---

## 9. Como pedir mudanças (prompt útil)

Ao pedir refino de UI/API, cite:

- Arquivo-alvo sob `qa-desk/src` ou `qa-desk/server`
- Se é **admin** ou **visitor**
- Que a stack é **Vite + Express + Supabase/Postgres**
- Links: `ARCHITECTURE.md`, `docs/COLORS.md`, `VISION.md`

Exemplo:

> No QA Desk (Vite+Express, não Next), endureça X em `server/routes/tests.ts` para visitante, usando `showInPortfolio` e `sanitizeVisitorData` já existentes.
