# Padrão de bug report — QA Desk

Operacional (admin) + handoff GitHub Issue + visitante. Este doc é a fonte do padrão.

## Decisões

| Tema | Decisão |
|------|--------|
| CT falho → bug | **Não** automático enquanto o script puder falhar por flakiness/mapeamento |
| Script apto a sugerir bug | Só com flag **`consolidated`** marcada **manualmente** pelo QA. Diferente de `readiness` (auto após 2 passes Maestro = “estável na suite”). No futuro o passo pode ser reduzido; hoje é essencial. |
| Chamado Polygonus | Só **citação** (texto/id no registro); sem integração com Registro de Solicitações |
| Handoff ao time | **GitHub Issue** em `polygonus-br/polygonus-suporte-kb` com label **`bug`** (input para agente / gestor) |
| Gatilho | **Manual** (admin) — botão **Abrir issue GitHub**; sem spam a cada falha de script |
| Discord | **Fora do handoff** (código legado pode existir; UI não envia) |
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
Print / vídeo     ──► evidence[] ──► Abrir issue GitHub (label bug)
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

## Handoff GitHub (oficial)

Formato: [`formatBugReportMarkdown`](../src/lib/bug-report-markdown.ts) (headings estáveis + `maskPii`).

- Título da issue: `[APP-01] Sintoma` (`bugCode` + título).
- Repo default: `polygonus-br/polygonus-suporte-kb` · label **`bug`** (override: `GITHUB_BUG_ISSUES_REPO`).
- Botão **Abrir issue GitHub** → `POST .../github-issue` → sobe evidências na branch `bug-evidence` + `gh issue create` · status `enviado_gestor` · grava `githubIssueNumber` / `githubIssueUrl`.
- Reenvio: se já vinculada, não duplica — abre o link.
- Evidências: arquivos anexados no body (imagens embutidas via Contents API na branch `bug-evidence`).
- Pré-requisito: `gh` autenticado com write no repo KB.
- **Volta (webhook):** issue `closed`/`reopened` com label `bug` + autor/assignee em `GITHUB_BUG_ISSUE_ACTORS` + já vinculada no Desk → status `corrigido_gestor` / `sem_correcao` (not_planned) / `enviado_gestor`. Dependências (blocked-by) → histórico do bug. Mesmo endpoint da Curadoria; no GitHub habilitar **Issues** + **Issue dependencies**.

**Copiar report Markdown** — clipboard com o mesmo body (opcional).

Catch-up em lote (issues perdidas): ainda manual / futuro botão.

### Discord (legado)

Código do bot/webhook permanece no repo, mas **não** é o handoff oficial. Não usar na rotina Polygonus.

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
- Spam automático de issues / Discord
- Video Playwright ligado por default
- Multi-tenant / cadastro público aberto
