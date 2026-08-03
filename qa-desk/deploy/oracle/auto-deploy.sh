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

mkdir -p "$LOG_DIR"

log() {
  echo "[$(date -Iseconds)] $*" | tee -a "$LOG_FILE"
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

sleep 2
if curl -sf "http://127.0.0.1:3001/api/health" >/dev/null; then
  log "ok: health 200 — agora em $(git -C "$REPO" rev-parse --short HEAD)"
else
  log "AVISO: serviço reiniciou mas /api/health falhou"
  exit 1
fi
