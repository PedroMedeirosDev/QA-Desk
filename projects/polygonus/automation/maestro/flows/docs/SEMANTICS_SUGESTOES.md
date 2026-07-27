# Semantics — app Polygonus (Maestro / QA)

> **Sync 2026-07-20:** `polygonus-mobile` `cq` → `4a414067` (v6.06.10) — **P0 implementados**.  
> Flows QA já preferem `id:` nos subflows de funil, alvo, dia inteiro, data evento, PULAR e Sair.

```dart
Semantics(
  identifier: 'modulo_contexto_acao',
  button: true,
  child: /* widget */,
)
```

Maestro: `tapOn: id: "modulo_contexto_acao"`

**Convenção:** `{modulo}_{tela_ou_contexto}_{acao}` · snake_case · ASCII.

**Padrão nos subflows QA:** `id:` primeiro → fallback texto/coordenada só se o id não existir.

**Não Semantics:** pickers nativos Android (galeria / DocumentsUI).

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
| `home_card_*` (demais `codMenuItem`) | Estender padrão `home_card_mural` |
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
| `atendimento_*` | Fale conosco |
| `portal_boleto_*` | Boleto |
| `ocorrencia_enviar` / `data` | Ocorrência |
| `calendario_menu` | Calendário |
| Auth: `toggle_senha` / `esqueci` / `FAZER LOGIN` | Login |

### P2
Dashboard info icons, aula online tiles, chat emoji/tema, portal pix cancelar, onboarding voltar, change pass, gallery/PDF shared helpers.

---

## Notas

1. Build amostra precisa ser **≥ 6.06.10** (`4a414067`) para os novos ids.  
2. Após instalar APK novo no emulador, CTs de filtro/evento/logout devem usar `id:` sem coordenada na maioria dos casos.  
3. Pickers Android continuam por texto/DocumentsUI.
