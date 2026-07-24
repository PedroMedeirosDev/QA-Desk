#!/usr/bin/env bash
# Setup inicial da VM Oracle (Ubuntu 22.04 / 24.04).
# Uso (como usuário ubuntu/opc com sudo):
#   curl -fsSL ... | bash
#   ou: bash deploy/oracle/setup-vm.sh
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/QA-Desk/qa-desk}"
NODE_MAJOR="${NODE_MAJOR:-22}"

echo "==> Atualizando pacotes"
sudo apt-get update -y
sudo apt-get install -y curl git ca-certificates build-essential

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt "$NODE_MAJOR" ]]; then
  echo "==> Instalando Node.js ${NODE_MAJOR}.x"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "==> Node $(node -v) / npm $(npm -v)"

if ! command -v caddy >/dev/null 2>&1; then
  echo "==> Instalando Caddy"
  sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt-get update -y
  sudo apt-get install -y caddy
fi

echo "==> Pronto. Próximos passos manuais:"
echo "  1. git clone https://github.com/PedroMedeirosDev/QA-Desk.git ~/QA-Desk"
echo "  2. cd ~/QA-Desk/qa-desk && cp .env.production.example .env && nano .env"
echo "  3. npm ci && npx prisma migrate deploy && npm run build"
echo "  4. sudo cp deploy/oracle/qa-desk.service /etc/systemd/system/"
echo "     (ajuste User= e WorkingDirectory= se necessário)"
echo "  5. sudo systemctl daemon-reload && sudo systemctl enable --now qa-desk"
echo "  6. Domínio: edite deploy/oracle/Caddyfile e:"
echo "     sudo cp deploy/oracle/Caddyfile /etc/caddy/Caddyfile && sudo systemctl reload caddy"
echo "  7. Sem domínio: abra porta 3001 no Security List e acesse http://IP_PUBLICO:3001"
