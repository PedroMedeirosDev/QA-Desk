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

## Contrato obrigatório (porto seguro)

Todo CT **começa e termina** com `ENTRAR` visível.

```yaml
- runFlow: ../shared/auth/login_phjesus.yaml   # = ensure_login + login_as
# ... ação ...
- runFlow: ../shared/auth/ensure_logged_out.yaml
```

**Não use `clearState: true` nos CTs.** Sessão e tutoriais persistem; limpar dados faz onboarding/`PULAR` voltarem sempre. Porto seguro = `launchApp` sem clear + logout gracioso. Reset nuclear só em `shared/auth/reset_app_state.yaml`.

**Logout correto:** se estiver no Mural → Voltar até a home → tocar no **nome** → menu (Perfil / Tutorial / **Sair**) → `Sair`. Não usar drawer hamburger.

Na tela de login há `Versão:.*` (qa-app grava no registro via `adb dumpsys`).

## Usuários (amostra)

| Login | Papel | Uso nos CTs |
|-------|--------|-------------|
| `PHJESUS` | Professor **e** Coordenador | Envio (troca de função na UI) |
| `ETMENEZES` | Responsável | Só visualiza / confirma recebimento |
| `ACMENEZES` | **Aluno** (Eliza) | **Nunca** para enviar comunicado |

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

Home **sem** card `MURAL` até o perfil correto (ex.: aluno / perfil errado).

## Navegação Mural

1. Tap `.*MURAL.*` (card pode ser `MURAL | 47`)
2. Loop `PULAR` (até 6×) — coach marks
3. Aba opcional: `Mural | Tab 1 of 2`
4. Pronto quando `Recebidas` / lista / `Responder comunicado`

Filtros: `Recebidas` | `Enviadas` | `Pendentes` | `Aprovadas`

## BoomMenu / Novo comunicado (mais frágil)

Arquivo: `shared/mural/abrir_novo_comunicado.yaml`

1. FAB ~`86%, 88%` (fallback `90%, 90%`)
2. Esperar `.*Aviso.*` — accessibility real:  
   `Comunicado\nAviso ou notícia de interesse geral`
3. Tap `.*Aviso.*` (**não** tap só em `Comunicado` — colide com “Responder comunicado”)
4. Assert `Novo comunicado`, `Para:`, `Turma`

Evento: BoomMenu item `Evento\nAtividade…` (flow `01_1_comunicado_evento.yaml`).

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
login_phjesus → garantir_perfil_coordenador → navegar_mural
→ abrir_novo_comunicado → selecionar_turmas → escrever → enviar
→ [assert] → ensure_logged_out → login_etmenezes → navegar_mural → [assert]
→ ensure_logged_out
```

Textos de teste usados: `Teste Comunicado`, `Teste Comunicado editado`, `Teste Comunicado professor`, etc. (ver [reference.md](reference.md)).

## STATUS draft vs ready

Cabeçalho do YAML: `STATUS: draft` até passar **2×** no emulador; só então `ready` e marcar readiness na qa-app.

## Emulador / Maestro (estabilidade)

- Preferir CLI: `maestro --udid emulator-5554 test <flow-relativo>`
- **Não** abrir vários Maestro Studios + CTs em paralelo → ANR / “No device connected”
- Confirmar `adb devices` = `device` antes de rodar
- Batch na qa-app: campanha continua se um CT falhar; ver histórico “Onde falhou”

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
