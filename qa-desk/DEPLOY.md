# Colocar o QA Desk no ar

## Opção 1 — Sua máquina (recomendado para homologação + Maestro)

Maestro e emulador **só rodam no seu PC**. Para homologação do Mural com execução em um clique:

```powershell
cd qa-desk
copy .env.example .env
# Edite .env: QA_AUTOMATION_RUN=1
# Auth opcional: sem VITE_SUPABASE_URL o app fica em modo mock (admin local)

npm install
npm run start:prod
```

Abre em **http://localhost:3001** (UI + API no mesmo endereço).

Na **mesma rede Wi‑Fi**: `ipconfig` → `http://192.168.x.x:3001`.

---

## Opção 2 — Túnel rápido (demo sem VM)

Com a app rodando em `:3001`:

```powershell
npx ngrok http 3001
# ou: cloudflared tunnel --url http://localhost:3001
```

Dados ficam no PC — não desligue a máquina.

---

## Opção 3 — Oracle Cloud Always Free (prioridade)

Forever-free: VM Always Free + **Supabase** (Auth + Postgres). Sem Maestro na VM (`QA_AUTOMATION_RUN` omitido/0).

Credenciais Supabase (painel atual): [`deploy/SUPABASE_CREDENTIALS.md`](deploy/SUPABASE_CREDENTIALS.md)

Guia completo OCI (console, Security List, systemd, Caddy):

→ **[`deploy/oracle/README.md`](deploy/oracle/README.md)**

Resumo:

1. **Supabase** — projeto + SQL [`supabase/migrations/001_profiles.sql`](supabase/migrations/001_profiles.sql) + users admin/visitor + keys (ver guia acima).
2. **OCI** — Create Instance (Ubuntu + Always Free Ampere ou E2.1.Micro) + portas 22/80/443/(3001).
3. **SSH** — `bash deploy/oracle/setup-vm.sh` → `.env` a partir de [`.env.production.example`](.env.production.example) → `npm ci && npx prisma migrate deploy && npm run build` → systemd.

Modelo de env cloud: [`.env.production.example`](.env.production.example).

---

## Opção 4 — Fallback Koyeb free

Se Oracle bloquear a conta: [Koyeb](https://www.koyeb.com) → 1 Web Service free (dorme após 1h idle).

- Root: `qa-desk`
- Build: `npm ci && npx prisma generate && npm run build`
- Start: `npm start`
- Mesmas env do Supabase; `QA_AUTOMATION_RUN=0`
- Sem volume persistente no free → uploads efêmeros

---

## Auth (resumo)

| Variável | Onde |
|----------|------|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Front (build Vite) |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Server |
| `SUPABASE_SERVICE_ROLE_KEY` | **Só server** — nunca no Vite |
| `DATABASE_URL` | Postgres (JSON mode se vazio) |
| `DIRECT_URL` | Obrigatório com Prisma — local = mesma URL; Supabase = conexão direta :5432 |

Sem `VITE_SUPABASE_URL` + sem `SUPABASE_URL`: modo **mock admin** (dev local / Maestro).

Com Auth: admin vê tudo; visitor só `showInPortfolio=true`, sem mutações / sem Executar.

Arquitetura: [`ARCHITECTURE.md`](ARCHITECTURE.md) · Oracle detalhado: [`deploy/oracle/README.md`](deploy/oracle/README.md)

---

## Variáveis gerais

| Variável | Uso |
|----------|-----|
| `QA_APP_PORT` | Porta (padrão 3001) |
| `QA_APP_HOST` | `0.0.0.0` = rede local |
| `NODE_ENV=production` | Serve build React + API |
| `QA_AUTOMATION_RUN=1` | Maestro **só** no PC |

---

## Limitação

**Um clique no navegador** dispara o Maestro **na máquina onde a API roda**. Em cloud = desligado. Homologação com emulador = Opção 1.
