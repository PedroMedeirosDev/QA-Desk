# Semantics — app Polygonus (Maestro / Playwright / QA)

> **Sync 2026-08-10:** `polygonus-mobile` `cq` → `2125500d` (v**6.06.14**) — lote QA Semantics (Moacir).  
> Home: mapa `cod_menuitem` → `home_card_*` (não só mural/chat). Badge separado (`*_badge` + `excludeSemantics`).  
> Também: auth, mural (tabs/⋮/composer/evento), rotina, diário/notas, chat/atendimento, calendário, boleto, diálogos.  
> `SemanticsBinding.instance.ensureSemantics()` no `main.dart` — revalidar WEB.  
> **Flows:** smokes de regressão de menu usam `smoke_abrir_voltar_menu_id.yaml` + `CARD_ID` (build ≥ 6.06.14).

```dart
Semantics(
  identifier: 'modulo_contexto_acao',
  button: true,
  child: /* widget */,
)
```

Maestro: `tapOn: id: "modulo_contexto_acao"`  
Playwright (Flutter web + a11y): mesmo `identifier` / aria.

**Convenção:** `{modulo}_{tela_ou_contexto}_{acao}` · snake_case · ASCII.

**Padrão nos subflows QA:** `id:` primeiro → fallback texto/coordenada só se o id não existir.

**Não Semantics:** pickers nativos Android (galeria / DocumentsUI).

---

## Pedido restante aos desenvolvedores

### Ainda aberto

1. **WEB:** confirmar árvore a11y no iframe Flutter (amostra) — smoke Playwright `COMUNICADOS_REQUIRE_A11Y=1`.
2. Cardápio custom da escola: hoje cai em slug (`home_card_02_15` etc.) — ideal alias estável `home_card_cardapio` se o menu for padrão.
3. Rótulo visível completo nos tiles (ref. `BUG-2026-002` — Avaliação do Conhecimento truncada) — UI, não só semantics.

### Critério de aceite (QA)

- Maestro: `tapOn: id: "home_card_…"` nos menus in-scope (sem depender só de texto/badge).
- Playwright no Comunicados: localizar o mesmo tile e abrir → voltar.
- Fora de escopo de smoke de menu: Aula Online, Chegando (ids existem, mas não priorizar na regressão).

---

## Implementados no app (~130 estáveis + dinâmicos)

Fonte: tip `2125500d` em `polygonus-mobile` / `cq`.

### Home — `home_card_*` (por `cod_menuitem`)

Mapeamento em `home_page.dart` → `_semanticsIdCard`. Item fora do mapa → `home_card_<slug>` (ex. `02.15` → `home_card_02_15`).

| Código (ex.) | `identifier` |
|--------------|--------------|
| `00.02` | `home_card_mural` |
| `00.03` | `home_card_calendario` |
| `00.01` | `home_card_mensagens` |
| `00.04` / `00.05` | `home_card_aula_online` / `home_card_chegando` |
| `01.01`–`01.04`, `01.10` | `home_card_notas`, `conteudo_frequencia`, `tarefas`, `ocorrencias`, `meus_alunos` |
| `02.10` / `02.43` | `home_card_chat` |
| `02.08` / `02.42` | `home_card_atendimento` |
| Resp (mapa A/B) | `boletim`, `notas_parciais`, `mensalidade`, `conteudo_lecionado`, `frequencia_aluno`, `meus_documentos`, `horario`, `tarefas_casa`, `avaliacao_conhecimento`, `avaliacao_habilidades`, `notas_fiscais`, … |
| Badge | `${home_card_*}_badge` (nó aparte; card com `excludeSemantics`) |

### Auth / header / filtros / sair

| `identifier` | Onde |
|--------------|------|
| `auth_login_usuario` / `senha` / `entrar` / `toggle_senha` / `esqueci` / `fazer_login` | login |
| `auth_onboarding_avancar` | onboarding |
| `home_menu_usuario` / `perfil` / `tutorial` / `sair` | header |
| `home_dialog_sair_confirmar` / `cancelar` | diálogo sair |
| `home_coach_pular` | coachmark |
| `home_filtro_aplicar` / `limpar` | filtros |
| `home_selecionar_aluno_*` / `todos` | seletor aluno |
| `perfil_dropdown_funcao` | perfil |

### Mural / composer / evento / rotina

| Grupo | IDs |
|-------|-----|
| Boom / tabs | `mural_boom_*`, `mural_tab_mural` / `diario` / `rotina`, `mural_bilhete_fab`, `mural_filtro_sentido` |
| Card ⋮ | `mural_card_menu`, `editar`, `excluir`, `encaminhar`, `estatisticas`, `aprovar`, `rejeitar`, anexos, marcador… |
| Composer | `mural_composer_*` (texto, turma, alvo, filtro, limpar, marcador, opções, galeria, camera, enquete, anexo, enviar, preview) |
| Evento | `mural_evento_titulo`, `dia_inteiro`, `data_*`, `hora_*` |
| Rotina boom/composer | `rotina_boom_*`, `rotina_composer_galeria` / `camera` / `enquete` / `enviar` |
| Diálogos | `shared_dialog_sim` / `nao` |

