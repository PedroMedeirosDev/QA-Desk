# Semantics — app Polygonus (Maestro)



> **Sync 2026-07-15:** `polygonus-mobile` `cq` → `af5de606` — **implementados**.  

> **Auditoria 2026-07-15:** flows revisados — `id:` primeiro, fallback legado só onde necessário.



```dart

Semantics(identifier: 'nome_aqui', button: true, child: /* widget */)

```



Maestro: `tapOn: id: "nome_aqui"`



**Padrão nos subflows:**

1. `extendedWaitUntil` / `tapOn` com `id`

2. Fallback texto/coordenada **só** se o id não resolver

3. Sem duplo tap (id + fallback no mesmo passo sem condição)



**ID do comunicado:** badge `ID 123456` no card (sideload) — validação primária por ID (`copyTextFrom` → `output.idComunicado`); texto só como âncora opcional. Ver `capturar_id_comunicado_lista.yaml`, `confirmar_comunicado_enviado.yaml`.



**Exceção:** `mural_composer_texto` — usar hint `Escreva seu texto aqui` (`escrever_comunicado.yaml`).



---



## Mural



| `identifier` | Onde | Flow(s) |

|--------------|------|---------|

| `mural_boom_fab` | FAB `+` | `tap_boom_fab.yaml` |

| `mural_boom_comunicado` | Item Comunicado | `tap_boom_comunicado.yaml` |

| `mural_boom_evento` | Item Evento | `tap_boom_evento.yaml` |

| `mural_filtro_sentido` | Dropdown filtros | `selecionar_filtro_sentido.yaml`, `filtrar_*.yaml`, `verificar_perfil_professor.yaml` |

| `mural_card_menu` | ⋮ do card | `abrir_menu_tres_pontos.yaml`, `abrir_menu_primeiro_comunicado.yaml` |

| `mural_composer_galeria` | Ícone galeria | `adicionar_foto_galeria.yaml` |

| `mural_composer_enquete` | Ícone enquete | `adicionar_enquete_nova.yaml` |

| `mural_composer_anexo` | Clip PDF | `anexar_arquivo_por_nome.yaml` |

| `mural_composer_enviar` | Enviar | `enviar_comunicado.yaml` |

| `mural_composer_texto` | Campo texto | ⚠️ hint em `escrever_comunicado.yaml` |

| `mural_composer_turma` | Seletor Turma | `selecionar_turmas_comunicado.yaml` |

| `mural_composer_alvo` | Chip alvo ao lado de `Para:` (Alunos/Todos/…) | **Sugerido** — hoje `selecionar_alvo_todos.yaml` usa regex `Alunos` |

| *(texto)* `ID [0-9]+` | Badge idMensagem | `assert_comunicado_por_id.yaml` (prova canônica); não confiar em `copyTextFrom` |



---



## Login, home, perfil



| `identifier` | Onde | Flow(s) |

|--------------|------|---------|

| `auth_login_entrar` | ENTRAR | `login_as.yaml` |

| `auth_login_usuario` | E-mail ou Login | `login_as.yaml` |

| `auth_login_senha` | Senha | `login_as.yaml` |

| `home_menu_usuario` | Nome/foto (header) | `abrir_tela_perfil.yaml` |

| `home_card_mural` | Card MURAL na home | `navegar_mural.yaml`, `navegar_home_card.yaml` |

| `perfil_dropdown_funcao` | Dropdown perfil | `selecionar_funcao.yaml` |

| `auth_onboarding_avancar` | Slides onboarding | `ensure_login_screen.yaml`, `smoke/launch.yaml` |



---



## Rotina



| `identifier` | Onde | Flow(s) |

|--------------|------|---------|

| `rotina_boom_fab` | FAB `+` aba Rotina | `rotina/abrir_boom_menu_rotina.yaml` |



---



## Ainda só texto (sem semantics no app)



| UI | Flow |

|----|------|

| Menu popup Editar/Excluir | `editar_comunicado_lista.yaml`, `excluir_comunicado_lista.yaml` |

| Picker galeria/DocumentsUI | `pick_galeria_android.yaml`, `anexar_arquivo_por_nome.yaml` |

| Diálogo exclusão Sim/Não | `confirmar_exclusao_comunicado.yaml` |

| Coach marks PULAR | vários `navegar_*.yaml`, `resume_*.yaml` |

| Logout Sair | `logout.yaml` |

| Toggle Dia inteiro (evento) | `marcar_dia_inteiro.yaml` — preferir `Semantics(identifier: mural_evento_dia_inteiro)` no Switch |


