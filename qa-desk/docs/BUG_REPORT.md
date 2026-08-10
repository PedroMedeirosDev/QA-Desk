# Padrão de bug report — QA Desk

Operacional (admin) + Discord + visitante. UI e envio automático ainda em fases; este doc é a fonte do padrão.

## Decisões

| Tema | Decisão |
|------|--------|
| CT falho → bug | **Não** automático enquanto o script puder falhar por flakiness/mapeamento |
| Script apto a sugerir bug | Só com flag **`consolidated`** marcada **manualmente** pelo QA. Diferente de `readiness` (auto após 2 passes Maestro = “estável na suite”). No futuro o passo pode ser reduzido; hoje é essencial. |
| Chamado Polygonus | Só **citação** (texto/id no registro); sem integração com Registro de Solicitações |
| Discord | Template do gestor + **um clique** texto + print (bot; webhook fallback) · reações 👀/✅/⏸️ |
| Gatilho Discord | **Manual** (admin); sem spam a cada falha de script |
| Visitante | Métricas + cases com `showInPortfolio`; **zero PII** em qualquer hipótese |
| Evidência Playwright | Screenshot `only-on-failure` em `test-results/`; após falha do run PW no Desk, o PNG mais recente sobe para `evidence[]` (sem criar bug). |

## `readiness` vs `consolidated`

| Campo | Quem define | Significado |
|-------|-------------|-------------|
| `automation.readiness` | Auto (2 passes Maestro) ou select “Estável na suite” | Script ok para suite / métricas |
| `consolidated` | **Só manual** (checkbox no CT) | QA confia: falha ≈ bug de produto; gate para sugerir bug / auto-fluxo futuro |

Não promover `consolidated` automaticamente. No futuro o passo manual pode ser reduzido; hoje é essencial.

## Modelo mental

```text
Chamado (citação) ──► Ficha bug (TestRecord)
Print / vídeo     ──► evidence[] ──► Enviar Discord (1 clique)
CT consolidado (manual) ──► falha automação ──► sugerir bug (futuro)
readiness ready (auto 2×) ──► suite / métricas (≠ consolidado)
Ficha + showInPortfolio ──► portfólio visitante (sanitizado)
```

## Ficha operacional (campos mínimos)

Espelham [`TestRecord`](../src/types/test-record.ts):

| Campo | Uso |
|-------|-----|
| Título | Sintoma curto, sem PII no título se for a portfólio |
| Canal / plataforma | `app` / `web` / `portal` + android \| ios \| web \| api |
| Passos (`steps`) | Numerados, 1 ação por linha |
| Esperado / atual | `expectedResult` / `actualResult` |
| Build | Ex.: `6.06.13` (CQ) |
| Severidade / prioridade | Criticidade para o gestor |
| Citação do chamado | Em **`description`** (id ou trecho do chamado Polygonus); sem campo dedicado |
| Evidência | PNG/MP4/log em `evidence[]` |
| Notas internas | Ok ter PII operacional; **nunca** no portfólio |
| `showInPortfolio` | Só após revisar evidência e texto sanitizável |

**Exemplo-ouro (sanitizado):** App — eletivas ausentes no filtro de disciplina; homologado na build `6.06.13`.

## Discord

Formato vigente: [`formatDiscordReport`](../src/lib/discord-report.ts) (máscara PII via `maskPii`; markdown Discord: **negrito** em título e rótulos).

- Em bugs, `description` = citação do chamado → linha `**Chamado:** …` no texto Discord (não entra como “resultado atual”).
- **Gravidade** (`severity`): select na ficha + linha `**Gravidade:**` no report.
- Web: campo **Navegador** (`browser`) entra em **Ambiente web:** no report; mobile continua com SO/Dispositivo.
- **Login** (`testLogin`): conta usada no teste (ex. PHJESUS) — linha `**Login:**` no ambiente.
- **Código do bug** (`bugCode`): público por canal — `APP-01`, `WEB-02`, `PORTAL-nn` (auto ao criar). O `id` interno `BUG-2026-xxx` permanece para storage.
- Botões: **Copiar report Discord** (clipboard) + **Enviar Discord** (bot ou webhook).

Discord abre com `**[APP-01] Título**` quando há `bugCode`.

### Reações do gestor (pré-colocadas na mensagem)

