# Semantics identifiers — spec de implementação

Arquivo único para o agente de desenvolvimento. Um PR. Entregar **todos** os itens. Não fatiar.

**Plataformas:** APP Android (`br.com.polygonus.mobile.amostra`) **e** APP WEB (Flutter, iframe Gestão). O mesmo `identifier` nas duas.

**Repo:** `polygonus-mobile`. `SemanticsBinding.instance.ensureSemantics()` já está no `main.dart` — manter.

---

## Contrato

```dart
Semantics(
  identifier: 'modulo_contexto_acao',
  button: true, // ou textField / excluído se for só label
  child: /* o widget que recebe o tap / o TextField */,
)
```

- `identifier` no **mesmo** widget clicável/editável. Não no container pai (card, row, stack).
- WEB: o nó com `flt-semantics-identifier` deve ter o bounding box do controle visível, não do card inteiro.
- Reutilizar identifier já existente neste arquivo. Não criar sinônimo (`mural_card_kebab`, etc.).
- Padrão de nome: `snake_case`, prefixo do módulo.
- Se o widget já tem `identifier` no mobile e falta no WEB: **expor o mesmo**, não criar outro.

**Aceite:** em cada id da lista, `tapOn: id:` (Maestro) e `[flt-semantics-identifier="<id>"]` (Playwright) funcionam **sem** fallback de texto, tooltip ou coordenada.

**QA (Maestro/Playwright):** automatizar só por `identifier`. Se o passo falhar: dump a11y, ver se o id falta, está no container pai, ou o hit-target não é o controle. Anotar **neste arquivo**. Proibido `point: "N%,M%"` / toque por porcentagem da tela.

---

## Fora de escopo

Não implementar:

- Picker nativo Android/iOS (galeria, DocumentsUI, câmera do SO).
- Share sheet do SO após o tap em Compartilhar. O **botão Flutter** Compartilhar está no escopo.
- Badge `ID nnn` de comunicado (já no content-desc de `mural_card_menu`).
- Alterar `home_card_*` já mapeados em `home_page.dart` → `_semanticsIdCard`.
- Bug de produto (PDF download, toast, truncamento de label).

---

## Já existe — não alterar (exceto hit-target listado em Implementar)

Home: `home_card_mural`, `home_card_calendario`, `home_card_notas`, `home_card_notas_parciais`, `home_card_mensalidade`, `home_card_conteudo_frequencia`, `home_card_conteudo_lecionado`, `home_card_chat`, `home_card_atendimento`, `home_card_boletim`, `home_card_avaliacao_conhecimento`, `home_card_avaliacao_habilidades`, demais cards do mapa.

Mural: `mural_boom_*`, `mural_tab_*`, `mural_filtro_sentido`, `mural_composer_*`, `mural_card_menu` (id existe; hit-target WEB está errado — item 6).

Rotina: `rotina_boom_fab`, `rotina_boom_*` (tipos), `rotina_filtro_sentido`, `rotina_lista_vazia`, `rotina_composer_turma|_aluno|_termo|_ok|_cancelar|_limpar|_enviar|_galeria|_camera|_enquete`, `rotina_composer_opcao_<slug>`. Presentes em Alimentação / Soneca / Banheiro / Humor / Vestuário. **Ausentes no Bilhete / Momentos** (itens 1–2).

Chat (`lib/chat`, menu Fale Conosco / Atendimento novo = `home_card_chat`): `chat_input_texto`, `chat_input_enviar_ou_mic`, `chat_input_anexo`, `chat_input_camera`, `chat_anexo_documento`, `chat_anexo_galeria`, `chat_anexo_camera` (`!kIsWeb` no sheet mobile), `chat_lista_item_<i>`, `chat_lista_fab_nova`. WEB: texto + anexo PDF/foto/vídeo ok (filechooser; item 4). Áudio ainda falta (item 19).

Filtro: aba Comunicados → `mural_filtro_sentido`. Aba Rotina → `rotina_filtro_sentido`. Não misturar.

