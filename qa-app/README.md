# QA App

Aplicação web do **QA Automate** — registro de testes e homologação multi-projeto.

Especificação: [`SPEC.md`](SPEC.md) · Deploy: [`DEPLOY.md`](DEPLOY.md)

## Rodar

```powershell
cd qa-app
copy .env.example .env   # QA_AUTOMATION_RUN=1 para Maestro com um clique
npm install
npm run dev              # dev: UI :5174 + API :3001
```

**Parar o dev (`Ctrl+C`):** no Windows, se aparecer `Deseja finalizar o arquivo em lotes (S/N)?`, digite `S` e Enter — ou use o botão de lixeira no painel do terminal. O script `dev` usa `concurrently -k` e chama `tsx`/`vite` direto (sem `npm` aninhado) para o `Ctrl+C` encerrar mais rápido.

```powershell
npm run start:prod       # produção: http://localhost:3001 (rede local)
```

## Homologação Mural (agora)

1. Abra **Polygonus** na app → **Criar checklist Mural** (5 fluxos Maestro vinculados)
2. Emulador ligado (`adb devices`)
3. Em cada item: **Executar automação** → print + status se falhar

## Persistência

**Padrão:** JSON em `data/projects/{slug}/` (sem Postgres).

**Opcional — Postgres + Prisma** (recomendado para histórico de runs):

```powershell
cd qa-app
copy .env.example .env   # descomente / mantenha DATABASE_URL
npm run db:up            # docker compose postgres → host :5433
npx prisma migrate deploy
npm run db:migrate-json  # importa tests.json + homologations.json
# acrescente DATABASE_URL do .env.example no seu .env
npm run dev
```

Com `DATABASE_URL` definido, a API usa Postgres (`/api/health` → `"storage":"postgres"`). Arquivos de evidência continuam em `data/uploads/`. Execuções Maestro vão para a tabela `test_runs`.

Sem `DATABASE_URL`, o comportamento JSON anterior permanece.

## Projetos

```
data/projects/polygonus/tests.json   # fallback / migração
data/projects/anihype/tests.json
data/uploads/{projeto}/{testId}/
prisma/schema.prisma                 # projects, tests, homologations, test_runs
```

## Fase atual

- [x] CRUD + campanha homologação + checklist Mural
- [x] Vincular Maestro + executar com um clique (PC local)
- [x] Modo produção (`start:prod`)
- [x] Persistência Postgres (opcional) + migração JSON
- [ ] Discord + Moacir (fase 3)
- [ ] Auth visitante (fase 2)
