# Mapa global de seletores — polygonus-mobile → Maestro

> Gerado a partir do clone local `polygonus-mobile/` (branch `cq`).  
> Sem `Semantics(identifier)` no app: preferir **texto**, **tooltip** e **regex de acessibilidade**.  
> **IDs sugeridos (dev):** [SEMANTICS_SUGESTOES.md](./SEMANTICS_SUGESTOES.md)

## Legenda

| Col | Significado |
|-----|-------------|
| **Maestro** | Seletor sugerido no flow |
| **Estável?** | ✅ texto/tooltip fixo · ⚠️ ícone/coord/picker nativo · 🔄 vem do servidor |

---

## 1. Login / onboarding

| UI | Fonte | Maestro | Estável? |
|----|-------|---------|-----------|
| Botão entrar | `actionLogin` → upper | `"ENTRAR"` | ✅ |
| Campo login | `emailLabel` | `"E-mail ou Login"` | ✅ |
| Campo senha | `passwordLabel` | `"Senha"` | ✅ |
| Versão rodapé | `login_page.dart` | `Versão:.*` | ✅ |
| CTA pós-slides | recovery | `"FAZER LOGIN"` | ✅ |
| Slides onboarding | sem texto único | coord `90%, 93%` (5×) | ⚠️ |
| Dialog atenção | hardcoded | `"Atenção"` | ✅ |
| Trocar senha | `change_pass_page.dart` | `"Troque sua senha"`, `"Alterar Senha"` | ✅ |

---

## 2. Home / header / logout

| UI | Fonte | Maestro | Estável? |
|----|-------|---------|-----------|
| Menu nome (foto/texto) | header | tap `${NOME_PHJESUS}` ou foto | ✅ |
| Item Perfil | `aluno_com_avatar` / header | `"Perfil"` | ✅ |
| Item Tutorial | idem | `"Tutorial"` | ✅ |
| Item Sair | `actionLeave` | `"Sair"` | ✅ |
| Confirmar sair | `home_page.dart` L706 | `"Tem certeza que deseja sair do aplicativo?"` → `"Sair"` | ✅ |
| Cards do menu | servidor `nomMenuItem` | `.*MURAL.*`, `.*AGENDA.*`, etc. | 🔄 |
| Coach mark | tutorial | `"PULAR"` | ✅ |

---

## 3. Perfil / troca de função

| UI | Fonte | Maestro | Estável? |
|----|-------|---------|-----------|
| Título tela | `perfil_page.dart` | `"Perfil"` | ✅ |
| Label dropdown | `funcaoLabel` / `selectFuncaoTitle` | `"Perfil"` | ✅ |
| Valores PHJESUS (amostra) | API | `"COORDENADOR"`, `"PROFESSORES"`, … | 🔄 |
| Foto perfil | `profilePicTooltip` | tooltip da câmera | ⚠️ |
| Atualizar e-mail | hardcoded | `"Atualizar e-mail"` | ✅ |

Subflows: `shared/perfil/garantir_perfil_*.yaml`, `abrir_tela_perfil.yaml`, `selecionar_funcao.yaml`.

---

## 4. Mural (aba + lista)

| UI | Fonte | Maestro | Estável? |
|----|-------|---------|-----------|
| Abas bottom | `mural_page.dart` | `"Mural"`, `"Rotina"`, `"Diário"` | ✅ |
| Filtro sentido | `TipoSentidoDropdown` + `types.dart` | dropdown → `"Enviadas"`, `"Pendentes"`, … | ✅ |
| Selecionar aluno | tooltip | `"Selecionar aluno"` | ✅ |
| Filtrar / limpar | hardcoded | `"Filtrar"`, `"Limpar filtro"` | ✅ |
| FAB BoomMenu | `Icons.add` sem tooltip | coord `86%, 88%` | ⚠️ |
| Boom → Comunicado | `mural_widget.dart` | `.*Aviso.*` | ✅ |
| Boom → Evento | idem | `.*Evento.*` / `Atividade ou data` | ✅ |
| Bilhete escola | tooltip | `"Escrever bilhete para a escola"` | ✅ |
| Menu card ⋮ | `PopupMenuButton` + `more_vert` | `"Show menu"` + `below:` título | ⚠️ |
| Editar / Excluir | `mensagem_widget.dart` | `"Editar"`, `"Excluir"` | ✅ |
| Salvar / Compartilhar anexos | idem | `"Salvar anexos"`, `"Compartilhar anexos"` | ✅ |
| Confirmar exclusão | `polyConfirmDialog` | `"Sim"` / `"Não"` (`dialogYes` / `dialogNo`) | ✅ |