---

## Mapa QA — CTs vs semantics

Inventário dos testes Desk (Maestro APP + Playwright WEB). Cada linha “texto/%” é dívida — não é fallback autorizado. Fonte: YAML em `flows/` e helpers `playwright/shared/*-composer.ts` (ago/2026).

Legenda: **ok** = toque no `identifier` do controle · **hit** = id existe, toque/IME cai noutro nó · **falta** = teste usa texto, `below`/`rightOf` ou `point: N%`.

Picker nativo (galeria, DocumentsUI, câmera, share sheet) = fora de escopo.

### Transversal (todo CT APP autenticado)

| Controle | Status | CTs | Evidência |
|----------|--------|-----|-----------|
| `auth_login_usuario` / `_senha` / `_entrar` | ok (texto se id sumir) | login | `login_as.yaml` |
| `home_menu_usuario` / `home_menu_perfil` | hit / % | perfil, setup | `abrir_tela_perfil.yaml`: `10%,10%` e `28%,10%` se o id não aparecer |
| `home_card_mural` | ok | Mural, Rotina | |
| `mural_boom_fab` | hit | envio Mural | id optional; menu não abre → `86%,88%` (`tap_boom_fab.yaml`) |
| `rotina_boom_fab` | hit | Rotina | APP-02 no id; menu não abre → `90%,86%` (`abrir_boom_menu_rotina.yaml`) |
| `mural_tab_rotina` / `mural_tab_mural` | ok | Rotina, filtro | |
| Coachmark `PULAR` | texto | setup | `home_coach_pular` quando existe; senão texto |
| `auth_onboarding_avancar` | **falta no FAB** | 1ª instalação | dump QaDesk_Probe 2026-08-15: seta `android.widget.Button` `[915,2172][1041,2298]` sem `resource-id` e sem content-desc. Item 21. |

### Rotina

| CT | Maestro | Playwright | Falta / hit |
|----|---------|------------|-------------|
| ROTINA-01 Alimentação | `01_2_1_rotina_alimentacao.yaml` | `rotina/01-rotina-enviar.spec.ts` | APP: `rotina_composer_turma\|aluno\|ok\|opcao_*\|enviar` ok. WEB: picker sem id no tile (item 9). Fallback texto `^Turma$` / `Enviar` se o dump não tiver id. |
| ROTINA-02 Soneca | `01_2_1_rotina_soneca.yaml` | idem | igual 01 |
| ROTINA-03 Banheiro | `01_2_1_rotina_banheiro.yaml` | idem | igual 01 |
| ROTINA-04 Bilhete | `01_2_4_bilhete_enviar.yaml` | `enviarBilheteRotina` | **falta** `rotina_composer_texto` no TextField (item 1). YAML: `point: 50%,52%`. WEB: label + mouse %. |
| ROTINA-05 Humor | `01_2_1_rotina_humor.yaml` | idem | chips `rotina_composer_opcao_*` ok APP; WEB fallback label |
| ROTINA-06 Vestuário | `01_2_1_rotina_vestuario.yaml` | idem | igual 05 |
| ROTINA-07 Momentos | `01_2_3_momentos_enviar.yaml` | `enviarMomentosRotina` | **falta** turma/aluno/termo no composer Momentos WEB (item 2). `rotina_composer_galeria` + picker nativo. |
| ROTINA-08 Ocorrência | `01_2_2_ocorrencia_enviar.yaml` **draft** | `rotina/08-ocorrencia-enviar.spec.ts` **ready** | ids no código; **hit** `ocorrencia_tipo` (abre Disciplina) e **hit** `ocorrencia_texto` (IME / Enviar disabled). `*_item` ausente no Android. Item 3. |

WEB 01–07: `rotina-composer.ts` tenta id e cai em `tapListLabel` / `mouse.click` (FAB `0.9×0.86`). Isso não é aceite.

### Notas / Conteúdo e Frequência (regressão lançamento)

