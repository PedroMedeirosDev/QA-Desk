#!/usr/bin/env bash
# Mantém o projeto Supabase ativo: o plano gratuito pausa após 7 dias sem uso.
# Uma consulta mínima por dia (SELECT 1 via /api/health/db) basta.
#
#   (crontab -l 2>/dev/null | grep -v keep-alive.sh; echo '17 9 * * * /bin/bash $HOME/QA-Desk/qa-desk/deploy/oracle/keep-alive.sh') | crontab -
set -u

LOG_DIR="$HOME/QA-Desk/logs"
mkdir -p "$LOG_DIR"
PORT="${QA_APP_PORT:-3001}"
agora="$(date '+%Y-%m-%d %H:%M:%S')"

resposta="$(curl -fsS --max-time 30 "http://127.0.0.1:${PORT}/api/health/db" 2>&1)"
if [ $? -eq 0 ]; then
  echo "$agora ok $resposta" >> "$LOG_DIR/keep-alive.log"
else
  echo "$agora ERRO $resposta" >> "$LOG_DIR/keep-alive.log"
  exit 1
fi
