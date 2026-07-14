# Repositórios da empresa — mapa oficial (Moacir)

Fonte: orientação do gestor sobre a org `polygonus-br`.

| Papel | Repositório | Homologação QA |
|-------|-------------|----------------|
| **APP** | `polygonus-mobile` | Completa — Maestro + checklist mobile |
| **NOVO LAYOUT** | `polygonus-react` | Completa — checklist portal (versão nova) |
| **BACKEND PRINCIPAL** | `polygonus-go` | Indireta — validar **portal + app** após deploy (checklist go) |
| **LEGADO** (versão clássica) | `acropoly-server` | Só se entidade ainda usa layout clássico ou Moacir pedir |
| **BACKEND LEGADO DO APP** | `polygonus-server` | Só se fluxo do app ainda depende desse backend |

## Clones locais (somente leitura)

Pastas na **raiz** do Polygonus-QA, **gitignored** — para diff de código e foco de teste:

```
polygonus-mobile/
polygonus-react/
polygonus-go/
acropoly-server/
polygonus-server/
```

Atualizar tudo:

```powershell
.\sync.bat
```

Só um repo:

```powershell
.\scripts\sync-company-repos.ps1 -Only go
```

Config: [`../../scripts/company-repos.json`](../../scripts/company-repos.json)

## E-mail GitHub × repo

Cada e-mail `[nome-do-repo] hash: mensagem` indica **qual camada** mudou:

| E-mail de… | Teste onde |
|------------|------------|
| `polygonus-react` | Portal (novo layout) |
| `polygonus-mobile` | App |
| `polygonus-go` | Portal/app (API por trás) |
| `acropoly-server` | Legado clássico (se aplicável) |
| `polygonus-server` | App em rotas legadas (se aplicável) |

Digest automático: `.\scripts\sync-github-homologacao.ps1` → `inbox/latest.md`

## Interpretar mudança com código

```powershell
.\sync.bat
cd polygonus-react
git log -5 --oneline
git show --stat HEAD
```

No Cursor: _"Leia inbox/latest.md e o diff recente em polygonus-react — o que homologar?"_