| CT | Maestro | Playwright | Status |
|----|---------|------------|--------|
| NOTAS-01 História AV1 | `flows/diario/01_notas_lancar.yaml` draft | `diario/01-notas-lancar.spec.ts` | Ids no app (item 11). Escopo: M3A26 / História / Ana / AV1; nota 0–10 por run. |
| DIARIO-01 falta+conteúdo+anexos | `flows/diario/02_conteudo_frequencia.yaml` draft | `diario/02-conteudo-frequencia.spec.ts` | Ids no app (item 12). Textos `(Web)`/`(Mobile)`; PDF+vídeo em `maestro/fixtures`. Gap possível: item da `frequencia_aula`. |

### Mural

| CT | Falta / hit |
|----|-------------|
| Enviar comunicado (`01_1_comunicado_enviar`, spec 01) | `mural_composer_texto`: id existe; tap pega **enquete** → hint + `50%,45%` (item 18). Boom: fallback texto `interesse geral`. |
| Editar / Excluir (YAML + specs 02–03) | `mural_card_menu` hit WEB = card (item 6). Faltam `mural_card_editar` / `_excluir` (item 7). APP: `below:` no ⋮. |
| Enquete (spec 04) | opções por texto (`Nova`, Opção 1/2) — sem id de tile. |
| Anexos foto/PDF/vídeo | `mural_composer_anexo` ok; menu WEB Arquivo/Boleto/Correspondência **falta** (item 5). Picker SO fora. |
| Evento + Dia inteiro (spec 08) | `mural_evento_dia_inteiro` no APP ≥ 6.06.10; senão `rightOf`+`below` (nunca `rightOf` sozinho = olho). Confirmar WEB. |
| Filtro Enviadas (spec 09) | `mural_filtro_sentido` hit WEB (item 8). APP: `point: 43%,14/19/24%` nos itens do menu (dívida — preferir `*_item`). |
| Filtros extras / boleto / IR | Funil `mural_composer_filtro` ok; sem id → `97%,7%`. Competência: `35%,42%`. Itens do funil por **texto**. Alvo: `mural_composer_alvo` → checkbox **Todos** (não a 1ª = Alunos). |
| Compartilhar anexos | `below:` relativo ao card. |

### Chat (`home_card_chat`)

| CT | Status | Falta / hit |
|----|--------|-------------|
| CHAT-00 smoke | ready | `home_card_chat` ok |
| CHAT-01 texto | ready WEB | `chat_input_texto` + `chat_input_enviar_ou_mic` |
| CHAT-02 áudio | draft | **falta** `chat_input_audio` (item 19). Gravação nativa fora. |
| CHAT-04 PDF | ready WEB | `chat_input_anexo` → `chat_anexo_documento` + filechooser (item 4 atualizado). |
| CHAT-05 foto | ready WEB | `chat_anexo_galeria` + filechooser. |
| CHAT-06 vídeo | ready WEB | mesmo `chat_anexo_galeria` + `.mp4`. |
| Responder / encaminhar / reagir / grupo | planejado | item 17 |

### Smoke menus (abrir/voltar)

Cards `home_card_*` ok. **Exceção:** Cardápio (`SMOKE-CARDAPIO`) por texto `CARDÁPIO` — **falta** `home_card_cardapio`. Interiores dos módulos (Notas, Diário, Mensalidade, Avaliações…) = itens 10–16, ainda não além do smoke.

### Fora deste arquivo

- Ficha aluno (`playwright/academico/ui/*`) = Gestão **React**, não Flutter `Semantics`.
- `flows/debug/*` = probe, não CT.

---

## Implementar

### 1. Bilhete — `rotina_composer_*` no mesmo widget das outras rotinas

**Onde:** APP + WEB. Composer Bilhete hoje só expõe `galeria`/`camera`/`enviar`.

**IDs (já canônicos):**

