---
name: homologacao-suporte-kb
description: >-
  Homologar PRs de curadoria da base de conhecimento polygonus-suporte-kb —
  avaliar se o TEXTO da solução (a resposta para o staff / IA de 1ª camada) está
  correto, claro, seguro e acionável, usando o código só como prova. Ao detectar
  colisão de id no frontmatter, ajustar automaticamente para um id livre (master ∪
  PRs abertas), sem merge sem autorização explícita do revisor humano. Use ao
  revisar/homologar PRs de kb/ ou mapas/ do polygonus-suporte-kb, quando o
  gestor pedir para conferir artigos de suporte, ou ao mencionar homologação da
  KB, curadoria de thread, ou artigos kb-*.
---

# Homologação — polygonus-suporte-kb

Repo: `polygonus-br/polygonus-suporte-kb` (branch default **`master`**). Clone local na raiz do QA Desk (`polygonus-suporte-kb/`, gitignored). Repos-fonte na mesma raiz: `acropoly-server` (Delphi, branch `cq`), `polygonus-server` (`poly-server`), `polygonus-go`, `polygonus-mobile`, `polygonus-react`.

## Pré-requisito — sync dos clones da empresa

**Antes de qualquer homologação Polygonus nesta sessão**, sincronizar **só** os clones da empresa (skill [sync-company-repos](../sync-company-repos/SKILL.md) → mapa `scripts/company-repos.json`). Não syncar repos pessoais. Rodar o script **sem** `-Hard`, resumir OK/AVISO, só então abrir o primeiro PR.

## O que se homologa (foco)

O produto do PR é um **artigo de KB**: a **resposta em texto** que a IA de 1ª camada / o staff vai usar. O que importa homologar, em ordem:

1. **Correção factual** — o passo a passo resolve mesmo o sintoma descrito?
2. **Clareza** — o atendente/IA consegue executar sem ambiguidade? Nomes de tela, menu e botões batem com o produto?
3. **Segurança** — nenhuma instrução destrutiva/perigosa para quem não tem contexto (ex.: mexer em cadastro global, desfazer baixa financeira). Se arriscado → `escala: true` + orientar humano.
4. **Fronteira certa** — "resolve sozinho" vs "escalar" está no lugar? (regra de ouro: é bug/incerto → escala).

O **código é meio, não fim**: pela regra da própria KB (`kb/README.md`), *"a resposta nasce do código"*. Então cruzar com o Delphi/Go serve para **provar** que o texto está certo — não para virar o parecer numa lista de linhas de `.pas`.

## Critérios objetivos (checklist por PR)

```
- [ ] Título/body do PR batem com os arquivos do diff (sem escopo extra)
- [ ] id do frontmatter ÚNICO — se colidir: auto-ajuste (não é item de veredito)
- [ ] Estrutura: Sintomas → Resposta → Quando escalar → Fonte
- [ ] Menu/aba/botão citados = nomes reais (conferir .xfm/.dart/mapa)
- [ ] Passo a passo correto e completo (não pula campo obrigatório)
- [ ] Nenhuma instrução perigosa sem escala/aviso
- [ ] gerado_por declara honestamente "não verificado em tela" quando é o caso
- [ ] Sem arquivos fora de kb/ e mapas/ (tooling, config, specs órfãos)
- [ ] Sem side-effect de infra (ex.: mudar baseURL do playwright.config.ts)
```

## Auto-ajuste de `id` (colisão) — fora do fluxo de correção

O Opus/curadoria faz **dedup de conteúdo** (sintomas/tags), mas **não reserva id** de forma confiável entre PRs em paralelo — várias abertas reutilizam o mesmo `aca-008` / `seg-001` / etc.

**Id é higiene técnica, não pontuação de revisão.** Colisão de número **em artigo genuinamente novo** não entra em `corrections`, não gera veredito `precisa_correcao`, não muda status para `aguardando_correcao`, e **não** justifica `CHANGES_REQUESTED` só por id. O homologador resolve e segue para o conteúdo.

### Antes de renumerar: colisão de id ≠ artigo novo

Se o `id` colide com um artigo **já no master** (mesmo domínio/número), **abrir o artigo do master** e comparar sintomas/causa/procedimento:

| Situação | Ação |
|---|---|
| Mesmo caso / quase o mesmo texto (ex. PR queria `seg-001` e o master já tem `perfil-acesso-mobile-app` com esse id) | **Não** auto-renumerar para `seg-006`. É **duplicata ou enrich**: `CHANGES_REQUESTED` pedindo fundir no artigo existente (ou fechar). Renumerar só cria paralelo artificial. |
| Artigo **novo** (caso distinto) que por acaso reusou um id ocupado | Auto-ajuste: próximo id livre do mesmo domínio + comentário informativo. |

