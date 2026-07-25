# QA Desk — Oracle Cloud Always Free

Ordem: **Supabase → VM OCI → app → (opcional) domínio/Caddy**.

Arquivos nesta pasta:

| Arquivo | Uso |
|---------|-----|
| [`setup-vm.sh`](setup-vm.sh) | Instala Node 20 + Caddy na Ubuntu |
| [`qa-desk.service`](qa-desk.service) | systemd (reinicia após reboot) |
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
3. **Authentication → Users** → Add user:
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

No Supabase → Authentication → URL Configuration, adicione a URL do site em **Site URL** e **Redirect URLs**.

## 5. Smoke

- `/login` com admin → CRUD ok
- login visitor → só itens com `showInPortfolio`
- `/api/health` → `"auth":"supabase"`, `"automationRun":false`

## Atualizar depois de um push

```bash
cd ~/QA-Desk && git pull
cd qa-desk && npm ci && npm run build
sudo systemctl restart qa-desk
```

Se mudou `VITE_SUPABASE_*`, o `npm run build` é obrigatório (valores vão no bundle).

### Segurança (produção)

No `.env` da VM:

```bash
QA_APP_HOST=127.0.0.1
QA_CORS_ORIGINS=https://qa-desk-pedro.duckdns.org
QA_AUTOMATION_RUN=0
```

Feche **3001** no security list OCI e no firewall do host (só 22/80/443). Health público responde só `{ "ok": true }`.