| identifier | Widget |
|------------|--------|
| `rotina_composer_turma` | controle que abre o picker Turma |
| `rotina_composer_aluno` | controle que abre o picker Aluno |
| `rotina_composer_termo` | controle que abre o picker Termo |
| `rotina_composer_texto` | o **TextField** do corpo. Não usar o placeholder `"Bilhete"` como id (colide com o título da tela). |

### 2. Momentos — mesmos IDs de turma/aluno/termo

**Onde:** WEB (e APP se o composer for o mesmo). Hoje só `galeria` + `enviar`.

`rotina_composer_turma`, `rotina_composer_aluno`, `rotina_composer_termo` nos mesmos widgets do item 1.

### 3. Ocorrência — prefixo `ocorrencia_*` (ids já existem; hit-target APP quebrado)

**Onde:** APP + WEB. Tela nova: `lib/ocorrencias/pages/ocorrencia_lancamento_page.dart`.

Os identifiers **já estão no código**. O dump Android (Maestro hierarchy, emulador amostra, turma Maternal II selecionada) mostra o id — mas **não no widget que recebe toque/IME**. Isso viola o contrato acima (mesma armadilha APP-02 / comentário em `ListenableDropdown._comSemantics`).

CT Maestro `flows/rotina/01_2_2_ocorrencia_enviar.yaml` fica **draft** até o aceite abaixo. Não usar fallback de texto, `point:` ou `below:`.

IDs canônicos (manter; não criar sinônimo):

| identifier | Widget |
|------------|--------|
| `ocorrencia_turma` | picker turma |
| `ocorrencia_disciplina` | picker disciplina (**opcional**; some se a turma não tiver) |
| `ocorrencia_tipo` | picker Tipo termo |
| `ocorrencia_termo` | picker Termo (depois do tipo) |
| `ocorrencia_aluno` | picker aluno |
| `ocorrencia_texto` | **o TextField** da descrição |
| `ocorrencia_enviar` | FAB Enviar |
| `ocorrencia_data` | date trigger (já ok) |
| `ocorrencia_anexo` | botão anexar |
| `ocorrencia_ok` / `_cancelar` / `_limpar` | botões do diálogo (prefixo `ocorrencia`) |
| `ocorrencia_tipo_item` / `_termo_item` / `_aluno_item` | tile do picker; `label` a11y = texto da opção |

#### 3a. `ocorrencia_texto` — bloqueia o CT (IME)

Hoje: `Semantics(identifier: 'ocorrencia_texto', textField: true, child: TextField(...))`.

Dump Android:

| nó | resource-id | class | clickable | important-for-accessibility | text |
|----|-------------|-------|-----------|------------------------------|------|
| pai | `ocorrencia_texto` | EditText | **false** | **false** | vazio |
| filho | *(nenhum)* | EditText | **true** | true | hint `Descrição da ocorrência` |

Efeito: `tapOn: id: ocorrencia_texto` não foca o IME; `inputText` estoura DEADLINE 120s; `pasteText` não dispara `onChanged` → `_ctrl.texto` vazio → FAB Enviar **disabled** (`podeEnviar` exige texto).

**Pedido:** `identifier: 'ocorrencia_texto'` no **TextField** (sem Semantics pai extra). Nó Android: `clickable=true`, `important-for-accessibility=true`, foca teclado.

**Aceite:** `tapOn: id: ocorrencia_texto` + `inputText: "x"` grava no campo e habilita Enviar.

#### 3b. `ocorrencia_tipo` vs `ocorrencia_disciplina` — toque cai no campo de cima

Depois da turma, o app **insere** Disciplina (opcional) entre Turma e Tipo termo. Os dois ids existem e, em dump estático, os bounds são vizinhos sem overlap. Mesmo assim o **primeiro** `tapOn: id: ocorrencia_tipo` abre o picker de Disciplina (`Faltas`, `Matemática`, `Campos de Experiência`, `Língua Portuguesa`), não Tipo termo (`Disciplinares`, `Pedagógicas`).

Dump (após turma): ambos `android.view.View`, **clickable=false**. Turma no mesmo padrão *às vezes* funciona; Tipo termo não.

