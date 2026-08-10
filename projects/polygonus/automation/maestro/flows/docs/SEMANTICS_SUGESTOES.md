# Semantics — app Polygonus (Maestro / Playwright / QA)

> **Sync 2026-07-20:** `polygonus-mobile` `cq` → `4a414067` (v6.06.10) — **P0 implementados**.  
> Flows QA já preferem `id:` nos subflows de funil, alvo, dia inteiro, data evento, PULAR e Sair.  
> **2026-08-09:** smoke WEB (gestão → Comunicados) OK na abertura; taps de menu **bloqueados** — ver seção **WEB / Playwright**.

```dart
Semantics(
  identifier: 'modulo_contexto_acao',
  button: true,
  child: /* widget */,
)
```

Maestro: `tapOn: id: "modulo_contexto_acao"`  
Playwright (Flutter web, com árvore a11y): `getByRole` / `flt-semantics` / `aria-label` alinhados ao mesmo `identifier`.

**Convenção:** `{modulo}_{tela_ou_contexto}_{acao}` · snake_case · ASCII.

**Padrão nos subflows QA:** `id:` primeiro → fallback texto/coordenada só se o id não existir.

**Não Semantics:** pickers nativos Android (galeria / DocumentsUI).

---

## Pedido aos desenvolvedores (copiar / colar)

### Contexto
Homologação de regressão **APP + WEB** (mesmo app Flutter; WEB = gestão **Comunicação → Comunicados**). Smokes de menu no APP (Maestro) já rodam; no WEB o Playwright abre o iframe Flutter, mas **não consegue clicar nos tiles** da home.

### Problema WEB (bloqueante para espelho Playwright)
- Build amostra (probe 2026-08-09): iframe `/acropoly/web/flutter/` com **CanvasKit**.
- DOM do iframe: `body` vazio, `semantics ≈ 1`, canvases presentes — **sem árvore a11y utilizável**.
- Spec: `automation/playwright/mural/smoke-comunicados-web.spec.ts` (abertura passa; taps só com a11y).

### O que pedimos
1. **Habilitar Semantics no Flutter web** (mesmos `identifier` do APP) **ou** build web com renderer/HTML que exponha a árvore acessível aos automadores.  
2. Completar os **`home_card_*` faltantes** na tabela abaixo (hoje estáveis só `home_card_mural` e `home_card_chat`).  
3. Badge de notificação **não** misturar no `content-desc` / nome acessível do card (ex.: `ATENDIMENTO\n25`).  
4. Rótulo visível completo nos tiles (ref. `BUG-2026-002` — Avaliação do Conhecimento truncada).

### Critério de aceite (QA)
- Maestro: `tapOn: id: "home_card_…"` nos menus in-scope (sem depender só de texto/badge).  
- Playwright no Comunicados: localizar o mesmo tile (semantics / aria) e abrir → voltar (espelho do smoke APP).  
- Fora de escopo: Aula Online, Chegando.

---

## Implementados no app (45)

### Auth / home / perfil
| `identifier` | Arquivo |
|--------------|---------|
| `auth_login_usuario` / `senha` / `entrar` | `login_page.dart` |
| `auth_onboarding_avancar` | `presentation_buttons_mixin.dart` |
| `home_menu_usuario` | `aluno_com_avatar_widget.dart` |
| `home_menu_sair` | `aluno_com_avatar_widget.dart` |
| `home_coach_pular` | `home_page.dart` |
| `home_card_mural` | `card_widget.dart` (`00.02`) |
| `home_card_chat` | Atendimento **novo** (confirmado em hierarchy 2026-08-09; `content-desc` ainda traz badge `ATENDIMENTO\n25`) |
| `perfil_dropdown_funcao` | `perfil_page.dart` |

