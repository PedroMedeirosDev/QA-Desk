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
| Events | **Pull requests** + **Pull request reviews** (ou “Send me everything”) |

Em desenvolvimento local, use um túnel (ex.: Cloudflare Tunnel / ngrok) apontando para a porta da API (`QA_APP_PORT`, default 3001).

### 3. Eventos tratados

- `pull_request`: opened, reopened, closed, synchronize, edited, ready_for_review
- `pull_request_review`: submitted, dismissed, edited
- `ping`: healthcheck do GitHub

O handler valida `X-Hub-Signature-256`, responde 200 na hora e aplica o sync do PR com debounce (evita rajadas de `synchronize`).

### Fallback

O botão **Sincronizar GitHub** na Curadoria continua válido (catch-up / importar abertas / se o webhook falhar).
