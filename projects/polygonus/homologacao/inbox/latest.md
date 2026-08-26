# Homologação — digest GitHub

> **2026-08-25 12:59:12** · 6 repos · últimos **7** dias
> Substitui abrir e-mail por e-mail. No Cursor: _"Leia projects/polygonus/homologacao/inbox/latest.md e diga o que homologar hoje."_

## Fila de homologação (o que importa para QA)

_Equivalente a ler os e-mails do GitHub — agrupado por prioridade, sem abrir um a um._

### FULL — Homologação completa (APP ou NOVO LAYOUT)

**polygonus-mobile** (APP)
- Checklist: `projects/polygonus/automation/maestro/flows/docs/CHECKLIST_v5.53.90.md`
- Smoke: `projects/polygonus/automation/maestro/flows/smoke/example_launch_app.yaml`
- Último commit: `4daf237` — feat(chat): rótulo de encaminhada mostra quem encaminhou e mensagem original

**polygonus-react** (NOVO LAYOUT)
- Último commit: `7d46dbc` — refactor(orcamento): remover status "vinculadoNestaConta" das categorias

### SANITY — Backend principal — testar via portal + app

**polygonus-go** (BACKEND PRINCIPAL)
- Backend principal — validar efeito no portal + app (não testar Go isolado).
- Último commit: `2030e83` — feat(orcamento): omitir categorias já vinculadas na conta aberta

### LEGACY — Legado — só se entidade usa versão clássica / Moacir pedir

**acropoly-server** (LEGADO)
- Legado — homologar só se entidade usa versão clássica ou Moacir pedir.
- Último commit: `bbfce76` — fix(dcto, matronline): tpRetPisCofins vem da config e disciplina com vários prof…

**polygonus-server** (BACKEND LEGADO APP)
- Legado — homologar só se entidade usa versão clássica ou Moacir pedir.
- Último commit: `c83fd78` — fix(deploy): garantir integridade do App.Server.exe antes da rotacao

## Caixa de entrada (estilo e-mail GitHub)

_45 commits nos últimos dias — mesma info dos e-mails do Moacir/GitHub._