### Mural / composer / evento
| `identifier` | Arquivo |
|--------------|---------|
| `mural_boom_fab` / `comunicado` / `evento` | `mural_widget.dart` |
| `mural_filtro_sentido` | `aluno_com_avatar_widget.dart` |
| `mural_card_menu` | `mensagem_widget.dart` |
| `mural_composer_galeria` / `camera` / `enquete` / `anexo` / `enviar` | `bottom_bar_widget.dart` |
| `mural_composer_texto` / `turma` / `alvo` | `nova_mensagem_page.dart` |
| `mural_composer_filtro` / `preview` | `nova_mensagem_page.dart` AppBar |
| `mural_evento_dia_inteiro` / `data_inicio` | `nova_mensagem_page.dart` |
| ⚠️ `mural_composer_texto` | Maestro usa **hint** (id colide com enquete no emulador) |

### Rotina boom
`rotina_boom_fab`, `ocorrencia`, `momentos`, `bilhete`, `alimentacao`, `soneca`, `banheiro`, `saude`, `humor`, `vestuario` — `rotina_widget.dart`

### Chat / Diário / Portal / Chegando
| `identifier` | Arquivo |
|--------------|---------|
| `chat_lista_fab_nova` | `conversas_page.dart` |
| `chat_input_anexo` / `camera` / `enviar_ou_mic` | `message_input_bar.dart` |
| `diario_tarefa_fab_novo` | `lista_tarefa_page.dart` |
| `portal_conteudo_upload` | `ver_conteudo.dart` |
| `chegando_beep_toggle` / `chegando_filtro` | `chegada_page.dart` |

### Flows QA já atualizados (id primeiro)
| Flow | IDs |
|------|-----|
| `abrir_filtro_extras_composer.yaml` | `mural_composer_filtro` |
| `selecionar_alvo_todos.yaml` | `mural_composer_alvo` |
| `marcar_dia_inteiro.yaml` | `mural_evento_dia_inteiro` |
| `selecionar_data_evento_dia_seguinte.yaml` | `mural_evento_data_inicio` |
| `abrir_menu_primeiro_comunicado.yaml` / `abrir_menu_tres_pontos.yaml` / `abrir_menu_compartilhar_anexos.yaml` | `mural_card_menu` |
| `tap_acao_menu_card.yaml` | texto `Editar`/`Excluir` (até existir `mural_card_editar` / `mural_card_excluir`) — **só em Enviadas** |
| `dismiss_coachmarks_pular.yaml` | `home_coach_pular` |
| `logout.yaml` | `home_menu_usuario`, `home_menu_sair` |

---

## Ainda sugeridos (P1 / P2 — não no app)

### P1 — próximo lote
| `identifier` | Onde |
|--------------|------|
| `home_card_*` (demais menus — lista abaixo) | Estender padrão `home_card_mural` / `home_card_chat` |
| `home_menu_perfil` / `tutorial` | Popup header |
| `home_dialog_sair_confirmar` | Diálogo confirmar sair |
| `home_selecionar_aluno` / `home_filtro_aplicar` / `limpar` | Header filtros |
| `mural_tab_*` / `mural_bilhete_fab` | Abas + bilhete |
| `mural_card_editar` / `excluir` / anexos | Itens do ⋮ |
| `mural_composer_marcador` / `opcoes` / `filtro_limpar` | Composer |
| `mural_evento_titulo` / `hora_inicio` / `data_fim` | Evento |
| `shared_dialog_sim` / `nao` | polyConfirmDialog |
| `rotina_composer_*` | `agenda_bottom_bar_widget.dart` |
| `diario_*` anexos / enviar / card menu | Diário |
| `chat_conversa_*` / `chat_selecao_*` | Chat AppBar |
| `atendimento_*` | Fale conosco (tela interna; tile já tem `home_card_chat`) |
| `portal_boleto_*` | Boleto |
| `ocorrencia_enviar` / `data` | Ocorrência |
| `calendario_menu` | Calendário |
| Auth: `toggle_senha` / `esqueci` / `FAZER LOGIN` | Login |
| Lançamento Professor: `notas_*` / `conteudo_*` / `tarefas_*` | Telas de lançamento (mapear na próxima leva) |

### Home — `home_card_*` a pedir (regressão 2026-08)

Só `home_card_mural` e `home_card_chat` estáveis hoje (APP). Demais tiles = só `content-desc` (frágil com badge/acento/truncamento). **Mesmos ids devem existir no WEB** após a11y Flutter web.

