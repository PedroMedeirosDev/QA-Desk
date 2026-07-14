# Homologação — digest GitHub

> **2026-07-14 04:11:01** · 5 repos · últimos **1** dias
> Substitui abrir e-mail por e-mail. No Cursor: _"Leia projects/polygonus/homologacao/inbox/latest.md e diga o que homologar hoje."_

## Fila de homologação (o que importa para QA)

_Equivalente a ler os e-mails do GitHub — agrupado por prioridade, sem abrir um a um._

### FULL — Homologação completa (APP ou NOVO LAYOUT)

**polygonus-react** (NOVO LAYOUT)
- Último commit: `de2a46e` — Merge pull request #147 from polygonus-br/fix/incremental-search

### SANITY — Backend principal — testar via portal + app

**polygonus-go** (BACKEND PRINCIPAL)
- Backend principal — validar efeito no portal + app (não testar Go isolado).
- Último commit: `775fd90` — feat(financeiro): pagamento PIX e liquidação; refactor(pedagogico): BI com drill

### LEGACY — Legado — só se entidade usa versão clássica / Moacir pedir

**acropoly-server** (LEGADO)
- Legado — homologar só se entidade usa versão clássica ou Moacir pedir.
- Último commit: `5819b70` — correção FParMateriaLecionada3

## Caixa de entrada (estilo e-mail GitHub)

_8 commits nos últimos dias — mesma info dos e-mails do Moacir/GitHub._

- **2026-07-13 20:27** · `polygonus-br/acropoly-server` · `5819b70`: correção FParMateriaLecionada3
- **2026-07-13 16:17** · `polygonus-br/polygonus-react` · `de2a46e`: Merge pull request #147 from polygonus-br/fix/incremental-search
- **2026-07-13 16:14** · `polygonus-br/polygonus-react` · `6a3479e`: feat(financeiro): liquidação de contas; refactor(pedagogico): BI com drill
- **2026-07-13 16:14** · `polygonus-br/polygonus-go` · `775fd90`: feat(financeiro): pagamento PIX e liquidação; refactor(pedagogico): BI com drill
- **2026-07-13 15:48** · `polygonus-br/acropoly-server` · `d8ce8f7`: novo campo de consulta Matr/Disc:Dispensado
- **2026-07-13 14:10** · `polygonus-br/acropoly-server` · `7d7a128`: correção cancelar nfse confirmada PROIBIR!
- **2026-07-13 13:49** · `polygonus-br/polygonus-react` · `e590dc2`: refactor(search): normalize input for diacritics and adjust search timing
- **2026-07-13 12:27** · `polygonus-br/acropoly-server` · `ca5387d`: correção consistencia de status

## Notificações GitHub

_Sem notificações GitHub na janela (normal se já leu no site)._ 

## Rotina sugerida

1. `.\scripts\sync-github-homologacao.ps1` (2× ao dia ou quando a caixa encher)
2. Homologar **FULL** (app + portal) → **SANITY** (go via portal/app) → **LEGACY** só se aplicável
3. `.\sync.bat` nos repos **full** antes de testar
4. Maestro + checklist · evidência em `projects/polygonus/evidence/`
