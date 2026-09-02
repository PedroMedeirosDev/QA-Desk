# Scripts — código da empresa

Os repositórios **polygonus-mobile** e **polygonus-react** ficam na raiz do QA Desk (`C:\projetos\QA-Desk`) como clones locais. Eles estão no `.gitignore` deste projeto: **não commitar** alterações neles aqui; use sempre o GitHub da empresa como fonte.

**Importante:** estes clones são **somente leitura** para o QA. Use `sync` para **baixar** atualizações (`git pull`). **Não envie** (`git push`) nada para os repositórios da empresa a partir desta máquina/pasta.

## Sincronizar (atualizar ou clonar)

### Windows (PowerShell) — use isto

Na raiz do projeto, **um** destes comandos:

```powershell
.\sync.bat
```

ou:

```powershell
.\scripts\sync-company-repos.ps1
```

> **Nao** execute `sync-company-repos.sh` no terminal PowerShell do Windows (o erro `/usr/bin/env` e esperado). O arquivo `.sh` e so para Linux, macOS ou Git Bash.

Só o app mobile:

```powershell
.\scripts\sync-company-repos.ps1 -Only mobile
```

Se existirem mudanças locais acidentais no clone e você quiser voltar ao remoto:

```powershell
.\scripts\sync-company-repos.ps1 -Hard
```

### Git Bash / Linux / macOS

```bash
chmod +x scripts/sync-company-repos.sh
./scripts/sync-company-repos.sh
```

## Automatizar

### Cursor / VS Code

Use a tarefa **QA: sincronizar código da empresa** (`Terminal` → `Run Task…` ou atalho configurado). Ela executa o script PowerShell.

### Antes de cada sessão de testes

Rode o sync uma vez; leva poucos segundos se já estiver clonado.

### Agendamento no Windows (opcional)

1. Abra o **Agendador de Tarefas**.
2. Criar tarefa básica (ex.: diária ao logar).
3. Ação: iniciar programa `powershell.exe`.
4. Argumentos:

   ```
   -NoProfile -ExecutionPolicy Bypass -File "C:\projetos\QA-Desk\scripts\sync-company-repos.ps1"
   ```

Ajuste o caminho se o projeto estiver em outra pasta.

## Comportamento

| Situação | O que o script faz |
|----------|-------------------|
| Pasta não existe | `git clone` na branch **`cq`** |
| Clone limpo | `git fetch` + `git pull --ff-only` |
| Alterações locais | Avisa e **não** atualiza (evita perder trabalho acidental) |
| Com `-Hard` / `--hard` | `git reset --hard` + `git clean` no clone afetado |

Repositórios configurados:

| Pasta | URL |
|-------|-----|
| `polygonus-mobile/` | https://github.com/polygonus-br/polygonus-mobile.git | **APP** |
| `polygonus-react/` | https://github.com/polygonus-br/polygonus-react.git | **NOVO LAYOUT** |
| `polygonus-go/` | https://github.com/polygonus-br/polygonus-go.git | **BACKEND PRINCIPAL** |
| `polygonus-suporte-kb/` | https://github.com/polygonus-br/polygonus-suporte-kb.git | **SUPORTE KB** (`master`) |
| `acropoly-server/` | https://github.com/polygonus-br/acropoly-server.git | **LEGADO** |
| `polygonus-server/` | https://github.com/polygonus-br/polygonus-server.git | **BACKEND LEGADO APP** |

Mapa e prioridade de homologação: [`../projects/polygonus/homologacao/repos-empresa.md`](../projects/polygonus/homologacao/repos-empresa.md) · config: `company-repos.json`

Só frontend (app + portal):

```powershell
.\scripts\sync-company-repos.ps1 -Only frontend
```

## O que homologar (GitHub → Cursor)

Os avisos de deploy/release chegam por **e-mail do GitHub**. Em vez de ler e-mail ou usar app password, use a **API GitHub** (mesma fonte, mais seguro):

```powershell
gh auth login
.\scripts\sync-github-homologacao.ps1
```

Gera `projects/polygonus/homologacao/inbox/latest.md` — no Cursor: _"Leia inbox/latest.md e monte meu plano de testes."_

Detalhes: [`../projects/polygonus/homologacao/inbox/README.md`](../projects/polygonus/homologacao/inbox/README.md) · config: `github-homologacao.config.json`
