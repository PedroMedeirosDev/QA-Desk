# Achados — homologação 21/07/2026

Escopo: 21 PRs mais antigos abertos do `polygonus-suporte-kb` (`#28–#30`, `#34–#46`, `#72–#76`). Somente leitura. **Nenhum PR tem CI/checks.** IDs já colidem no `master` (dívida pré-existente): `fin-009`, `aca-008`, `aca-004`, `seg-001`, `ger-003`, `fin-006`.

Legenda: ✅ aprovável · ⚠️ precisa correção · ⛔ bloqueado.

## Aprováveis (7)

| PR | Artigo | Nota |
|----|--------|------|
| ✅ #40 | boleto múltiplos logins/unidades no app (`fin-003` enrich) | Causa confirmada em `polygonus-go/internal/usuario/service.go` (`ObterEntidadesDoUsuario`). Opcional: citar workaround de logar na unidade com aluno ativo. |
| ✅ #41 | Fale Conosco conversas duplicadas v1×v2 (`ate-003`) | v1 `AtendimentoVelho.Service.pas` sem dedup; v2 `internal/chat/service.go` dedup `(canal,solicitante,matricula)`. `ate-003` livre. |
| ✅ #45 | boletim infantil / Regente (`aca-008`) | Confirmado em `URltAvalHabilidade.pas`. Clarificar "Modelo I" e categorias 0,1,6. `aca-008` é dívida antiga. |
| ✅ #46 | tipos/termos ocorrência App (`psi-002`) | `psi-002` livre. Ajustar "cache local" — path atual usa HTTP direto (`AgendaPageController`), Hive é fluxo legado. |
| ✅ #74 | enrich seg-001 comunicados de outros | Delta aditivo; causa já ancorada (`ind_ver_com_outros`). Cuidado: **#83 mexe no mesmo arquivo**. |
| ✅ #75 | Mural/Rotina feed cumulativo (`kb-aca-007`) | `Ocorrencia.Service.pas GetOcorrenciasDoUsuario` + app envia só `dat_final`. `escala:false` correto. |
| ✅ #76 | competência escrita contábil (`fin-011`) | `salvar.go` (`mesComp==0 → ano*100+mês`) + `URltEscrita4.pas`. `fin-011` livre. |

## Precisam correção (13)

| PR | Problema principal | Correção exata |
|----|--------------------|----------------|
| ⚠️ #28 | `id: fin-009` colide (master + #36) | Novo id (ex. `fin-012`); menu → "Cadastros Comuns → Empresas → Entidades (01.03.02)"; tabela: MEI e ME/EPP → `snSim` (`pTotTribSN` quando `snSim`). |
| ⚠️ #29 | Diff arrasta o artigo do #28; tese SICREDI "QR não cobra" não está no código | Rebasear em master; marcar SICREDI/bolepix como relato operacional, não regra do parse. `fin-010` ok. |
| ⚠️ #30 | **CONFLICTING** + `tools/opus-residente/*`, skill Claude, rematrícula fora de escopo | Deixar só `kb/financeiro/relatorio-inadimplencia-aluno-ja-pagou.md`; tooling em PR à parte. Reforçar cautela na correção de baixa. `fin-011` (conflita com #76 — coordenar). |
| ⚠️ #34 | `id: aca-008` colide; muda `playwright.config.ts` baseURL .101→.102 | Novo id; reverter/parametrizar baseURL. Conteúdo (2 checkboxes) confirmado em `USelDiarioNotasParc`. |
| ⚠️ #35 | `id: aca-004` colide; rótulos ≠ captions | Novo id; captions reais: "Observações finais:", "Linha obs. destaque:"; nuance `ind_obs_destaque` + layout horizontal. |
| ⚠️ #36 | `id: fin-009` (master + #28); **"Excluir D.P.S. Local" errado**; menu errado | Novo id (ex. `fin-013`); trocar por "Excluir RPS local"; menu Cadastros Comuns. Prestador←`entidade.telefone` confirmado (`UNfseUtils.pas:998`). |
| ⚠️ #37 | `id: ger-003` colide; cria `mapas/cadastros/perfis-de-acesso.md` (duplica `mapas/seguranca/`); "aba Usuários vincula" (código só remove); pula Função obrigatória | Novo id; enriquecer o mapa de segurança existente; corrigir passo (Função `CbxTipUsuario` obrigatória); remover travas órfãs. |
| ⚠️ #38 | Instrução perigosa: editar tipo em "Funções 01.01.06d" afeta todos | Preferir Perfis 08.02.01 → Função do perfil do cargo; avisar impacto amplo de `tip_usuario`; separar flag Nível 1 por tipo de envio. |
| ⚠️ #39 | `id: aca-008` colide; depende do #37; overclaim no FAB de notas | Novo id (ex. `aca-011+`); notas = campos read-only, conteúdo/tarefa = FAB some; apontar mapa de segurança. |
| ⚠️ #42 | `id: fin-009` colide | → `fin-010`; remover tag `portal`; nota de que abate de devoluções no motor de carta não é só Base "Ano Pagamento". |
| ⚠️ #43 | `id: seg-001` colide (master + #44); "oculta/prevalece" impreciso | Novo id (`seg-004+`); botão fica **desabilitado** (não oculto — aba que oculta); qualificar "Negado prevalece". |
| ⚠️ #44 | `id: seg-001`; sobrepõe `perfil-acesso-mobile-app.md` (já em master) | Fundir com o artigo existente OU novo id + cross-link; renomear spec `seg-001-...`. |
| ⚠️ #72 | `id: aca-008` colide (master + #45) | Novo id; opcional: aviso de não copiar fórmula sem conferir escala/apuração. Causa (fórmula do conceito na grade) confirmada. |
| ⚠️ #73 | Regra inexata: trava compara só `MonthOf` (sem ano), não "só mês futuro" | Reescrever regra 1 com o `MonthOf(DataComp) > MonthOf(Today)` literal; IPM como relato, não regra. Cidades 5300108/1100205 forçam competência=emissão (confirmado). `fin-010` (coordenar com #29/#42). |

## Bloqueado (1)

| PR | Motivo |
|----|--------|
| ⛔ #30 | `mergeable: CONFLICTING` + escopo misturado (tooling/skill). Resolver conflito e separar antes de qualquer merge. |

## Conflitos cruzados a resolver antes de mergear

- `fin-010` disputado por #29, #42, #73 → atribuir ids distintos.
- `fin-011` em #30 e #76.
- `seg-001` em #43 e #44 (não podem entrar juntos com o mesmo id).
- `aca-008` em #34, #39, #45, #72 (+ master).
- #37 → #39 empilhados; #74 e #83 no mesmo arquivo.

## Ordem sugerida (quando autorizado a corrigir)

1. Resolver conflito/escopo de #30 e #29.
2. Renumerar ids em lote (fin/aca/seg/ger) evitando colisões cruzadas.
3. #37 → #39 (dependência de branch).
4. Corrigir rótulos/regra: #36 (RPS), #73 (MonthOf), #38 (caminho seguro).
5. Mergear os 7 aprováveis: #40, #41, #45, #46, #74, #75, #76.