Lição (#44): o PR nasceu como `seg-001` porque era o mesmo tema do master; a skill renumerou para `seg-006` e mascarou a duplicidade. O caminho certo era enrich do `seg-001` (como o #77 fez).

### Quando for auto-ajuste (artigo novo + id ocupado)

1. **Reservatório** = ids no `master` (`rg -n "^id: " kb -g "*.md"`) **∪** `+id:` no diff de **todas** as PRs abertas (`gh pr list` + `gh pr diff`).
2. Escolher o próximo livre do **mesmo domínio** (`aca-NNN`, `seg-NNN`, `fin-NNN`…). Não inventar prefixo.
3. **Commit + push** na branch do PR + comentário **informativo**, em tom natural (ex.: “Ajustei o id de X para Y porque o X já está no master / em outra PR. Só troca de id — causa e passo a passo iguais.”). Não pedir correção ao autor.
   - **Só editar o(s) arquivo(s) do diff desta PR** onde o `id` está sendo introduzido/alterado. Nunca reescrever outro artigo do `master` que por acaso compartilhe o id colidente (checkout da branch traz o tree inteiro).
4. Várias PRs com o **mesmo** id (artigos novos distintos): processar em ordem de número crescente; **reconsultar** o reservatório depois de cada push.
5. Dois PRs **enrich no mesmo arquivo** de artigo → **não** é só id: marcar conflito de escopo / pedir rebase ou fundir; não “resolver” sozinho.
6. **Curadoria / veredito após o auto-fix** (só o caso “artigo novo”):
   - Conteúdo ok → `aprovavel` + status `aguardando_revisao` (até o humano autorizar merge). **Não** listar o id em `corrections`.
   - Conteúdo com falhas → `precisa_correcao` / `aguardando_correcao` só com as falhas de conteúdo; id **nem aparece** nas corrections.

### Merge — autorização obrigatória do revisor humano

Mesmo que o **único** problema interceptado/ajustado tenha sido o `id`, **não mesclar** sem o usuário (Pedro / revisor humano) **autorizar explicitamente** o merge.

- Auto-fix de id **não** substitui a revisão do **conteúdo** (causa, passo a passo, escala, segurança).
- Após o ajuste: apresentar veredito (**Aprovável** / ainda há pendências de conteúdo) e **aguardar** “pode mergear” / “aprova e mescla”.
- Nunca `gh pr merge` (nem approve+merge em lote) só porque o id ficou livre.
- **Antes do merge:** deixar um **comentário curto** de aprovação — preferir **uma** via só: `gh pr review --approve --body "…"` **ou** `gh pr comment` (não os dois, evita duplicar “Aprovado” no histórico). 1–2 frases (o que foi confirmado / por que passa). Evitar merge “seco” sem contexto.

## Armadilhas recorrentes (jul/2026)

- **Colisão de id**: se o id no master é do **mesmo caso** → dedup/enrich (`CHANGES_REQUESTED`), **não** renumerar. Só auto-ajustar id quando o artigo for **novo** e o número estiver ocupado por outro caso.
- **Branch empilhada**: PR arrasta arquivo de outro PR (ex.: #29 levava o artigo do #28). Rebasear em `master`.
- **Escopo sujo**: PR de KB mexendo em `tools/opus-residente/`, `.claude/skills/`, `playwright.config.ts`.
- **Rótulo de menu/comando errado**: ex. "Excluir D.P.S." em vez de "Excluir RPS local"; "Cadastros Gerais" em vez de "Cadastros Comuns → Empresas → Entidades (01.03.02)".
- **Generalização acima do código**: ex. trava NFS-e compara só `MonthOf` (sem ano) — afirmar "só bloqueia mês futuro" é falso.
- **Botão "vincula" que na verdade só remove**; **FAB gated** em uma tela mas não em outra — conferir no `.pas`/`.dart` antes de afirmar.

## Fluxo

0. **Sync dos clones Polygonus** — skill [sync-company-repos](../sync-company-repos/SKILL.md) (mapa da empresa; uma vez no início da sessão).
1. `gh pr view <n> --repo polygonus-br/polygonus-suporte-kb --json number,title,body,files,commits,state,mergeable`
2. `gh pr diff <n>` — ler o texto do artigo como se fosse o atendente.
3. Rodar o checklist; se `id` colidir → **comparar com o artigo do master** (dedup?) antes de auto-ajustar; só renumerar se for artigo novo. Sem request-changes **só** por id numérico.
4. Provar cada afirmação-chave com `rg` nos repos-fonte.
5. Veredito por PR só sobre **conteúdo**: **Aprovável** / **Precisa correção** / **Bloqueado**. Corrections = só falhas reais (nunca id).
6. **Merge só se o usuário autorizar** após revisar o conteúdo (mesmo pós auto-fix de id). No merge: **comentário breve** de aprovação + `gh pr merge` (não mergear em silêncio).

## Verificação em profundidade (opcional)

Só o texto grounded no código promove de "draft" a "verificado". Para provar de fato na tela: bancada CQ + Playwright/manual em **banco local** (nunca produção). Ver `.claude/skills/bancada-cq` no `acropoly-server` e a suíte em `polygonus-suporte-kb/testes/e2e/`.

## Idioma

Commits, reviews, comentários de PR e vereditos de homologação em **português** (padrão da empresa). Não usar inglês em mensagens de aprovação/correção.

## Restrições

- **Somente leitura por padrão** (não comentar/aprovar/mesclar no GitHub sem o usuário pedir).
- **Exceção autorizada:** auto-ajuste de `id` colidente (commit/push na branch + comentário), conforme a seção acima.
- **Merge / approve+merge:** somente com autorização explícita do revisor humano — ele precisa revisar o conteúdo antes.
- Windows/PowerShell: passar credenciais/paths com espaço com cuidado; o path do QA Desk tem espaço.

## Achados por PR

Homologação de 21/07/2026 (21 PRs mais antigos abertos): ver [achados-2026-07.md](achados-2026-07.md).
