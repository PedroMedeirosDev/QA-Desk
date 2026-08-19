# Curadoria KB ? GitHub

## Sync em lote (bot?o ?Sincronizar GitHub?)

- 1� `gh pr list` (at� 200 PRs)
- Reviews/commits dos PRs em revis?o via **GraphQL em chunks** (n?o N� `gh pr view`)

Requer `gh` autenticado na m�quina/VM do QA Desk.

## Webhook (tempo quase real) ? recomendado

Atualiza o cat�logo quando h� review, merge, push ou abertura de PR ? sem clicar no bot?o.

### 1. Secret

No `qa-desk/.env`:

```env
GITHUB_WEBHOOK_SECRET=um-segredo-longo-e-aleatorio
# opcional
GITHUB_WEBHOOK_DEBOUNCE_MS=1500
```

Reinicie a API. `GET /api/health` deve mostrar `"kbGithubWebhook": true`.

### 2. Webhook no GitHub

No repo `polygonus-br/polygonus-suporte-kb` ? **Settings ? Webhooks ? Add webhook**:

| Campo | Valor |
|---|---|
| Payload URL | `https://<host-publico-do-qa-desk>/api/webhooks/github/kb-curation` |
| Content type | `application/json` |
| Secret | o mesmo de `GITHUB_WEBHOOK_SECRET` |
| Events | **Pull requests** + **Pull request reviews** + **Issues** + **Issue comments** + **Issue dependencies** |

Em desenvolvimento local, use um t�nel (ex.: Cloudflare Tunnel / ngrok) apontando para a porta da API (`QA_APP_PORT`, default 3001).

### 3. Eventos tratados

- `pull_request`: opened, reopened, closed, synchronize, edited, ready_for_review
- `pull_request_review`: submitted, dismissed, edited
- `issues`: closed, reopened ? s� label **`bug`**, autor/assignee em `GITHUB_BUG_ISSUE_ACTORS` (default `PedroMedeirosDev`), e bug j� com `githubIssueNumber` no Desk ? status `corrigido_gestor` / `sem_correcao` / `enviado_gestor`
- `issue_comment`: created/edited ? label **`bug`**, issue vinculada no Desk, autor **n?o** bot e (se `GITHUB_BUG_COMMENT_ACTORS` vazio) **fora** dos atores QA ? hist�rico + `em_tratamento` (quando estava `enviado_gestor`/`reportado`) + campos `githubIssueLastComment*`
- `issue_dependencies`: blocked_by / blocking added|removed ? s� se alguma das issues estiver vinculada a bug no Desk ? entrada no **hist�rico** do bug (sem mudar status)
- `ping`: healthcheck do GitHub

O handler valida `X-Hub-Signature-256`, responde 200 na hora e aplica o sync do PR com debounce (evita rajadas de `synchronize`).

### Mapeamento repo ? projeto

O webhook usa um mapa **expl�cito** (`polygonus-br/polygonus-suporte-kb` ? `polygonus`).  
N?o inferir pelo `meta.repository` de todos os cat�logos ? no passado o seed colocava o repo da KB tamb�m em `desk`/`anihype`, e o webhook atualizava o projeto errado (merges pareciam ?aceitos? mas n?o mudavam a Curadoria Polygonus).

### 4. Oracle / produ�?o ? `gh` obrigat�rio

O sync (bot?o **e** o trabalho do webhook em background) usa o **GitHub CLI**:

```bash
# Instalar (Ubuntu) ? preferir repo oficial cli.github.com
sudo apt-get install -y gh
echo "$GITHUB_TOKEN" | gh auth login --with-token   # PAT com escopo repo
gh auth status
```

Sem `gh` no PATH: o UI mostra `spawn gh ENOENT`; o webhook ainda responde 200 no ping/accept, mas **n?o atualiza** o cat�logo.

### Fallback

O bot?o **Sincronizar GitHub** na Curadoria continua v�lido (catch-up / importar abertas / se o webhook falhar).

## Bugs ? GitHub Issue (Desk)

Na ficha do bug (editor):

| A�?o UI | Rota | Efeito |
|---|---|---|
| **Abrir issue GitHub** | POST /api/projects/:slug/tests/:id/github-issue | Cria issue ug na KB + nviado_gestor |
| **Sync issue GitHub** | POST .../github-issue/sync | Atualiza t�tulo/body/evid?ncias **e** puxa coment�rios do gestor (gh api) se o webhook falhou |
| **Fechar issue GitHub** | POST .../github-issue/close `{ comment? }` | gh issue close + coment�rio opcional (homologa�?o/build) + corrigido_gestor + githubIssueClosedAt |

Implementa�?o: create-bug-issue.ts, sync-bug-issue.ts (pullGestorCommentsIntoReport), close-bug-issue.ts.

Se GITHUB_WEBHOOK_SECRET estiver inativo no ambiente local, coment�rios do gestor **n?o** chegam sozinhos ? use **Sync** no bug.


## SSE (UI em tempo quase real)

Com a p�gina **Curadoria KB** aberta, o browser mant�m `GET /api/projects/:slug/kb-curation/stream` (Bearer). Cada grava�?o do cat�logo (webhook, sync, parecer) emite `catalog-updated` e a lista recarrega sem F5.

Com o Desk aberto (qualquer tela, admin), `GET /api/bugs/gestor-replies/stream` recebe `gestor-reply` quando o webhook/catch-up grava um coment�rio do gestor. A UI dispara toast + notifica�?o do Chrome (menu do usu�rio ? **Avisar respostas do gestor**).

Reconex?o autom�tica com backoff se a stream cair. Ao voltar ? aba (`visibilitychange`), a lista de bugs tamb�m faz um refresh silencioso.

### Caddy (produ�?o)

O `deploy/oracle/Caddyfile` j� isola os paths de stream **sem gzip** e com `flush_interval -1` ? gzip bufferiza SSE e a UI s� atualiza no F5.

Depois de atualizar o Caddyfile na VM:

```bash
sudo systemctl reload caddy
```
