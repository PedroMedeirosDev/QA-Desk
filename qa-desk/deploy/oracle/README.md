# QA Desk — Oracle Cloud Always Free

Ordem: **Supabase → VM OCI → app → (opcional) domínio/Caddy**.

Arquivos nesta pasta:

| Arquivo | Uso |
|---------|-----|
| [`setup-vm.sh`](setup-vm.sh) | Instala Node 20 + Caddy na Ubuntu |
| [`qa-desk.service`](qa-desk.service) | systemd (reinicia após reboot) |
| [`auto-deploy.sh`](auto-deploy.sh) | `git pull` + build + restart (cron) |
| [`sudoers-qa-desk`](sudoers-qa-desk) | NOPASSWD só para `systemctl restart qa-desk` |
| [`Caddyfile`](Caddyfile) | HTTPS na frente da porta 3001 |
| [`../../.env.production.example`](../../.env.production.example) | Modelo de secrets |

## 1. Console OCI — criar VM

1. Menu **Compute → Instances → Create instance**.
2. Name: `qa-desk`.
3. Image: **Canonical Ubuntu 22.04** (ou 24.04).
4. Shape:
   - Preferência Always Free: **VM.Standard.A1.Flex** (Ampere) — 1 OCPU / 6 GB se a cota permitir.
   - Alternativa: **VM.Standard.E2.1.Micro** (x86 Always Free).
5. Networking: VCN default + **assign public IPv4**.
6. SSH keys: cole sua chave pública (`.pub`) ou gere no console e salve o `.pem`.
7. Create → anote o **Public IP**.

### Security List (ingress)

No subnet / VCN security list da VM, adicione:

| Porta | Source | Motivo |
|-------|--------|--------|
| 22/tcp | Seu IP (ou 0.0.0.0/0 temporário) | SSH |
| 443/tcp | 0.0.0.0/0 | HTTPS (Caddy) |
| 80/tcp | 0.0.0.0/0 | ACME / redirect |

**Não** abra a porta **3001** na internet. O Node escuta só em `127.0.0.1` e o Caddy faz proxy.
## 2. Supabase (no PC, antes do deploy)