Subflows: `shared/mural/*`, `shared/nav/navegar_mural.yaml`.

---

## 5. Composer (mensagem / evento)

| UI | Fonte | Maestro | Estável? |
|----|-------|---------|-----------|
| Título novo | `nova_mensagem_page.dart` | `"Novo comunicado"` / `"Novo evento"` | ✅ |
| Título editar | idem | `"Editar comunicado"` / `"Editar evento"` | ✅ |
| Campo texto | `writeYourMessageHere` | `"Escreva seu texto aqui"` | ✅ |
| Para / Turma | labels | `"Para:"`, `"Turma"` | ✅ |
| Dialog turmas | MultiSelect | `"Procurar..."`, `"OK"`, `"Selecionar"`, `"Todos"` | ⚠️ |
| Galeria | `galleryButtonHint` | `"Adicionar imagem da galeria"` | ✅ |
| Câmera | `cameraButtonHint` | `"Adicionar foto"` → `"Foto"` / `"Vídeo"` | ⚠️ |
| Documento (clip) | `documentButtonHint` | `"Adicionar documento"` | ✅ |
| Submenu documento | hardcoded | `"Selecionar arquivo"` | ✅ |
| Enquete | `poolButtonHint` | `"Adicionar enquete ou aviso de recebimento"` | ✅ |
| Template enquete | `fNew`, `dialogYes`, … | `"Nova"`, `"Sim"`, `"Não"`, … | ✅ |
| Campos opção | `option` + `optional` | `"Opção 1"`, `"Opção 2 (Opcional)"` | ✅ |
| Marcador | hardcoded | `"Marcar comunicado"` | ✅ |
| Opções composer | `options` | tooltip `"Opções"` | ✅ |
| Enviar | hardcoded | `"Enviar comunicado"` | ✅ |

Subflows: `composer_novo_comunicado.yaml`, `enviar_comunicado.yaml`, `anexar_arquivo_por_nome.yaml`, `adicionar_foto_galeria.yaml`, `adicionar_enquete_nova.yaml`.

---

## 6. Pickers nativos Android

| Contexto | Maestro | Estável? |
|----------|---------|-----------|
| Galeria (thumbnail) | `pick_galeria_android.yaml` — IDs Media/DocumentsUI + `index: 0` | ⚠️ |
| PDF / arquivo | tap nome `${ANEXO_NOME}` + `"Abrir"` / `"Open"` | ⚠️ |
| Pastas comuns | `"Download"`, `"Downloads"`, `"Movies"`, `"Pictures"` | ⚠️ |

Pré-requisito: `addMedia` + `scripts/push-maestro-fixtures.ps1`.

---

## 7. Rotina (aba Mural)

| UI | Fonte | Maestro | Estável? |
|----|-------|---------|-----------|
| Aba | `mural_page.dart` | `"Rotina"` | ✅ |
| BoomMenu rotina | `shared/rotina/abrir_boom_menu_rotina.yaml` | validar no Studio | ⚠️ |
| Preencher / enviar | `rotina_preencher_enviar.yaml` | strings da rotina | ⚠️ |

Ver `flows/docs/rotina-manual.md`.

---

## 8. Diário de classe

| UI | Fonte | Maestro | Estável? |
|----|-------|---------|-----------|
| Aba | `mural_page.dart` | `"Diário"` | ✅ |
| Notas parciais | `lancaNotasTitle` | `"Notas parciais"` | ✅ |
| Conteúdo/frequência | `lancaFrequenciaTitle` | `"Conteúdo e frequência"` | ✅ |
| Tarefas | `lancaTarefaTitle` | `"Tarefas não executadas"` | ✅ |
| Incluir conteúdo | tooltip | `"Incluir novo conteúdo"` | ✅ |
| Inserir anexo | tooltip | `"Inserir Anexo"` | ✅ |
| Editar / Excluir tarefa | popup | `"Editar"`, `"Excluir"` | ✅ |

Módulo: `lib/diario_de_classe/` — **sem flows Maestro ainda**.

---

## 9. Agenda digital

| UI | Fonte | Maestro | Estável? |
|----|-------|---------|-----------|
| Card home | `digitalAgenda` | texto do card (servidor) | 🔄 |
| Bottom bar | `agenda_bottom_bar_widget.dart` | mesmos hints do composer (galeria/câmera/enquete) | ✅ |

