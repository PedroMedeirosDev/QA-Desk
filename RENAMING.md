# Renomear pasta / remote

O repositório no GitHub é **[QA-Desk](https://github.com/PedroMedeirosDev/QA-Desk)** (público).

**Pasta local atual:** `C:\projetos\QA-Desk`.

## Pasta local (histórico)

O repo já morou em `Projetos Portfolio\Polygonus-QA` e depois `QA-Desk` nessa pasta. Se precisar repetir o rename:

```powershell
cd "C:\Users\pedro\Projetos Portfolio"
Rename-Item "Polygonus-QA" "QA-Desk"
cd QA-Desk
git remote set-url origin https://github.com/PedroMedeirosDev/QA-Desk.git
git remote -v
```

## Cursor / VS Code

Reabrir a pasta com o novo nome. Tasks em `.vscode/tasks.json` usam `${workspaceFolder}`.

## Pasta do app

Código da aplicação: **`qa-desk/`** (antes `qa-app/`).

Se ainda existir junction/pasta antiga:

```powershell
# Feche o Cursor (ou abas de arquivos em qa-app), depois:
.\scripts\finalize-qa-desk-rename.ps1
```
