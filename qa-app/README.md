# QA App

Aplicação web do **QA Automate** — registro de testes e homologação multi-projeto.

Especificação: [`SPEC.md`](SPEC.md) · Deploy: [`DEPLOY.md`](DEPLOY.md)

## Rodar

```powershell
cd qa-app
copy .env.example .env   # QA_AUTOMATION_RUN=1 para Maestro com um clique
npm install
npm run dev              # dev: UI :5174 + API :3001
npm run start:prod       # produção: http://localhost:3001 (rede local)
```

## Homologação Mural (agora)

1. Abra **Polygonus** na app → **Criar checklist Mural** (5 fluxos Maestro vinculados)
2. Emulador ligado (`adb devices`)
3. Em cada item: **Executar automação** → print + status se falhar

## Projetos

```
data/projects/polygonus/tests.json
data/projects/anihype/tests.json
data/uploads/{projeto}/{testId}/
```

## Fase atual

- [x] CRUD + campanha homologação + checklist Mural
- [x] Vincular Maestro + executar com um clique (PC local)
- [x] Modo produção (`start:prod`)
- [ ] Discord + Moacir (fase 3)
- [ ] Auth visitante (fase 2)
