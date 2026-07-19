# Onde achar as credenciais no Supabase (dashboard atual)

O UI mudou: keys novas (`sb_publishable_…` / `sb_secret_…`) convivem com as legadas (`anon` / `service_role` JWT). O app aceita **as duas** via `@supabase/supabase-js`.

## API URL + keys

1. Abra o projeto **QA-Desk**.
2. Menu **Project Settings** (engrenagem) → **API Keys**  
   (em alguns layouts ainda aparece como **API** com abas de keys).
3. Ou use o botão **Connect** no topo do projeto → aba de cliente / API.

| No dashboard | No `.env` |
|--------------|-----------|
| **Project URL** (`https://xxxx.supabase.co`) | `VITE_SUPABASE_URL` e `SUPABASE_URL` |
| **Publishable** (`sb_publishable_…`) **ou** legado **anon** (`eyJ…`) | `VITE_SUPABASE_ANON_KEY` e `SUPABASE_ANON_KEY` |
| **Secret** (`sb_secret_…`) **ou** legado **service_role** (`eyJ…`) | `SUPABASE_SERVICE_ROLE_KEY` (só servidor) |

Prefira o que o painel mostrar como “safe for browser” no front e “secret / elevated” no server. Não precisa migrar agora se ainda vê `anon` / `service_role`.

Docs oficiais: [Understanding API keys](https://supabase.com/docs/guides/getting-started/api-keys).

## Postgres — DATABASE_URL + DIRECT_URL

1. No topo do projeto, clique **Connect** (não precisa ir em Settings → Database).
2. Escolha tipo **URI** / connection string.
3. Copie **dois** modos:

| Modo no Connect | Porta típica | Variável | Uso |
|-----------------|--------------|----------|-----|
| **Transaction** pooler (Shared) | `6543` | `DATABASE_URL` | Runtime Prisma na app (+ `?pgbouncer=true` se a string não trouxer) |
| **Session** pooler (Shared) | `5432` no host `*.pooler.supabase.com` | Alternativa IPv4 para app | Se Transaction der problema |
| **Direct** (`db.xxxx.supabase.co:5432`) | `5432` | `DIRECT_URL` | `prisma migrate deploy` |

Docs: [Connect to your database](https://supabase.com/docs/guides/database/connecting-to-postgres).

### Atenção Oracle / IPv4

A conexão **Direct** no free costuma ser **IPv6**. VMs Oracle muitas vezes só têm IPv4 → migrate pode falhar com Direct.

Nesse caso:

- `DATABASE_URL` = **Transaction** pooler (`:6543`)
- `DIRECT_URL` = **Session** pooler (`*.pooler.supabase.com:5432`) — não o host `db.…supabase.co`

Senha: a do banco na criação do projeto. Reset em **Project Settings → Database** se esqueceu.

## Checklist rápido

```env
VITE_SUPABASE_URL=https://….supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_…   # ou eyJ… anon
SUPABASE_URL=https://….supabase.co
SUPABASE_ANON_KEY=…                       # igual ao VITE_
SUPABASE_SERVICE_ROLE_KEY=sb_secret_…     # ou eyJ… service_role
DATABASE_URL=postgresql://…:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://…pooler…:5432/postgres
```

Cole em `.env` local ou na VM a partir de [`.env.production.example`](../.env.production.example). **Nunca** commitar nem colar secrets no chat.
