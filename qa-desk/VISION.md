# QA Desk — visão / backlog

Ideias **ainda não implementadas** (ou só parcialmente). O que já roda está em [`ARCHITECTURE.md`](ARCHITECTURE.md).

> O antigo `SPEC.md` descrevia um rascunho pré-produto (`qa-dashboard`, bcrypt, Hono, `/api/portfolio`). Foi aposentado em favor destes dois docs.

## Feito (diferente do rascunho original)

- App multi-projeto com CT + bugs + homologação + dashboard + Curadoria KB + Suite API
- Auth Supabase (JWT) em vez de bcrypt/cookie em env
- Visitante: tela de boas-vindas dedicada (portfólio público ainda fechado)
- Maestro / Playwright one-click no PC + métricas por runner
- Postgres (Prisma) em produção

## Backlog desejável

### 1. Bot Discord + Moacir

Fluxo alvo:

1. Admin envia bug/CT sanitizado para canal do gestor
2. Gestor reage com ✅ → status `corrigido_gestor` + histórico na app
3. Remover ✅ → revoga confirmação
4. `homologado` **só** com confirmação manual do QA na app

Hoje só há **cópia de texto** para colar no Discord.

### 2. Portfólio visitante rico

Hoje o visitante só vê a welcome page. **API já está blindada** para o próximo passo:

- GET de testes: só `showInPortfolio === true` (hardcoded no backend) + `sanitizeVisitorData`
- Mutações: `rejectVisitorMutations` → 403
- Homologações / KB / Suite API / Automação: bloqueadas ao visitante
- Evidências: autenticadas; visitante só sob CT público

Próximo passo de UI:

- Liberar cases com `showInPortfolio=true` (payload já sanitizado)
- Campos opcionais `portfolio.headline` / `summary`
- View limpa (sem homologação interna / Curadoria KB) + `visitor-ui.ts` (inputs read-only)
- Revisar evidências antes de marcar no portfólio

### 3. Notificações na UI

- Avisos quando gestor confirma/revoga (quando o bot existir)
- Destaques de portfólio

### 4. Integrações opcionais

- Inbox Cursor / import Sentry / Linear (baixa prioridade)

## Fora de escopo (mantido)

- Multi-tenant / cadastro público aberto
- Substituir Linear ou Sentry
- Rodar Maestro na cloud (emulador só no PC)
