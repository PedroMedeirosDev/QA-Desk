# Inbox — digest GitHub (substituto dos e-mails)

Seu chefe pede para **abrir e-mail por e-mail** do GitHub. Cada e-mail é um commit/CI em algum repo `polygonus-br/*`.

Este sync faz **a mesma leitura**, agrupada e priorizada — **sem Gmail, sem app password**.

## Uso diário

```powershell
gh auth login          # uma vez
.\scripts\sync-github-homologacao.ps1
```

Abra **`latest.md`** ou peça no Cursor:

> Leia `projects/polygonus/homologacao/inbox/latest.md` e diga o que homologar hoje, em ordem de prioridade.

## O que o digest contém

| Seção | Equivalente aos e-mails |
|-------|-------------------------|
| **Fila de homologação** | “O que eu preciso testar?” (FULL / SANITY / LEGACY) |
| **Caixa de entrada** | Lista `[repo] hash: mensagem` como no Gmail |
| **Notificações** | Assunto do e-mail GitHub |

## Prioridades (tiers)

| Tier | Repos | O que fazer |
|------|-------|-------------|
| **FULL** | `polygonus-mobile`, `polygonus-react` | Checklist completo + Maestro |
| **SANITY** | `polygonus-go` | Portal/app após deploy |
| **LEGACY** | `acropoly-server`, `polygonus-server` | Só se entidade usa versão clássica ou Moacir pedir |

Repos novos são descobertos automaticamente (`autoDiscoverOrgRepos` em `github-homologacao.config.json`).

## Comandos úteis

```powershell
.\scripts\sync-github-homologacao.ps1 --days 3
node scripts/sync-github-homologacao.mjs --discover
```

## Resposta para o gestor

> “Eu não abro e-mail um a um: rodo o digest GitHub que lista os mesmos commits, priorizo mobile/portal e registro evidência no checklist.”

Mesma informação, menos ruído, auditável no arquivo `latest.md`.