- **2026-08-25 12:50** · `polygonus-br/polygonus-react` · `7d46dbc`: refactor(orcamento): remover status "vinculadoNestaConta" das categorias
- **2026-08-25 12:49** · `polygonus-br/polygonus-go` · `2030e83`: feat(orcamento): omitir categorias já vinculadas na conta aberta
- **2026-08-25 10:17** · `polygonus-br/polygonus-react` · `7fbab54`: feat(financeiro): permitir ignorar vendas sem registro na conciliação
- **2026-08-25 10:16** · `polygonus-br/polygonus-go` · `53d3e38`: feat(conciliacao): casamento manual na tela do dia e vendas ignoradas no card sem registro
- **2026-08-24 23:11** · `polygonus-br/polygonus-react` · `3e590d6`: fix(gestao,portal): eleva header sticky para z-30 acima das grades
- **2026-08-24 22:50** · `polygonus-br/polygonus-react` · `aba6b5f`: refactor(acadfolha): padroniza terminologia "salvar" e componentes de input
- **2026-08-24 22:50** · `polygonus-br/polygonus-go` · `51e5711`: feat(sistema, favorito, usuario): travar versão do menu por entidade
- **2026-08-24 21:24** · `polygonus-br/polygonus-mobile` · `4daf237`: feat(chat): rótulo de encaminhada mostra quem encaminhou e mensagem original
- **2026-08-24 21:23** · `polygonus-br/polygonus-react` · `9594727`: refactor(chat): unifica etiqueta de mensagem encaminhada em rotuloForward
- **2026-08-24 21:23** · `polygonus-br/polygonus-go` · `d75534d`: feat(empresa): espelha logo do topo da gestão/portal como {subdominio}.png
- **2026-08-24 20:41** · `polygonus-br/polygonus-mobile` · `e407a9e`: feat(chat): mostrar procedência da mensagem encaminhada no bubble
- **2026-08-24 20:36** · `polygonus-br/polygonus-react` · `f39da7b`: feat(chat): etiqueta de encaminhada mostra procedência da mensagem
- **2026-08-24 20:32** · `polygonus-br/polygonus-go` · `030802a`: feat(chat): mensagem encaminhada carrega procedência de origem
- **2026-08-24 20:23** · `polygonus-br/polygonus-react` · `8ed1a33`: feat(bi, design-system): AppSelect ganha prop size e cards do BI com ajuda
- **2026-08-24 20:23** · `polygonus-br/polygonus-go` · `38f6aaf`: feat(empresa): espelhar logomarca no disco do Delphi
- **2026-08-24 20:10** · `polygonus-br/polygonus-go` · `0773765`: feat(consulta,nfse,histescolar): campos calculados, tpRetPisCofins e grades em branco
- **2026-08-24 20:10** · `polygonus-br/acropoly-server` · `bbfce76`: fix(dcto, matronline): tpRetPisCofins vem da config e disciplina com vários professores em coluna ún…
- **2026-08-24 16:43** · `polygonus-br/acropoly-server` · `215d7d4`: feat(contabancaria): permitir exibir contas inativas na lista
- **2026-08-24 00:47** · `polygonus-br/acropoly-server` · `92b8d54`: chore(menu): apontar itens acadêmicos para telas web modernas
- **2026-08-24 00:46** · `polygonus-br/polygonus-react` · `ca95f2b`: feat(curso,histescolar): ativar/inativar curso e reestruturar grades do histórico
- **2026-08-24 00:46** · `polygonus-br/polygonus-react` · `dd751b4`: refactor(histescolar): renomeia SerieForm para GradeForm
- **2026-08-24 00:46** · `polygonus-br/polygonus-go` · `384ee70`: feat(histescolar,curso): grade digitada substitui a calculada e curso inativo sai das listas
- **2026-08-23 21:15** · `polygonus-br/polygonus-react` · `f8abe2a`: feat(aluno, financeiro, front): extrai ListaAlunos e adiciona ajuda nos cards do BI
- **2026-08-23 21:15** · `polygonus-br/polygonus-go` · `a9bd62f`: feat(academico): adiciona histórico escolar, biometria e gestão do arquivo passivo
- **2026-08-23 11:40** · `polygonus-br/polygonus-react` · `afcb38d`: feat(design-system,relatorio,grade): padroniza emissão de relatório e ajusta layout de telas
- **2026-08-23 11:39** · `polygonus-br/polygonus-go` · `5d3cb0d`: feat(grade,documento): copiar grade, encadeamento de promoção e parâmetros de emissão
- **2026-08-23 11:39** · `polygonus-br/polygonus-go` · `a20f4d6`: chore(auth): renomeia arquivo de teste para ano_sessao_test.go
- **2026-08-22 23:36** · `polygonus-br/polygonus-react` · `eae3533`: refactor(design-system): mover ações do formulário para o topo com botões compartilhados
- **2026-08-22 22:55** · `polygonus-br/polygonus-go` · `8a49a94`: feat(professor): adicionar cadastro de professores (port do UMntProfessor)
- **2026-08-22 17:48** · `polygonus-br/acropoly-server` · `6a9512b`: chore(build): atualiza binário Acropoly.exe
- **2026-08-22 17:16** · `polygonus-br/acropoly-server` · `6819650`: fix(database): limpa id_grupo orfao ao forcar desconciliacao
- **2026-08-21 21:34** · `polygonus-br/acropoly-server` · `a6a3802`: fix(dcto): pinta QR Code com UTF-8 BOM para o banco `104`
- **2026-08-21 20:54** · `polygonus-br/acropoly-server` · `4c2dd64`: fix(matronline): complemento do histórico usa TMemoField para textos longos
- **2026-08-21 19:42** · `polygonus-br/acropoly-server` · `b18c4ee`: fix(acropoly): zerar faltas em nota/notafinal para disciplina dispensada
- **2026-08-21 19:20** · `polygonus-br/polygonus-mobile` · `df04a38`: feat(chat): inclui recibos na desserialização da linha de chat
- **2026-08-21 16:20** · `polygonus-br/polygonus-server` · `c83fd78`: fix(deploy): garantir integridade do App.Server.exe antes da rotacao
- **2026-08-21 15:34** · `polygonus-br/acropoly-server` · `39f96b8`: fix(matronline): fechamento de folha em massa usa PK real da tabela
- **2026-08-21 13:26** · `polygonus-br/acropoly-server` · `d321340`: fix(acropoly): garantir integridade do exe e subida do pool no deploy
- **2026-08-21 10:52** · `polygonus-br/acropoly-server` · `b3b5a15`: fix(dcto): normaliza tpRetPisCofins para '0' no Padrão Nacional
- **2026-08-20 23:53** · `polygonus-br/polygonus-server` · `d82c417`: feat(autorizacao): adiciona `IdPersonificante` na sessão web
- **2026-08-20 23:51** · `polygonus-br/acropoly-server` · `6cfbefe`: feat(matronline): expõe recálculo de notas e faltas como APIs para o Go
- **2026-08-19 23:55** · `polygonus-br/polygonus-mobile` · `bcefaaa`: refactor(matronline): migra diário e notas parciais para o backend Go
- **2026-08-19 23:55** · `polygonus-br/polygonus-mobile` · `8562caa`: revert(diario_de_classe): retoma diário de classe legado do Delphi
- **2026-08-18 14:28** · `polygonus-br/polygonus-mobile` · `790e7ee`: Merge pull request #134 from polygonus-br/fix/tratamento-msg-listar-acesso
- **2026-08-18 13:23** · `polygonus-br/polygonus-mobile` · `08499fc`: fix(tratamento): aprimora tratamento de falhas em carregamento de acessos e perfil

## Notificações GitHub

| Quando | Repo | Assunto (como no e-mail) |
|--------|------|-------------------------|
| 2026-08-19 10:53 | polygonus-suporte-kb | [WEB-01] Notas parciais (WEB): não lança conceito nas avaliações (AV1, AV2…) |

## Rotina sugerida

1. `.\scripts\sync-github-homologacao.ps1` (2× ao dia ou quando a caixa encher)
2. Homologar **FULL** (app + portal) → **SANITY** (go via portal/app) → **LEGACY** só se aplicável
3. `.\sync.bat` nos repos **full** antes de testar
4. Maestro + checklist · evidência em `projects/polygonus/evidence/`
