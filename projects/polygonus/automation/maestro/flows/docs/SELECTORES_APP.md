# Seletores Mural — mapeamento código → Maestro



Clone: `polygonus-mobile/` (branch `cq`) · somente leitura para QA.



## `id:` no Maestro (build amostra ≥ `af5de606`)



Semantics implementados — flows usam **`tapOn: id:` primeiro**, fallback em texto/coordenada só se o id não aparecer.



| Seletor | Quando usar |

|---------|-------------|

| **`id:`** | Preferencial — ver [SEMANTICS_SUGESTOES.md](./SEMANTICS_SUGESTOES.md) |

| **Texto / regex** | Itens de menu, picker Android, diálogos sem semantics |

| **Tooltip / hint** | `Escreva seu texto aqui`, `Enviar comunicado` (fallback) |

| **`Show menu`** | Fallback do ⋮ quando `mural_card_menu` falha |



Exceção documentada: **`mural_composer_texto`** — hint `Escreva seu texto aqui` em `escrever_comunicado.yaml` (tap no id colide com enquete no emulador).



---



## Filtros (CT 02, 03, 09, 10)



| O que parece na UI | Código | Maestro |

|--------------------|--------|---------|

| Dropdown abaixo do nome | `TipoSentidoDropdown` | **`id: mural_filtro_sentido`** |

| Labels | `types.dart` | `Recebidas`, `Enviadas`, `Pendentes`, … |

| Legado (pré-semantics) | A11y composto | `"Pedro Jesus\nRecebidas"` — **não usar** |



Subflows: `selecionar_filtro_sentido.yaml` → `filtrar_enviadas.yaml` / `filtrar_recebidas.yaml`.



```yaml

- runFlow:

    file: selecionar_filtro_sentido.yaml

    env:

      FILTRO: Enviadas

      FILTRO_TAP: "Enviadas|Enviados"

```



---



## Menu ⋮ (editar / excluir)



| Código | `mensagem_widget.dart` — `PopupMenuButton` |

| Maestro | **`id: mural_card_menu`** + `abrir_menu_tres_pontos.yaml` |

| Itens | `Editar`, `Excluir`, `Salvar anexos`, … (texto estável) |



---



## BoomMenu (novo comunicado / evento)



| Item | Maestro |

|------|---------|

| FAB | `id: mural_boom_fab` |

| Comunicado | `id: mural_boom_comunicado` |

| Evento | `id: mural_boom_evento` |



Subflows: `tap_boom_fab.yaml`, `tap_boom_comunicado.yaml`, `tap_boom_evento.yaml`.



---



## Composer



| Ação | Semantics | Fallback texto |

|------|-----------|----------------|

| Turma | `mural_composer_turma` | `Turma` |

| Alvo (Para:) | `mural_composer_alvo` *(sugerido)* | regex `Alunos` → `Todos` em `selecionar_alvo_todos.yaml` |

| Galeria | `mural_composer_galeria` | DocumentsUI: chips `Images`/`Recent` + `Foto_1.*` (não esperar `Photos\|Select` na abertura) |

| Clipe (menu) | `mural_composer_anexo` | após tap: `Arquivo` \| `Boleto` \| `Correspondência` |

| Arquivo (PDF/vídeo) | texto `Selecionar arquivo` | `anexar_arquivo_por_nome.yaml` |

| Funil composer | app bar (direita) | `abrir_filtro_extras_composer.yaml` → `Inadimplentes` |

| Período | dialog após Inadimplentes | `Mes corrente` (CT-11) ou data → competência `01` (CT-14) |

| Boleto | clipe → `Boleto` | `anexar_boleto.yaml` |

| Correspondência | `Correspondência` → `Declaração de IR` → Ok | `anexar_correspondencia_declaracao_ir.yaml` |

| Enquete | `mural_composer_enquete` | tooltip enquete |

| Enviar | `mural_composer_enviar` | tooltip `Enviar comunicado` — **não** usar como tap (não é nó estável); só o id |

| Texto | *(evitar id)* | `Escreva seu texto aqui` |



Mapa completo: [MAPA_SELETORES_APP.md](./MAPA_SELETORES_APP.md).  

Lista para o dev mobile: [SEMANTICS_SUGESTOES.md](./SEMANTICS_SUGESTOES.md)



---



## Referência rápida de arquivos



```

polygonus-mobile/lib/shared/basis/types.dart          — labels dos filtros

polygonus-mobile/lib/shared/widget/aluno_com_avatar_widget.dart — dropdown

polygonus-mobile/lib/mural/widget/mural_widget.dart   — BoomMenu

polygonus-mobile/lib/mensagem/widget/mensagem_widget.dart — menu ⋮

```

