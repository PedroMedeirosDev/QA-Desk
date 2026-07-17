---
name: polygonus-mural-maestro
description: >-
  Automação Maestro e homologação do Mural no app Polygonus (Android amostra).
  Use ao criar/editar flows YAML do Mural, depurar falhas de login/perfil/BoomMenu,
  rodar CTs CT-MURAL-*, sincronizar checklist na qa-app, ou quando o usuário
  mencionar Mural, comunicado, PHJESUS, ENTRAR, Maestro Studio ou emulador.
---

# Polygonus Mural — Maestro

Conhecimento operacional da suíte Mural. Detalhes longos: [reference.md](reference.md).
Contrato canônico de auth: `projects/polygonus/automation/maestro/flows/docs/CONTRATO_AUTH.md`.

## Raiz e appId

- Flows: `projects/polygonus/automation/maestro/flows/`
- Credenciais: `flows/.env` (não commitado) — `LOGIN_*`, `SENHA`, `NOME_PHJESUS`
- `appId`: `br.com.polygonus.mobile.amostra`
- Path do repo tem espaço (`Projetos Portfolio`) → rode Maestro com **cwd** em `.../maestro` e path **relativo** do flow (nunca path absoluto com espaço no shell).
- **CLI basta** — Maestro Studio é opcional (só para inspecionar seletores). Emulador ligado + `adb devices` + `maestro test`.
- Credenciais no CLI: passe `-e LOGIN_PHJESUS=... -e SENHA=...` (sem isso o Maestro digita `undefined`). O `.env` em `flows/` sozinho não cobre o flow em `flows/mural/`.
- A **qa-app** também usa CLI (`maestro test` / `maestro.bat`), não o Studio. Injeta o `.env` via `-e` **sem** `shell:true` (valores com espaço como `NOME_PHJESUS=Pedro Jesus` quebravam em `flows\Jesus`).

## Contrato obrigatório (sessão estável)

CT **termina** com `teardown_estavel_sessao.yaml` (home autenticada — **sem** logout). **Início:** `setup_coordenador_mural` → `resume_phjesus_coordenador` (reutiliza sessão, confirma `COORDENADOR` em Perfil).

```yaml
- runFlow: ../shared/mural/setup_coordenador_mural.yaml
# ... ação ...
- runFlow: ../shared/auth/teardown_estavel_sessao.yaml
```

Logout (`ensure_logged_out`) **só** em troca de usuário (ex.: início de `verificar_responsavel_ve`).

**Logout correto:** se estiver no Mural → Voltar até a home → tocar no **nome** → menu (Perfil / Tutorial / **Sair**) → `Sair`. Não usar drawer hamburger.

Na tela de login há `Versão:.*` (qa-app grava no registro via `adb dumpsys`).

## Usuários (amostra)

| Login | Papel | Uso nos CTs |
|-------|--------|-------------|
| `PHJESUS` | Professor **e** Coordenador | Envio (troca de função na UI) |
| `ETMENEZES` | Responsável | Só visualiza / confirma recebimento |
| `ACMENEZES` | **Aluno** (Ana) | **Nunca** para enviar comunicado |

Nome no header do PHJESUS: **Pedro Jesus** (`NOME_PHJESUS` no `.env`).

## Troca de perfil (crítico)

**Errado:** assumir perfil pelo Instagram/hover, drawer genérico, ou rótulos em title case.

**Certo:**

1. Home → tocar **foto** ou texto **Pedro Jesus**
2. Menu → **Perfil**
3. Dropdown mostra o valor **atual** (`COORDENADOR`, `PROFESSORES`, …)
4. Tocar o valor atual → lista → escolher o alvo
5. Back até home (`Pedro Jesus` / `MURAL`)

Textos **exatos** na lista (build amostra): `COORDENADOR` | `PROFESSORES` | `SUPORTE` | `SECRETARIA` | `RESPONSAVEIS`

Subflows:

- `shared/perfil/garantir_perfil_coordenador.yaml` — envio sem aprovação
- `shared/perfil/garantir_perfil_professor.yaml` — fica em **Pendentes**

Home **sem** card `MURAL` até o perfil correto (ex.: aluno / perfil errado). **MURAL visível ≠ Coordenador** — Professor também vê MURAL; confirmar em Perfil → `COORDENADOR`.

**CARDÁPIO** na home **só** indica PHJESUS em **SUPORTE** — nunca usar como prova de Coordenador, Professor, home genérica ou outro login.

## Navegação Mural

1. Tap `.*MURAL.*` (card pode ser `MURAL | 47`)
2. Loop `PULAR` (até 6×) — coach marks
3. Aba opcional: `Mural | Tab 1 of 2`
4. Pronto quando `Recebidas` / lista / `Responder comunicado`

Filtros (dropdown **abaixo do nome** dentro do Mural): `TipoSentidoDropdown` — labels em `types.dart` (`Recebidas`, `Enviadas`, `Pendentes`, …). Subflow: `selecionar_filtro_sentido.yaml`. Detalhes: `flows/docs/SELECTORES_APP.md`.