⚠️ Emulador antigo: `mural_composer_texto` pode colidir com enquete — preferir hint se necessário.

### Chat / atendimento / diário / portal / calendário / ocorrência

| Grupo | IDs (amostra) |
|-------|----------------|
| Chat | `chat_lista_*`, `chat_conversa_*`, `chat_selecao_*`, `chat_input_*` |
| Atendimento | `atendimento_novo`, `atendimento_input_anexo` / `enviar` |
| Diário / notas / conteúdo | `diario_*`, `notas_*`, `conteudo_*` (+ dinâmicos `notas_aluno_*`, `${idPre}_turma`…) |
| Boleto | `portal_boleto_*` |
| Calendário | `calendario_menu`, `calendario_item_*` |
| Ocorrência | `ocorrencia_enviar` / `data` |

### Flows QA

| Flow | Estado |
|------|--------|
| `smoke/regressao_menus_*.yaml` | `CARD_ID` + `smoke_abrir_voltar_menu_id.yaml` |
| `navegar_home_card.yaml` | Preferência `CARD_ID` → fallback `CARD_HOME` |
| `navegar_mural` / `navegar_rotina` | `home_card_mural` + `mural_tab_*` |
| logout / perfil / coach PULAR | `home_menu_*`, `home_dialog_sair_*`, `home_coach_pular` |
| `tap_fazer_login` / `tap_dialog_sim` / `nao` | Helpers em `shared/helpers/` |
| Composer mural (enviar, galeria, enquete, anexo, alvo, turma, filtro, dia inteiro, data) | Já `id:` com fallback |
| `tap_acao_menu_card` / editar / excluir | `MENU_ACAO_ID` (`mural_card_editar` / `excluir`) |
| `escrever_evento` | `mural_evento_titulo` |
| `abrir_menu_compartilhar_anexos` | `mural_card_compartilhar_anexos` |
| `01_1_comunicado_filtro_limpar` | `mural_composer_filtro_limpar` |
| `escrever_comunicado` | Hint texto (id colide enquete no emulador) |
| Pickers Android / DocumentsUI | Texto nativo (sem Semantics) |
| Playwright WEB | Revalidar a11y após build amostra ≥ 6.06.14 |

---

## Home — regressão (ids canônicos)

| Perfil | Menu | `CARD_ID` | Nota |
|--------|------|-----------|------|
| Coord/Prof/Resp | Mural | `home_card_mural` | `navegar_mural.yaml` |
| Coord/Prof/Resp | Atendimento (novo) | `home_card_chat` | |
| Coord/Prof/Resp | Calendário | `home_card_calendario` | |
| Coord/Prof | Notas | `home_card_notas` | |
| Coord/Prof | Conteúdo e Frequência | `home_card_conteudo_frequencia` | |
| Coord/Prof | Tarefas | `home_card_tarefas` | |
| Coord/Prof | Ocorrências | `home_card_ocorrencias` | |
| Coord/Prof | Meus Alunos | `home_card_meus_alunos` | |
| Coord/Prof/Resp | Cardápio | texto ou `home_card_02_15` | Custom por escola |
| Resp | Boletim Online | `home_card_boletim` | |
| Resp | Notas Parciais | `home_card_notas_parciais` | |
| Resp | Mensalidade | `home_card_mensalidade` | Conferir mapa A/B (`02.03` vs `02.31`) |
| Resp | Conteúdo Lecionado | `home_card_conteudo_lecionado` | |
| Resp | Frequência do Aluno | `home_card_frequencia_aluno` | |
| Resp | Meus Documentos | `home_card_meus_documentos` | |
| Resp | Horário | `home_card_horario` | |
| Resp | Tarefas para Casa | `home_card_tarefas_casa` | |
| Resp | Avaliação do Conhecimento | `home_card_avaliacao_conhecimento` | + bug truncamento UI |
| Resp | Avaliação de Habilidades | `home_card_avaliacao_habilidades` | |
| Resp | Notas Fiscais | `home_card_notas_fiscais` | |

---

## WEB / Playwright

| Item | Estado |
|------|--------|
| Gestão → Comunicação → Comunicados → iframe | Smoke abertura OK |
| `ensureSemantics()` no APP | Presente no tip — **reprobe** amostra |
| Espelho smoke menus no WEB | Pendente validação |
| Coordenada / visual | Não usar como regressão oficial |

---

## Notas

1. Build amostra / emulador: **≥ 6.06.14** (`2125500d`) para este inventário.
2. Após instalar APK novo: rodar `regressao_menus_{coordenador,professor,responsavel}.yaml`.
3. Pickers Android continuam por texto/DocumentsUI.
4. Hierarchy dump se algum tile não aparecer: confirmar `cod_menuitem` da escola (mapa A vs B no responsável).
