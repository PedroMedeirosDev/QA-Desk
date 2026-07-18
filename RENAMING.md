# Renomear pasta / remote

O repositório no GitHub é **[QA-Desk](https://github.com/PedroMedeirosDev/QA-Desk)** (público).

## Pasta local (opcional)

```powershell
cd "C:\Users\pedro\Projetos Portfolio"
Rename-Item "Polygonus-QA" "QA-Desk"
cd QA-Desk
git remote set-url origin https://github.com/PedroMedeirosDev/QA-Desk.git
git remote -v
```

## Cursor / VS Code

Reabrir a pasta com o novo nome. Tasks em `.vscode/tasks.json` usam `${workspaceFolder}`.

## O que não muda

- Slug `polygonus` em `projects/polygonus/` (é um *projeto* dentro do QA Desk)
- Pasta do app: `qa-app/` (código); marca do produto: **QA Desk**
- Clones `polygonus-mobile/`, `polygonus-react/` na raiz (gitignored)