Módulo: `lib/agenda/` — **sem flows Maestro ainda**.

---

## 10. Chat

| UI | Fonte | Maestro | Estável? |
|----|-------|---------|-----------|
| Buscar conversa | tooltip | `"Limpar"` | ✅ |
| Conversa — buscar | tooltip | `"Buscar nesta conversa"` | ✅ |
| Conversa — ações | tooltips | `"Copiar"`, `"Encaminhar"`, `"Excluir"`, `"Responder"`, `"Informações"` | ✅ |
| Grupo — integrantes | tooltip | `"Adicionar integrantes"` | ✅ |
| Cancelar resposta | tooltip | `"Cancelar resposta"` | ✅ |

Módulo: `lib/chat/` — flows draft em `flows/chat/` + `shared/chat/` (CTs CHAT-00…04).

---

## 11. Atendimento

| UI | Fonte | Maestro | Estável? |
|----|-------|---------|-----------|
| Encaminhar | tooltip | `"Encaminhar mensagem"` | ✅ |
| Excluir mensagem | popup | `"Excluir mensagem"` | ✅ |

Módulo: `lib/atendimento/` — **sem flows Maestro ainda**.

---

## 12. Portal (financeiro / conteúdo aluno)

| UI | Fonte | Maestro | Estável? |
|----|-------|---------|-----------|
| Cards | `portal*Title` | `"Conteúdo"`, `"Faltas"`, `"Tarefas do Dia"`, … | ✅ |
| Boleto PDF | tooltip | `"Abrir PDF"` | ✅ |
| Copiar barras/pix | tooltips | `"Copiar código de barras…"`, `"Copiar código pix…"` | ✅ |
| Pagamento | tooltip | `"Escolher sua opção de pagamento"` | ✅ |

Módulo: `lib/portal/` — **sem flows Maestro ainda**.

---

## 13. Ocorrência

| UI | Fonte | Maestro | Estável? |
|----|-------|---------|-----------|
| Registro | `registrarOcorrenciaLabel` | `"Registro pedagógico-disciplinar"` | ✅ |
| Descrição | `descricaoOcorrenciaLabel` | `"Descrição da ocorrência"` | ✅ |
| Sucesso | `ocorrenciaSalvaMessage` | texto parcial do toast | ✅ |
| Filtros | enums | `Enviadas`, `Pendentes`, … (similar Mural) | ✅ |

Módulo: `lib/ocorrencia/` — **sem flows Maestro ainda**.

---

## 14. Chegando / outros

| Módulo | lib/ | Status Maestro |
|--------|------|----------------|
| Chegando (veículos) | `chegando/` | Não mapeado |
| Calendário | `calendario/` | Não mapeado |
| Aula online | `aula_online/` | Não mapeado |
| Dashboard | `dashboard/` | Parcial (BoomMenu pattern) |

---

## 15. Dialogs globais (pt_BR.json)

| Chave | Valor | Uso |
|-------|-------|-----|
| `dialogOk` | OK | Confirmar exclusão, etc. |
| `dialogCancel` | CANCELAR | Cancelar ações |
| `dialogYes` / `dialogNo` | Sim / Não | Enquetes template, confirmações |
| `dialogSave` | Salvar | Forms |
| `pendingSaveTitle` | Gravação Pendente | Sair com rascunho |

---

## 16. Elementos só por coordenada (dívida técnica)

1. **FAB `+` do BoomMenu** (Mural, Rotina, …) — `Icons.add` sem Semantics  
2. **Onboarding slides** — primeira instalação  
3. **Pickers Android** — galeria / DocumentsUI  
4. **Overflow `more_vert`** — fallback `"Show menu"` + posição relativa  

---

## Manutenção

Ao homologar nova tela:

1. Abrir o `.dart` correspondente em `polygonus-mobile/lib/<modulo>/`
2. Anotar `Text('…')`, `tooltip:`, `Strings.s.trans('…')` → valor em `assets/lang/pt_BR.json`
3. Adicionar linha nesta tabela + subflow em `shared/<modulo>/` se automatizar
4. Marcar CT `STATUS: draft` até 2× PASS no emulador

Regenerar hints (PowerShell):

```powershell
rg "tooltip:" polygonus-mobile/lib -g "*.dart" | Sort-Object -Unique
```
