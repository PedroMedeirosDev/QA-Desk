#!/usr/bin/env bash
# Auto-deploy QA Desk na VM Oracle (cron ou manual).
# Uso: bash ~/QA-Desk/qa-desk/deploy/oracle/auto-deploy.sh
# Cron (a cada 5 min): ver README nesta pasta.
set -euo pipefail

REPO="${QA_DESK_REPO:-$HOME/QA-Desk}"
APP="$REPO/qa-desk"
BRANCH="${QA_DESK_BRANCH:-main}"
LOG_DIR="${QA_DESK_DEPLOY_LOG_DIR:-$HOME/QA-Desk/logs}"
LOG_FILE="$LOG_DIR/auto-deploy.log"
LOCK_FILE="${XDG_RUNTIME_DIR:-/tmp}/qa-desk-auto-deploy.lock"
GH_REPO="${QA_DESK_GH_REPO:-PedroMedeirosDev/QA-Desk}"
CI_WORKFLOW="${QA_DESK_CI_WORKFLOW:-qa-desk-ci.yml}"
CI_BLOQUEIO="$LOG_DIR/.ci-bloqueado"

mkdir -p "$LOG_DIR"

log() {
  echo "[$(date -Iseconds)] $*" | tee -a "$LOG_FILE"
}

# Situação do workflow de CI no commit: success | failure | cancelled | pendente | ausente | erro
ci_status() {
  local json
  json=$(curl -fsS -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$GH_REPO/actions/workflows/$CI_WORKFLOW/runs?head_sha=$1&per_page=1") || {
    echo erro
    return
  }
  jq -r '.workflow_runs[0] // empty
    | if .status != "completed" then "pendente" else (.conclusion // "pendente") end' <<<"$json" \
    | grep . || echo ausente
}

# Evita duas execuções em paralelo (cron overlap)
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "skip: outra execução em andamento"
  exit 0
fi

cd "$REPO"

# Repo limpo o suficiente para pull (não sobrescreve .env)
git fetch origin "$BRANCH" --quiet

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")

if [[ "$LOCAL" == "$REMOTE" ]]; then
  # silencioso quando não há mudança (cron frequente)
  exit 0
fi

# Só publica commit com CI verde. QA_DESK_SKIP_CI=1 pula a trava (deploy manual de emergência).
if [[ "${QA_DESK_SKIP_CI:-0}" != "1" ]]; then
  CI=$(ci_status "$REMOTE")
  case "$CI" in
    success) rm -f "$CI_BLOQUEIO" ;;
    pendente | erro)
      # CI rodando ou GitHub fora: tenta de novo no próximo cron, sem poluir o log
      exit 0
      ;;
    *)
      if [[ "$(cat "$CI_BLOQUEIO" 2>/dev/null)" != "$REMOTE" ]]; then
        log "bloqueado: CI '$CI' em $REMOTE — nada publicado (https://github.com/$GH_REPO/actions)"
        echo "$REMOTE" >"$CI_BLOQUEIO"
      fi
      exit 0
      ;;
  esac
fi

log "deploy: $LOCAL → $REMOTE"

git pull --ff-only origin "$BRANCH"
cd "$APP"

log "npm ci…"
npm ci

log "prisma migrate deploy…"
npx prisma migrate deploy

log "npm run build…"
npm run build

log "restart qa-desk…"
if sudo -n systemctl restart qa-desk 2>/dev/null; then
  :
elif systemctl --user restart qa-desk 2>/dev/null; then
  :
else
  log "ERRO: não consegui reiniciar o serviço (configure sudoers NOPASSWD — ver README)"
  exit 1
fi

for _ in $(seq 1 15); do
  sleep 2
  if curl -sf "http://127.0.0.1:3001/api/health" >/dev/null; then
    log "ok: health 200 — agora em $(git -C "$REPO" rev-parse --short HEAD)"
    exit 0
  fi
done
log "AVISO: serviço reiniciou mas /api/health não respondeu em 30s"
exit 1
