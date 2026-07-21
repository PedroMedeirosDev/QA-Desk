---
name: homologacao-suporte-kb
description: >-
  Homologar PRs de curadoria da base de conhecimento polygonus-suporte-kb —
  avaliar se o TEXTO da solução (a resposta para o staff / IA de 1ª camada) está
  correto, claro, seguro e acionável, usando o código só como prova. Use ao
  revisar/homologar PRs de kb/ ou mapas/ do polygonus-suporte-kb, quando o
  gestor pedir para conferir artigos de suporte, ou ao mencionar homologação da
  KB, curadoria de thread, ou artigos kb-*.
---

# Homologação — polygonus-suporte-kb

Repo: `polygonus-br/polygonus-suporte-kb` (branch default **`master`**). Clone local na raiz do QA Desk (`polygonus-suporte-kb/`, gitignored). Repos-fonte na mesma raiz: `acropoly-server` (Delphi, branch `cq`), `polygonus-server` (`poly-server`), `polygonus-go`, `polygonus-mobile`, `polygonus-react`.

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
- [ ] id do frontmatter é ÚNICO (não colide com master nem com outro PR aberto)
- [ ] Estrutura: Sintomas → Resposta → Quando escalar → Fonte
- [ ] Menu/aba/botão citados = nomes reais (conferir .xfm/.dart/mapa)
- [ ] Passo a passo correto e completo (não pula campo obrigatório)
- [ ] Nenhuma instrução perigosa sem escala/aviso
- [ ] gerado_por declara honestamente "não verificado em tela" quando é o caso
- [ ] Sem arquivos fora de kb/ e mapas/ (tooling, config, specs órfãos)
- [ ] Sem side-effect de infra (ex.: mudar baseURL do playwright.config.ts)
```

## Armadilhas recorrentes (jul/2026)

- **Colisão de id**: `fin-009`, `aca-008`, `aca-004`, `seg-001`, `ger-003` já duplicam no `master`. Todo PR novo tem que pegar id livre. Verificar: `rg -n "^id: <id>" kb`.
- **Branch empilhada**: PR arrasta arquivo de outro PR (ex.: #29 levava o artigo do #28). Rebasear em `master`.
- **Escopo sujo**: PR de KB mexendo em `tools/opus-residente/`, `.claude/skills/`, `playwright.config.ts`.
- **Rótulo de menu/comando errado**: ex. "Excluir D.P.S." em vez de "Excluir RPS local"; "Cadastros Gerais" em vez de "Cadastros Comuns → Empresas → Entidades (01.03.02)".
- **Generalização acima do código**: ex. trava NFS-e compara só `MonthOf` (sem ano) — afirmar "só bloqueia mês futuro" é falso.
- **Botão "vincula" que na verdade só remove**; **FAB gated** em uma tela mas não em outra — conferir no `.pas`/`.dart` antes de afirmar.

## Fluxo

1. `gh pr view <n> --repo polygonus-br/polygonus-suporte-kb --json number,title,body,files,commits,state,mergeable`
2. `gh pr diff <n>` — ler o texto do artigo como se fosse o atendente.
3. Rodar o checklist acima; provar cada afirmação-chave com `rg` nos repos-fonte.
4. Conferir id: `rg -n "^id: " polygonus-suporte-kb/kb -g "*.md"`.
5. Veredito por PR: **Aprovável** / **Precisa correção** / **Bloqueado**, com correção exata.

## Verificação em profundidade (opcional)

Só o texto grounded no código promove de "draft" a "verificado". Para provar de fato na tela: bancada CQ + Playwright/manual em **banco local** (nunca produção). Ver `.claude/skills/bancada-cq` no `acropoly-server` e a suíte em `polygonus-suporte-kb/testes/e2e/`.

## Restrições

- **Somente leitura por padrão.** Não commitar, não aprovar/comentar no GitHub, não editar artigo sem o usuário pedir.
- Windows/PowerShell: passar credenciais/paths com espaço com cuidado; o path do QA Desk tem espaço.

## Achados por PR

Homologação de 21/07/2026 (21 PRs mais antigos abertos): ver [achados-2026-07.md](achados-2026-07.md).