O bot coloca 👀 ✅ ⏸️ na mensagem e um texto **Ações — clique na reação abaixo**. Emojis fora dessa lista são **removidos** automaticamente (nas mensagens vinculadas ao Desk).

| Emoji | Status Desk | Significado |
|-------|-------------|-------------|
| 🔧 | `em_tratamento` | Gestor está tratando / em correção |
| ✅ | `corrigido_gestor` | Corrigido do lado do gestor |
| ⏸️ | `sem_correcao` | Sem correção no momento |
| ❌ | `cancelado` | Cancelado (**não** apaga a mensagem no Discord) |
| Remover a reação que segura o status | `enviado_gestor` | Volta para “enviado” |
| 💯 (bot) | — | QA homologou no Desk — confirmação visual |

Só **uma** reação de status humana fica ativa: ao marcar outra, o bot remove as demais (mantém as seeds do bot para clicar).

`homologado` continua **só** com confirmação manual do QA na app; aí o bot adiciona **💯**.

**Dica de canal:** em Permissões do canal, tire **Adicionar reações** de @everyone (mantenha Ver canal / Ler histórico). Assim o gestor só consegue clicar nas reações que o bot já deixou — não consegue inventar emoji novo.

### Bot (recomendado)

1. [Discord Developer Portal](https://discord.com/developers/applications) → New Application → Bot → Reset Token → `DISCORD_BOT_TOKEN`
2. OAuth2 URL Generator: scope `bot`; permissões **Send Messages**, **Attach Files**, **Add Reactions**, **Read Message History**, **View Channels**, **Manage Messages** (para remover reações fora do mapa)
3. Convidar o bot ao servidor; copiar ID do canal de bugs → `DISCORD_BUG_CHANNEL_ID`
4. (Opcional) `DISCORD_GESTOR_USER_IDS=` snowflakes do gestor (só a reação deles conta)
5. Reiniciar `npm run dev` — log `[discord-bot] online como …`

Fluxo: **Enviar Discord** → mensagem + 3 reações seed + `discordMessageId` → gestor reage → status no Desk. Homologação final continua só na app.

Fallback: `DISCORD_BUG_WEBHOOK_URL` envia sem bot; reações só funcionam se o bot estiver online e a mensagem tiver sido vinculada (`wait=true` no webhook grava `messageId` quando possível).

**Limites Discord:** ~10 MB/arquivo; preferir PNG; vídeo opcional/compacto.

**Onde o segredo mora:** só `.env` do servidor (`DISCORD_BOT_TOKEN` / webhook) — nunca `VITE_` / bundle.
## Playwright / evidência

Na suíte Polygonus: `screenshot: "only-on-failure"` e `trace: "retain-on-failure"`. Após falha de run Playwright pelo Desk, o PNG mais recente em `test-results/` é copiado para `evidence[]` (sem criar bug). Vídeo Playwright **não** ligado por default.

## Visitante (Fatia 6)

- Backend: filtro `showInPortfolio === true` + `sanitizeVisitorTestRecord` (bugs sem citação/`description`).
- UI: [`VisitorPortfolioPage`](../src/pages/VisitorPortfolioPage.tsx) — métricas diárias liberadas + lista expansível de cases.
- Liberar na UI só cases revisados; sem nome de aluno, RA, e-mail, etc.
- Métricas agregadas ok; detalhe operacional (chamado, notas internas) fora.

## Homologação (próximo — inventário + scripts)

| Runner | Como acessa | Escopo de teste |
|--------|-------------|-----------------|
| **Maestro (APP nativo)** | App Android no emulador | **Todos** os menus |
| **Playwright (WEB)** | Sistema web → **Comunicação → Comunicados** (abre o **mesmo app** na versão web) | **O mesmo** — app inteiro, não só a tela Comunicados |

Ou seja: WEB não é “só o módulo Comunicados”; esse caminho é a **entrada** do app web. Os casos espelham o APP.

Lista de testes manuais da empresa foi apagada; inventário quase do zero (histórico/mural no repo ajuda). **Mural/Comunicados** é de longe o mais complexo.

Ordem quando chegar a hora: inventário auto vs manual → gaps → scripts (Maestro + PW) → marcar `consolidated` nos estáveis.

- Integração com Registro de Solicitações Polygonus
- Criação automática de bug a cada falha de CT
- Spam automático no Discord
- Video Playwright ligado por default
- Multi-tenant / cadastro público aberto