**Pedido:** identifier de cada `ListenableDropdown` no **TextField que recebe o onTap** (já é a intenção de `_comSemantics`); nó Android `clickable=true`; bounds de `ocorrencia_tipo` não podem coincidir nem “roubar” o hit de `ocorrencia_disciplina` depois do insert.

**Aceite:** um único `tapOn: id: ocorrencia_tipo` (sem Cancelar/retry) abre a lista **Disciplinares / Pedagógicas / Teste interno**. Nunca Faltas/Matemática.

**WEB (Playwright CT-ROTINA-08, 6.06.32):** após turma Maternal II, `ocorrencia_tipo` / texto «Tipo termo» não preenche — tela fica com Tipo termo vazio e `ocorrencia_termo` **não aparece** (timeout do CT). Mesmo gap de hit: toque cai em Disciplina (opcional) ou não abre o picker certo. Confirmar no WEB o mesmo aceite do APP.

#### 3c. Itens do picker Tipo termo

`ocorrencia_tipo_item` está previsto no `ListenableDropdown` (`<id>_item`). No Android o tile **não entra na árvore** (tap por id WARNED; o texto `Disciplinares` às vezes funciona). WEB já expõe o id (Playwright passou).

**Pedido:** cada opção do diálogo com `identifier: ocorrencia_tipo_item` (e `ocorrencia_termo_item`) + `label` = nome da opção, nó clicável.

**Aceite:** `tapOn: id: ocorrencia_tipo_item` (ou texto da opção via a11y do mesmo nó) seleciona o tipo.


### 4. Chat anexo — WEB

IDs canônicos (já no mobile; **não** criar `chat_web_*`):

| identifier | Uso |
|------------|-----|
| `chat_input_anexo` | botão que abre o sheet |
| `chat_anexo_documento` | PDF / arquivo → filechooser WEB |
| `chat_anexo_galeria` | foto/vídeo → filechooser WEB |
| `chat_anexo_camera` | câmera (APP; WEB pode omitir) |

**Status amostra 6.06.32 (Playwright CT-CHAT-04/05/06, 2026-08-14):**

- Na **thread**, `chat_input_anexo` **existe** e abre o sheet.
- Após abrir o sheet, `chat_anexo_documento` e `chat_anexo_galeria` respondem ao tap e disparam **filechooser** (PDF / Foto_1 / Video_teste ok).
- `chat_anexo_*` **não** aparecem no DOM antes do sheet — dump “FALTA” só vale **depois** de abrir o menu.
- Dívida restante: `chat_anexo_camera` no WEB (se produto quiser); áudio = item 19.

Aceite: `tap` em `chat_input_anexo` → item do sheet visível com id → filechooser / picker nativo.

### 5. Clipe Mural — itens do menu (WEB)

Botão clipe no mobile: `mural_composer_anexo` (manter). Menu WEB hoje: 0 identifiers; labels Arquivo / Boleto / Correspondência.

| identifier | Item |
|------------|------|
| `mural_composer_anexo_arquivo` | Arquivo |
| `mural_composer_anexo_boleto` | Boleto |
| `mural_composer_anexo_correspondencia` | Correspondência |

Identifier no `PopupMenuItem` / list tile, não no overlay inteiro.

### 6. `mural_card_menu` — hit-target WEB

**Não é id novo.** Fonte: `lib/mensagem/widget/mensagem_widget.dart` (`PopupMenuButton`).

Hoje no WEB o nó `mural_card_menu` ≈ card (~1000×153). O ⋮ real é botão 40×40 com label Material `Show menu`, sem `flt-semantics-identifier`.

Mover `Semantics(identifier: 'mural_card_menu')` para o **PopupMenuButton / ícone ⋮**. Não fundir no container do card.

Aceite WEB: bounding box do id ≈ 40×40 (ícone), não a largura do card. Tap no id abre o popup.

### 7. Popup Editar / Excluir