## BoomMenu / Novo comunicado (mais frágil)

Arquivo: `shared/mural/abrir_novo_comunicado.yaml`

1. FAB ~`86%, 88%` (fallback `90%, 90%`)
2. Esperar `.*Aviso.*` — accessibility real:  
   `Comunicado\nAviso ou notícia de interesse geral`
3. Tap `.*Aviso.*` (**não** tap só em `Comunicado` — colide com “Responder comunicado”)
4. Assert `Novo comunicado`, `Para:`, `Turma`

Evento: BoomMenu → `abrir_novo_evento` / `composer_novo_evento` (turmas + alvo Todos).  
CT-08 sem Dia inteiro (`Evento Padrão`); CT-13 com toggle Dia inteiro (`Evento Dia Inteiro`).

## Composer (strings estáveis)

| UI | Texto |
|----|--------|
| Hint | `Escreva seu texto aqui` |
| Enviar | tooltip `Enviar comunicado` |
| Turma | `Turma` |
| Overflow item | `Editar` / `Excluir` / `Salvar anexos` / `Compartilhar anexos` |
| Galeria | `Adicionar imagem da galeria` |
| Enquete | `Adicionar enquete ou aviso de recebimento` |

Overflow `more_vert` e picker DocumentsUI = mapear no Studio (sem texto estável).

## Template mental de CT de envio

```
setup_coordenador_mural → publicar_comunicado_texto (TEXTO)
→ [assert] → verificar_responsavel_ve (opcional)
```

**Anexos / enquete:** `composer_novo_comunicado` + `adicionar_*` / clipe + `enviar_comunicado`.  
Clipe: **Arquivo** (PDF/vídeo) · **Boleto** · **Correspondência** (Declaração de IR → Ok). Foto = galeria (esquerda).  
Boleto: funil (app bar) → **Inadimplentes** → Período (**Mes corrente** CT-11 ou competência **01** CT-14) + clipe → Boleto.

**Editar / excluir:** dropdown → **Enviadas** → menu `Show menu` (⋮) → `editar_comunicado_lista` / `excluir_comunicado_lista`.

Texto base reutilizado: `Teste Comunicado` → editado → excluído (CTs 01→02→03). Demais CTs usam textos únicos (ver [reference.md](reference.md)).

### Captura / validação por ID — consolidado

Doc completa: `flows/docs/PIPELINE_ID_MURAL.md`.

Badge `ID 123` só no **content-desc** de `mural_card_menu`. Helpers: `seed_id_*`, `assert_comunicado_por_id`, `assert_comunicado_ausente_por_id`, `mural-card-id.ts`.

Pipeline qa-app (`runMaestroFlowWithMuralCardId`):

- **Pré-ação (02/03):** prep → adb ID → CT gerado → pós-check  
- **Pós-envio (01/04/05/06/07):** YAML até Enviadas → adb ID → assert (+ ETMENEZES / Compartilhar se aplicável)

Composer: após turmas, sempre `selecionar_alvo_todos` (Para: Alunos → Todos).

**Windows:** só `-e ID_COMUNICADO=<digitos>` (sem espaço). Credenciais no `flows/.env`.

## STATUS draft vs ready

Cabeçalho do YAML: `STATUS: draft` até passar **2×** no emulador; só então `ready` e marcar readiness na qa-app.

## Emulador / Maestro (estabilidade)

- Preferir CLI: `maestro --udid emulator-5554 test <flow-relativo>`
- **Não** abrir vários Maestro Studios + CTs em paralelo → ANR / “No device connected”
- Confirmar `adb devices` = `device` antes de rodar
- Batch na qa-app: campanha continua se um CT falhar; ver histórico “Onde falhou”
- **Artefatos:** Maestro grava PNG a cada run (não só em erro). Após PASS, `scripts/cleanup-test-artifacts.mjs` apaga a pasta do run e cópias de anexos no emulador (`Foto_1 (1).jpeg`, etc.). Em FAIL, prints ficam em `.maestro-output/`.

## qa-app

- Checklist Mural: `MURAL_HOMOLOGATION_ITEMS` em `qa-app/server/automation.ts`
- Diagnósticos: `qa-app/server/maestro-diagnostics.ts` (versão + passo/ação falha)
- Homologação: ▶ Rodar homologação inteira na campanha Mural

## Ao criar flow novo

1. Reutilizar `shared/auth`, `shared/perfil`, `shared/nav`, `shared/mural` — não duplicar login
2. Respeitar porto seguro ENTRAR
3. Documentar no YAML o que ainda é STUDIO (coordenada / overflow / picker)
4. Atualizar checklist em `automation.ts` se for CT de homologação
5. Ler [reference.md](reference.md) para catálogo CT-MURAL-01…10 e anti-padrões