| Perfil | Menu | `identifier` sugerido | Superfície |
|--------|------|------------------------|------------|
| Coord/Prof/Resp | Mural | `home_card_mural` | APP+WEB — **já existe** (validar WEB) |
| Coord/Prof/Resp | Atendimento | `home_card_chat` | APP+WEB — **já existe** (validar WEB; limpar badge do nome a11y) |
| Coord/Prof/Resp | Calendário | `home_card_calendario` | APP+WEB — **pedir** |
| Coord/Prof | Notas | `home_card_notas` | APP+WEB — **pedir** |
| Coord/Prof | Conteúdo e Frequência | `home_card_conteudo_frequencia` | APP+WEB — **pedir** |
| Coord/Prof | Tarefas | `home_card_tarefas` | APP+WEB — **pedir** |
| Coord/Prof | Ocorrências | `home_card_ocorrencias` | APP+WEB — **pedir** |
| Coord/Prof | Meus Alunos | `home_card_meus_alunos` | APP+WEB — **pedir** |
| Coord/Prof/Resp* | Cardápio | `home_card_cardapio` | APP+WEB — **pedir** |
| Resp | Boletim Online | `home_card_boletim` | APP+WEB — **pedir** |
| Resp | Notas Parciais | `home_card_notas_parciais` | APP+WEB — **pedir** |
| Resp | Mensalidade | `home_card_mensalidade` | APP+WEB — **pedir** |
| Resp | Conteúdo Lecionado | `home_card_conteudo_lecionado` | APP+WEB — **pedir** |
| Resp | Frequência do Aluno | `home_card_frequencia_aluno` | APP+WEB — **pedir** |
| Resp | Meus Documentos | `home_card_meus_documentos` | APP+WEB — **pedir** |
| Resp | Horário | `home_card_horario` | APP+WEB — **pedir** |
| Resp | Tarefas para Casa | `home_card_tarefas_casa` | APP+WEB — **pedir** |
| Resp | Avaliação do Conhecimento | `home_card_avaliacao_conhecimento` | APP+WEB — **pedir** (+ UI truncamento) |
| Resp | Avaliação de Habilidades | `home_card_avaliacao_habilidades` | APP+WEB — **pedir** |
| Resp | Notas Fiscais | `home_card_notas_fiscais` | APP+WEB — **pedir** |

\* Cardápio também no Coordenador/Professor.

**Regras para o pedido aos devs:**
1. `Semantics(identifier: 'home_card_…')` no tile clicável (mesmo padrão de `home_card_mural`).
2. Expor a mesma árvore no **Flutter web** (Semantics habilitado / a11y), não só no Android.
3. Badge de notificação **não** misturar no nome acessível do card (hoje: `ATENDIMENTO\n25`).
4. Rótulo visível completo — bug UI truncamento: `BUG-2026-002` (Avaliação do Conhecimento).
5. Fora de escopo de teste (não precisa priorizar): Aula Online, Chegando.

### WEB / Playwright (bloqueante 2026-08-09)

| Item | Estado |
|------|--------|
| Gestão → Comunicação → Comunicados → iframe Flutter | OK (smoke Playwright) |
| CanvasKit sem DOM/a11y (`body=""`, semantics≈1) | **Bloqueia** taps de menu |
| Espelho smoke menus (abrir → voltar) no WEB | **Pendente** semantics web + `home_card_*` |
| Alternativas frágil (coordenada / visual) | Não usar como regressão oficial |

Prioridade sugerida aos devs: **(A)** a11y/Semantics no web build → **(B)** completar `home_card_*` faltantes → **(C)** limpar badge do acessível + truncamento UI.

### P2
Dashboard info icons, aula online tiles, chat emoji/tema, portal pix cancelar, onboarding voltar, change pass, gallery/PDF shared helpers.

---

## Notas

1. Build amostra precisa ser **≥ 6.06.10** (`4a414067`) para os novos ids (APP).  
2. Após instalar APK novo no emulador, CTs de filtro/evento/logout devem usar `id:` sem coordenada na maioria dos casos.  
3. Pickers Android continuam por texto/DocumentsUI.  
4. Após build web com a11y: revalidar com `COMUNICADOS_REQUIRE_A11Y=1` no smoke Playwright.