Nos **itens** do popup (APP + WEB):

| identifier | Item |
|------------|------|
| `mural_card_editar` | Editar |
| `mural_card_excluir` | Excluir |

Não no `mural_card_menu`.

### 8. Filtro sentido — hit-target WEB (+ itens do menu)

`mural_filtro_sentido` / `rotina_filtro_sentido` (conforme a aba) no **chip** compacto Recebidas/Enviadas, não no ancestral largo.

**Itens do dropdown** (APP + WEB ≥ 6.06): id `mural_filtro_sentido_item` / `rotina_filtro_sentido_item`.

Achados WEB (amostra 6.06.32, Playwright FILTRO / spec 09):

| Problema | Detalhe |
|----------|---------|
| `el.click()` / `locator.click` no Flutter WEB | Costuma **não** acionar o menu nem o item — usar clique por mouse no centro do nó compacto. |
| Texto / aria do `*_item` | Vem duplicado: `Enviadas Enviadas` (label+value). Matcher `^Enviadas$` falha; aceitar `^Enviadas(\b\|\s\|$)` ou 1ª palavra. |
| Hit do `*_item` | Nó com id ≈ 72×21, `clickable` fraco; a **linha** do popup (~180×48) é o hit confiável. Preferir Semantics no tile clicável inteiro. |
| APP (dívida) | Ainda usa `point: 43%,14/19/24%` porque id+texto do item não batem no Maestro — mesmo gap de hit/label. |

Aceite: tap no chip abre o menu; tap no `*_item` (ou tile com esse id) troca o chip; a11y do item = rótulo único (`Enviadas`, não `Enviadas\nEnviadas` / `Enviadas Enviadas`).

**Dialog «Atenção!» (alvo Todos / administrativo):** texto *“A seleção de turma não tem efeito sobre destinatários do administrativo…”* + link **Fechar**. No WEB, `locator.click` no Fechar falha — Semantics `shared_dialog_fechar` (ou id estável no botão) com hit compacto ajudaria APP e WEB.

### 9. Picker aluno — tile

Overlay já tem `rotina_composer_ok` e `rotina_composer_cancelar`. O card do aluno é canvas sem aria.

| identifier | Widget |
|------------|--------|
| `rotina_composer_aluno_item` | tile clicável. `label` / `value` a11y = nome do aluno |

APP + WEB. Mesmo padrão em qualquer picker de aluno que for canvas (Notas, Diário, Boletins): ver itens 11–16.

---

### 10. Mensalidades (responsável) — `home_card_mensalidade` já existe

Prefixo `mensalidade_*`. Controles internos:

| identifier | Widget |
|------------|--------|
| `mensalidade_pdf_abrir` | abrir/visualizar PDF |
| `mensalidade_compartilhar` | botão Flutter Compartilhar (não o share sheet nativo) |
| `mensalidade_copiar_codigo_barras` | copiar código de barras |

### 11. Notas — lançamento (professor) — `home_card_notas` já existe

**Já no código** (`lib/diario_de_classe/page/lanca_nota_page.dart` + `aluno_diario_list_view.dart`). CT WEB: `playwright/diario/01-notas-lancar.spec.ts`. Maestro: `flows/diario/01_notas_lancar.yaml` (draft).

| identifier | Widget |
|------------|--------|
| `notas_turma` / `notas_turma_item` | dropdown turma; item label = nome |
| `notas_disciplina` / `notas_disciplina_item` | dropdown disciplina |
| `notas_etapa` / `notas_etapa_item` | subperíodo |
| `notas_avaliacao` / `notas_avaliacao_item` | AV1, etc. |
| `notas_nota_maxima` | campo máx. da avaliação |
| `notas_aluno_item` | tile aluno; **label** = nome (Ana Carolina…) |
| `notas_aluno_<i>` | TextField numérico da nota na linha `i` |
| `notas_campo_conceito` | dropdown conceito (tipAvalia=C) |
| `notas_enviar` | FAB Salvar |

