# Curadoria KB ↔ GitHub

## Sync em lote (botão “Sincronizar GitHub”)

- 1× `gh pr list` (até 200 PRs)
- Reviews/commits dos PRs em revisão via **GraphQL em chunks** (não N× `gh pr view`)

Requer `gh` autenticado na máquina/VM do QA Desk.

## Webhook (tempo quase real) — recomendado

Atualiza o catálogo quando há review, merge, push ou abertura de PR — sem clicar no botão.

### 1. Secret

No `qa-desk/.env`:

```env
GITHUB_WEBHOOK_SECRET=um-segredo-longo-e-aleatorio
# opcional
GITHUB_WEBHOOK_DEBOUNCE_MS=1500
```

Reinicie a API. `GET /api/health` deve mostrar `"kbGithubWebhook": true`.

### 2. Webhook no GitHub

No repo `polygonus-br/polygonus-suporte-kb` → **Settings → Webhooks → Add webhook**:

| Campo | Valor |
|---|---|
| Payload URL | `https://<host-publico-do-qa-desk>/api/webhooks/github/kb-curation` |
| Content type | `application/json` |
| Secret | o mesmo de `GITHUB_WEBHOOK_SECRET` |
| Events | **Pull requests** + **Pull request reviews** + **Issues** + **Issue comments** + **Issue dependencies** |

Em desenvolvimento local, use um túnel (ex.: Cloudflare Tunnel / ngrok) apontando para a porta da API (`QA_APP_PORT`, default 3001).

### 3. Eventos tratados

- `pull_request`: opened, reopened, closed, synchronize, edited, ready_for_review
- `pull_request_review`: submitted, dismissed, edited
- `issues`: closed, reopened — só label **`bug`**, autor/assignee em `GITHUB_BUG_ISSUE_ACTORS` (default `PedroMedeirosDev`), e bug já com `githubIssueNumber` no Desk → status `corrigido_gestor` / `sem_correcao` / `enviado_gestor`
- `issue_comment`: created/edited — label **`bug`**, issue vinculada no Desk, autor **não** bot e (se `GITHUB_BUG_COMMENT_ACTORS` vazio) **fora** dos atores QA → histórico + `em_tratamento` (quando estava `enviado_gestor`/`reportado`) + campos `githubIssueLastComment*`
- `issue_dependencies`: blocked_by / blocking added|removed — só se alguma das issues estiver vinculada a bug no Desk → entrada no **histórico** do bug (sem mudar status)
- `ping`: healthcheck do GitHub

O handler valida `X-Hub-Signature-256`, responde 200 na hora e aplica o sync do PR com debounce (evita rajadas de `synchronize`).

### Mapeamento repo → projeto

O webhook usa um mapa **explícito** (`polygonus-br/polygonus-suporte-kb` → `polygonus`).  
Não inferir pelo `meta.repository` de todos os catálogos — no passado o seed colocava o repo da KB também em `desk`/`anihype`, e o webhook atualizava o projeto errado (merges pareciam “aceitos” mas não mudavam a Curadoria Polygonus).

### 4. Oracle / produção — `gh` obrigatório

O sync (botão **e** o trabalho do webhook em background) usa o **GitHub CLI**:

```bash
# Instalar (Ubuntu) — preferir repo oficial cli.github.com
sudo apt-get install -y gh
echo "$GITHUB_TOKEN" | gh auth login --with-token   # PAT com escopo repo
gh auth status
```

Sem `gh` no PATH: o UI mostra `spawn gh ENOENT`; o webhook ainda responde 200 no ping/accept, mas **não atualiza** o catálogo.

### Fallback

O botão **Sincronizar GitHub** na Curadoria continua válido (catch-up / importar abertas / se o webhook falhar).

## Bugs ↔ GitHub Issue (Desk)

Na ficha do bug (editor):

| Ação UI | Rota | Efeito |
|---|---|---|
| **Abrir issue GitHub** | POST /api/projects/:slug/tests/:id/github-issue | Cria issue ug na KB + nviado_gestor |
| **Sync issue GitHub** | POST .../github-issue/sync | Atualiza título/body/evidências **e** puxa comentários do gestor (gh api) se o webhook falhou |
| **Fechar issue GitHub** | POST .../github-issue/close `{ comment? }` | gh issue close + comentário opcional (homologação/build) + corrigido_gestor + githubIssueClosedAt |

Implementação: create-bug-issue.ts, sync-bug-issue.ts (pullGestorCommentsIntoReport), close-bug-issue.ts.

Se GITHUB_WEBHOOK_SECRET estiver inativo no ambiente local, comentários do gestor **não** chegam sozinhos — use **Sync** no bug.


## SSE (UI em tempo quase real)

Com a página **Curadoria KB** aberta, o browser mantém `GET /api/projects/:slug/kb-curation/stream` (Bearer). Cada gravação do catálogo (webhook, sync, parecer) emite `catalog-updated` e a lista recarrega sem F5.

Reconexão automática com backoff se a stream cair. Ao voltar à aba (`visibilitychange`), também há um refresh silencioso.

### Caddy (produção)

O `deploy/oracle/Caddyfile` já isola o path do stream **sem gzip** e com `flush_interval -1` — gzip bufferiza SSE e a UI só atualiza no F5.

Depois de atualizar o Caddyfile na VM:

```bash
sudo systemctl reload caddy
```
