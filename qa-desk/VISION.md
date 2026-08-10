# QA Desk — visão / backlog

Ideias **ainda não implementadas** (ou só parcialmente). O que já roda está em [`ARCHITECTURE.md`](ARCHITECTURE.md).

> O antigo `SPEC.md` descrevia um rascunho pré-produto (`qa-dashboard`, bcrypt, Hono, `/api/portfolio`). Foi aposentado em favor destes dois docs.

## Feito (diferente do rascunho original)

- App multi-projeto com CT + bugs + homologação + dashboard + Curadoria KB + Suite API
- Auth Supabase (JWT) em vez de bcrypt/cookie em env
- Visitante: portfólio com métricas diárias liberadas + cases `showInPortfolio` (sanitizados)
- Maestro / Playwright one-click no PC + métricas por runner
- Postgres (Prisma) em produção
- Handoff de bug → GitHub Issue (KB, label `bug`)

## Backlog desejável

### 1. Handoff de bugs (GitHub)

Padrão: [`docs/BUG_REPORT.md`](docs/BUG_REPORT.md).

**Feito:** **Abrir issue GitHub** → `polygonus-suporte-kb` + label `bug` · body Markdown + evidências na branch `bug-evidence` · `githubIssueUrl` no Desk · status `enviado_gestor`. **Volta:** webhook fecha/reabre issue → status do bug (só `bug` + vinculado a Pedro). Discord fora do handoff oficial.

Ainda desejável: sync issue fechada → status Desk; anexar evidências na issue; notificação in-app.

### 2. Portfólio visitante (próximos refinamentos)

**Feito (Fatia 6):** visitante vê métricas diárias liberadas (`DailySummaryPanel`) + lista expansível de cases com `showInPortfolio` (API filtrada + `sanitizeVisitorTestRecord`). Sem nav operacional.

Ainda desejável:

- Campos opcionais `portfolio.headline` / `summary`
- View de detalhe mais rica + `visitor-ui.ts` (inputs read-only)
- Revisar evidências antes de marcar no portfólio
- Destaques quando correção voltar (issue/PR)

### 3. Notificações na UI

- Avisos quando gestor confirma/revoga (quando o bot existir)
- Destaques de portfólio

### 4. Integrações opcionais

- Inbox Cursor / import Sentry / Linear (baixa prioridade)

## Fora de escopo (mantido)

- Multi-tenant / cadastro público aberto
- Substituir Linear ou Sentry
- Rodar Maestro na cloud (emulador só no PC)