Aceite: turma M3A26 → História → AV1 → `notas_aluno_*` da Ana → nota 0–10 → `notas_enviar`, só por id/label a11y.

### 12. Conteúdo e frequência (professor) — `home_card_conteudo_frequencia` já existe

**Já no código** (`lanca_frequencia_page.dart`, `lanca_conteudo_page.dart`). Prefixo **`frequencia_*`** (modo frequência) ou **`tarefas_*`** (modo tarefas). CT WEB: `playwright/diario/02-conteudo-frequencia.spec.ts`. Maestro: `flows/diario/02_conteudo_frequencia.yaml` (draft).

| identifier | Widget |
|------------|--------|
| `frequencia_turma` / `_item` | dropdown turma |
| `frequencia_disciplina` / `_item` | dropdown disciplina |
| `frequencia_etapa` / `_item` | subperíodo |
| `frequencia_aula` | data/aula (`AulaDropdown` — item id ainda frágil) |
| `frequencia_materia` | abre tela Conteúdo/Tarefas |
| `diario_aluno_item` | tile aluno; label = nome |
| `frequencia_aluno_<i>` | check/X de falta na linha `i` |
| `conteudo_descricao` | TextField conteúdo |
| `conteudo_tarefa` | TextField tarefas |
| `conteudo_anexo` | Inserir Anexo (WEB/Android: um botão → filechooser) |
| `diario_anexar_pdf` / `diario_anexar_video` | itens do menu **só iOS** |
| `conteudo_confirmar` | Confirmar |

Aceite: M3A26 → História → falta na Ana (`frequencia_aluno_*`) → `frequencia_materia` → textos canal (Web)/(Mobile) → anexar PDF+vídeo → Confirmar.

**Gap:** `AulaDropdown` sem `frequencia_aula_item` estável — se o CT falhar na data, pedir item id + label.

### 13. Fale Conosco — responsável — `home_card_chat` (`lib/chat`)

Não é o legado `home_card_atendimento`.

Já existem: `chat_lista_fab_nova`, `chat_lista_item_<i>`, `chat_input_*`, `chat_anexo_*`. Completar:

| identifier | Widget |
|------------|--------|
| `chat_canal_item` | cada canal na lista / seletor de nova conversa; label = nome do canal |

Se o thread do canal for a mesma UI do chat atual, reutilizar `chat_input_texto`, `chat_input_enviar_ou_mic`, `chat_anexo_*`. Só criar ids novos se a UI do canal **não** for esse composer.

### 14. Notas parciais — visualizar (responsável) — `home_card_notas_parciais` já existe

| identifier | Widget |
|------------|--------|
| `notas_parciais_aluno_item` | tile aluno; label = nome |
| `notas_parciais_visualizar` | visualizar boletim |

Se o tile for o mesmo widget de `notas_aluno_item`, reutilizar.

### 15. Avaliação do Conhecimento (responsável) — `home_card_avaliacao_conhecimento` já existe

| identifier | Widget |
|------------|--------|
| `avaliacao_conhecimento_aluno_item` | tile aluno; label = nome (Davi) |
| `avaliacao_conhecimento_emitir` | emitir documento |
| `avaliacao_conhecimento_compartilhar` | Compartilhar **na tela de visualização** (botão Flutter) |

### 16. Boletim de habilidades (responsável) — `home_card_avaliacao_habilidades` já existe

| identifier | Widget |
|------------|--------|
| `avaliacao_habilidades_aluno_item` | tile aluno; label = nome (Davi) |
| `avaliacao_habilidades_emitir` | emitir boletim |
| `avaliacao_habilidades_compartilhar` | Compartilhar **na tela de visualização** (botão Flutter) |

### 17. Fale Conosco — coordenador — mesmo `home_card_chat`

Ações na **mensagem** (não no container da bolha) e no **grupo**:

| identifier | Widget |
|------------|--------|
| `chat_msg_responder` | Responder |
| `chat_msg_encaminhar` | Encaminhar |
| `chat_encaminhar_canal_item` | canal destino no seletor; label = nome do canal |
| `chat_msg_reagir` | abrir reações |
| `chat_reagir_emoji` | cada emoji no picker; label = o emoji |
| `chat_grupo_criar` | criar grupo |
| `chat_grupo_adicionar` | adicionar integrantes |
| `chat_grupo_integrante_item` | tile pessoa; label = nome |

No thread do grupo: reutilizar `chat_input_texto`, `chat_input_enviar_ou_mic`, `chat_anexo_documento`, `chat_anexo_galeria` (vídeo).

### 18. `mural_composer_texto` — hit-target APP

**Não é id novo.** `escrever_comunicado.yaml`: o id existe; `tapOn: id:` acerta o ícone de **enquete** (bottom bar). Teste usa hint `Escreva seu texto aqui` + `point: 50%,45%`.

Mover o identifier para o **TextField** do corpo (bounding box do campo, acima da barra). Aceite: `tapOn: id: mural_composer_texto` + `inputText` sem abrir enquete.

### 19. Chat áudio — `chat_input_audio`

**Onde:** APP (`lib/chat`). CT CHAT-02 draft.

| identifier | Widget |
|------------|--------|
| `chat_input_audio` | botão Flutter de gravar/anexar áudio (não o gravador do SO) |

### 20. Home Cardápio — `home_card_cardapio`

Smoke `SMOKE-CARDAPIO` abre por texto `CARDÁPIO`. Incluir no mapa `_semanticsIdCard` de `home_page.dart` com o mesmo padrão dos outros `home_card_*`.

### 21. Onboarding 1ª instalação — `auth_onboarding_avancar` no FAB

**Onde:** slides “Acompanhe de perto…” (APK amostra). CT resume / `dismiss_onboarding_primeira_instalacao`.

Dump Maestro (AVD fresco, 2026-08-15): o FAB da seta é `android.widget.Button` clicável `bounds [915,2172][1041,2298]`, **sem** `identifier`, `resource-id` e `content-desc`. `tapOn: id: auth_onboarding_avancar` é SKIPPED; o resume acha `Colégio Polygonus` e tenta logout na tela errada.

**Pedido:** `identifier: auth_onboarding_avancar` no **mesmo** botão da seta (5 slides + CTA). content-desc útil: `Avançar`.

Na tela “Comece a usar…”, `auth_login_fazer_login` também ausente — tap por texto `FAZER LOGIN` funciona. `launchApp` (kill) volta aos slides se o onboarding não foi concluído.

**Aceite:** `tapOn: id: auth_onboarding_avancar` avança o slide. Depois, `tapOn: id: auth_login_fazer_login` chega em `ENTRAR`.

---

## Verificação

Dump a11y (Maestro hierarchy / `flt-semantics-identifier` no iframe) das telas:

1. Composer Bilhete, Momentos, Ocorrência
2. Thread chat WEB com menu anexo aberto
3. Composer mural com menu clipe aberto
4. Lista mural: nó `mural_card_menu` ≈ ícone ⋮; popup com `mural_card_editar` / `mural_card_excluir`
5. Chip filtro sentido
6. Picker aluno aberto (tile com nome)
7. Mensalidades: PDF / compartilhar / copiar barras
8. Notas professor: aluno + História nota + Ciências conceito
9. Conteúdo e frequência: falta + conteúdo + tarefa + anexos
10. Chat: lista de canais; responder; encaminhar; reagir; criar grupo + integrantes
11. Preview Avaliação do Conhecimento e Boletim de habilidades: emitir + compartilhar
12. Composer mural: `tapOn: id: mural_composer_texto` foca o campo (não abre enquete)
13. Chat: botão `chat_input_audio`
14. Home: card Cardápio com `home_card_cardapio`
15. Onboarding 1ª instalação: `tapOn: id: auth_onboarding_avancar` na seta

PR incompleto (só bloco 1–9 ou só hit-target WEB) = não aceite.