1. [supabase.com](https://supabase.com) → New project (região próxima, ex. `sa-east-1`).
2. **SQL Editor** → cole e rode [`../../supabase/migrations/001_profiles.sql`](../../supabase/migrations/001_profiles.sql).
3. **SQL Editor** → rode também [`../../supabase/migrations/002_rls_prisma_tables.sql`](../../supabase/migrations/002_rls_prisma_tables.sql) (liga RLS nas tabelas Prisma; evita o alerta *Table publicly accessible*).
4. **Authentication → Users** → Add user:
   - admin (seu e-mail)
   - visitor (ex. `visitante@qa-desk.local` + senha forte)
4. SQL:

```sql
update public.profiles set role = 'admin' where email = 'SEU_EMAIL';
```

5. **API keys** — Project Settings → **API Keys** (ou botão **Connect** no topo):
   - Project URL → `VITE_SUPABASE_URL` / `SUPABASE_URL`
   - Publishable **ou** legado `anon` → `VITE_SUPABASE_ANON_KEY` / `SUPABASE_ANON_KEY`
   - Secret **ou** legado `service_role` → `SUPABASE_SERVICE_ROLE_KEY`
6. **Postgres** — botão **Connect** no topo do projeto (URI):
   - Transaction pooler (`:6543`) → `DATABASE_URL`
   - Session pooler ou Direct → `DIRECT_URL` (em VM IPv4, preferir Session pooler; Direct free costuma ser IPv6)

Guia atualizado: [`../SUPABASE_CREDENTIALS.md`](../SUPABASE_CREDENTIALS.md)

## 3. SSH e app

```bash
# No seu PC (Windows PowerShell), com a chave .pem:
ssh -i caminho\chave.pem ubuntu@IP_PUBLICO

# Na VM:
git clone https://github.com/PedroMedeirosDev/QA-Desk.git ~/QA-Desk
cd ~/QA-Desk/qa-desk
bash deploy/oracle/setup-vm.sh

cp .env.production.example .env
nano .env   # cole URL, keys, DATABASE_URL, DIRECT_URL

npm ci
npx prisma migrate deploy
# Opcional — importar JSON local (só se data/ estiver no clone):
# npm run db:migrate-json
npm run build

# systemd (ajuste User= se for opc em Oracle Linux)
sudo sed -i "s|/home/ubuntu|$HOME|g; s|User=ubuntu|User=$USER|g" deploy/oracle/qa-desk.service
sudo cp deploy/oracle/qa-desk.service /etc/systemd/system/qa-desk.service
sudo systemctl daemon-reload
sudo systemctl enable --now qa-desk
sudo systemctl status qa-desk
```

Teste: `curl -s http://127.0.0.1:3001/api/health`

**GitHub CLI (Curadoria KB):** o sync e o webhook precisam de `gh` autenticado na VM (`gh auth login`). Sem isso: `spawn gh ENOENT`. Ver [`../server/github/README.md`](../../server/github/README.md).

Público sem TLS: `http://IP_PUBLICO:3001` (porta 3001 aberta).

## 4. Domínio + HTTPS (recomendado)

1. Aponte um A record para o IP da VM (DuckDNS / Cloudflare).
2. Edite `Caddyfile` com o hostname.
3. `sudo cp deploy/oracle/Caddyfile /etc/caddy/Caddyfile && sudo systemctl reload caddy`

O Caddyfile isola o SSE da Curadoria KB (`…/kb-curation/stream`) **sem gzip** e com `flush_interval -1`. Sem isso a stream pode bufferizar e a UI só atualiza no F5.

No Supabase → Authentication → URL Configuration, adicione a URL do site em **Site URL** e **Redirect URLs**.

## 5. Smoke

- `/login` com admin → CRUD ok
- login visitor → só itens com `showInPortfolio`
- `/api/health` → `"auth":"supabase"`, `"automationRun":false`, e com agente: `"agentOnline"` / `"agentConfigured"`

## Atualizar depois de um push

Manual:

```bash
bash ~/QA-Desk/qa-desk/deploy/oracle/auto-deploy.sh
# ou:
cd ~/QA-Desk && git pull
cd qa-desk && npm ci && npm run build
sudo systemctl restart qa-desk
```

### Auto-deploy (cron, Always Free — R$ 0)

Não precisa de nada da empresa. É só GitHub + esta VM.

**1× na VM** (sudoers + cron + primeiro deploy):

```bash
cd ~/QA-Desk && git pull

# Reinício sem senha (obrigatório para o cron)
sudo cp ~/QA-Desk/qa-desk/deploy/oracle/sudoers-qa-desk /etc/sudoers.d/qa-desk
sudo chmod 440 /etc/sudoers.d/qa-desk
sudo visudo -cf /etc/sudoers.d/qa-desk

chmod +x ~/QA-Desk/qa-desk/deploy/oracle/auto-deploy.sh

# Suite API Polygonus (opcional — senha só no .env da VM, nunca no Git)
# nano ~/QA-Desk/qa-desk/.env
# POLY_API_BASE_URL=https://amostra.polygonus.com.br:8443/api/v2
# POLY_API_LOGIN=SUPPETER
# POLY_API_SENHA=...
# POLY_API_UNIDADE=Colégio Demonstração

# Cron a cada 5 minutos (só age se origin/main avançou)
(crontab -l 2>/dev/null | grep -v auto-deploy.sh; echo '*/5 * * * * /bin/bash $HOME/QA-Desk/qa-desk/deploy/oracle/auto-deploy.sh >> $HOME/QA-Desk/logs/cron-auto-deploy.log 2>&1') | crontab -

bash ~/QA-Desk/qa-desk/deploy/oracle/auto-deploy.sh
tail -n 30 ~/QA-Desk/logs/auto-deploy.log
```

Logs: `~/QA-Desk/logs/auto-deploy.log`. Sem mudança no `main` → exit silencioso.

Se mudou `VITE_SUPABASE_*`, o `npm run build` é obrigatório (valores vão no bundle).

### Segurança (produção)

No `.env` da VM:

```bash
QA_APP_HOST=127.0.0.1
QA_CORS_ORIGINS=https://qa-desk-pedro.duckdns.org
QA_AUTOMATION_RUN=0
QA_AGENT_TOKEN=segredo-longo-igual-ao-do-PC
```

No PC (agente): `QA_DESK_URL=https://…` + mesmo `QA_AGENT_TOKEN` + `npm run agent` (ver `qa-desk/agent/README.md`).

Feche **3001** no security list OCI e no firewall do host (só 22/80/443). Health público inclui `ok` e status do agente (sem secrets).
