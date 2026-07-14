# Renomear o repositório

O nome **Polygonus-QA** não reflete mais o escopo (multi-projeto: Polygonus, Anihype, …).  
Nome recomendado: **`qa-automate`** (alinhado ao título do README).

## GitHub

1. Repositório → **Settings** → **General** → **Repository name** → `qa-automate`
2. Localmente:

```powershell
cd "C:\Users\pedro\Projetos Portfolio"
Rename-Item "Polygonus-QA" "qa-automate"
cd qa-automate
git remote -v   # URL atualiza automaticamente no GitHub após rename no site
```

3. Atualizar clone em outras máquinas: `git remote set-url origin https://github.com/<user>/qa-automate.git`

## Cursor / VS Code

Reabrir a pasta com o novo nome. Workspace tasks em `.vscode/tasks.json` usam `${workspaceFolder}` — não precisam mudar.

## O que não muda

- Slug `polygonus` dentro de `projects/polygonus/`
- Clones `polygonus-mobile/`, `polygonus-react/` na raiz (específicos da empresa)
