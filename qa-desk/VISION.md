# QA Desk — visão / backlog

Ideias **ainda não implementadas** (ou só parcialmente). O que já roda está em [`ARCHITECTURE.md`](ARCHITECTURE.md).

> O antigo `SPEC.md` descrevia um rascunho pré-produto (`qa-dashboard`, bcrypt, Hono, `/api/portfolio`). Foi aposentado em favor destes dois docs.

## Feito (diferente do rascunho original)

- App multi-projeto com CT + bugs + homologação + dashboard + Curadoria KB + Suite API
- Auth Supabase (JWT) em vez de bcrypt/cookie em env
- Visitante: portfólio com métricas diárias liberadas + cases `showInPortfolio` (sanitizados)
- Maestro / Playwright one-click no PC + métricas por runner
- Postgres (Prisma) em produção

## Backlog desejável

### 1. Bot Discord + Moacir

Padrão operacional (ficha, citação, evidência, gatilhos): [`docs/BUG_REPORT.md`](docs/BUG_REPORT.md).

Fluxo:

1. Admin envia bug sanitizado (**Enviar Discord**) — bot preferencial; webhook como fallback
2. Desk guarda `discordMessageId`; bot pré-coloca 👀 ✅ ⏸️
3. Gestor reage: 🔧 `em_tratamento` · ✅ `corrigido_gestor` · ⏸️ `sem_correcao` · ❌ `cancelado` (só a última conta)
4. Remover a reação que segura o status → `enviado_gestor`
5. `homologado` **só** com confirmação manual do QA na app → bot reage 💯

**Feito:** bot + envio + reações 👀/✅/⏸️ + gravidade no report. Clipboard permanece como fallback.

Ainda desejável: notificação in-app quando o gestor reage.

### 2. Portfólio visitante (próximos refinamentos)

**Feito (Fatia 6):** visitante vê métricas diárias liberadas (`DailySummaryPanel`) + lista expansível de cases com `showInPortfolio` (API filtrada + `sanitizeVisitorTestRecord`). Sem nav operacional.

Ainda desejável:

- Campos opcionais `portfolio.headline` / `summary`
- View de detalhe mais rica + `visitor-ui.ts` (inputs read-only)
- Revisar evidências antes de marcar no portfólio
- Destaques / notificações quando gestor confirma (com bot Discord)

### 3. Notificações na UI

- Avisos quando gestor confirma/revoga (quando o bot existir)
- Destaques de portfólio

### 4. Integrações opcionais

- Inbox Cursor / import Sentry / Linear (baixa prioridade)

## Fora de escopo (mantido)

- Multi-tenant / cadastro público aberto
- Substituir Linear ou Sentry
- Rodar Maestro na cloud (emulador só no PC)
