# Semantics — app Polygonus (Maestro / Playwright / QA)

> **Sync 2026-08-11 (noite):** Playwright Comunicados WEB — perfil **COORDENADOR** obrigatório; filtro Enviadas via chip compacto; ⋮ via label **"Show menu"** (ver gap abaixo). CT-02 editar / CT-03 excluir verdes após isso.  
>  
> **Sync 2026-08-11 (tarde):** `polygonus-mobile` **`master`** `85e9384d` — **v6.06.23**  
> Lote Semantics Rotina composer + filtro + Chat (ids canônicos no app; APK amostra já em 6.06.23).  
> **Breaking:** aba Rotina usa `rotina_filtro_sentido` (não mais `mural_filtro_sentido`). Mural permanece `mural_filtro_sentido`.  
> Flows atualizados: `selecionar_filtro_sentido` (`FILTRO_SENTIDO_ID`), `rotina_preencher_enviar`, `enviar_mensagem_texto`.  
>  
> **APP-02 / `BUG-2026-003`:** hit-target FAB Rotina APP WEB — **homologado**.  
>  
> **Sync 2026-08-10:** `cq` → `2125500d` (v**6.06.14**) — lote home `home_card_*` + mural.  
> `SemanticsBinding.instance.ensureSemantics()` no `main.dart` — revalidar WEB.  
> **Flows:** smokes de menu usam `smoke_abrir_voltar_menu_id.yaml` + `CARD_ID` (build ≥ 6.06.14).

```dart
Semantics(
  identifier: 'modulo_contexto_acao',
  button: true,
  child: /* widget */,
)
```

Maestro: `tapOn: id: "modulo_contexto_acao"`  
Playwright (Flutter web + a11y): mesmo `identifier` / aria.

**Convenção:** canônico = o que está no app (`master`). Sugestões QA antigas só como histórico.  
**Pedido bloqueado antes:** inventar *novos* nomes de id fora do padrão do time — não o caso do ⋮ (id já existe).

**Padrão nos subflows QA:** `id:` primeiro → fallback texto/coordenada só se o id não existir.

**Não Semantics:** pickers nativos Android (galeria / DocumentsUI).

---

## Inventário entregue — Rotina + Chat (6.06.23)

### Rotina — filtro e lista

| `identifier` | Uso |
|--------------|-----|
| `rotina_filtro_sentido` | Dropdown Recebidas/Enviadas na **aba Rotina** |
| `mural_filtro_sentido` | Mesmo dropdown na **aba Comunicados** (Mural) |
| `rotina_lista_vazia` | Estado vazio — **só assertVisible**, não tapOn |

### Rotina — composer (`NovaRotinaPage` / legado)

| `identifier` | Uso / pegadinha |
|--------------|-----------------|
| `rotina_composer_turma` | Abre picker Turma — fecha no toque da opção (sem OK) |
| `rotina_composer_aluno` | Abre picker Aluno (multi-select) |
| `rotina_composer_termo` | Abre picker Termo — fecha no toque |
| `rotina_composer_ok` | **Só** no picker de Aluno |
| `rotina_composer_cancelar` | Rodapé Turma/Termo |
| `rotina_composer_limpar` | LIMPAR FILTRO no picker |
| `rotina_composer_opcao_<slug>` | Slug do nome da escola (`Não` → `_nao`); sem nome → `_opcao_0` |
| `rotina_composer_enviar` | Enviar — **todos** os tipos (alimentação, soneca, …) |
| `rotina_composer_galeria` / `_camera` / `_enquete` | Bottom bar |

### Rotina — boom (já existia; hit-target FAB ≥ fix APP-02)

`rotina_boom_fab`, `rotina_boom_alimentacao`, `rotina_boom_soneca`, … (manter)

### Chat / Atendimento novo

| `identifier` | Uso |
|--------------|-----|
| `chat_input_texto` | Campo mensagem |
| `chat_input_enviar_ou_mic` | Enviar / mic (mantido) |
| `chat_input_anexo` / `chat_input_camera` | Atalhos na barra (além do menu) |
| `chat_anexo_documento` | Menu anexo |
| `chat_anexo_galeria` | Menu anexo |
| `chat_anexo_camera` | Só mobile `!kIsWeb` no bottom-sheet; no popover WEB os três aparecem |
| `chat_lista_item_<i>` | Índice 0-based; spinner “carregando mais” sem id |
| `chat_lista_fab_nova` | FAB nova conversa |

**Fora deste lote:** timeline de Ocorrências ainda pode expor `mural_filtro_sentido`; Fale Conosco legado.

---

## Pedido restante (se ainda fizer sentido)

### 🟠 Mural card ⋮ — hit-target WEB (mesmo padrão APP-02)

**Não é id novo.** `mural_card_menu` já existe no app (`mensagem_widget.dart` / `PopupMenuButton`).

| Onde | O que a a11y mostra |
|------|---------------------|
| Mobile (Maestro) | `id: mural_card_menu` costuma acertar o ⋮ |
| **WEB (Playwright)** | `mural_card_menu` ≈ **card inteiro** (~1000×153); o ⋮ real é botão **40×40** só com label Material **`Show menu`** (sem `flt-semantics-identifier`) |

**Pedido aos devs (no padrão deles):** colocar `Semantics(identifier: 'mural_card_menu')` no **mesmo** widget clicável do ⋮ (`PopupMenuButton` / ícone), sem fundir no container do card — espelho da regra APP-02.

**QA hoje:** Playwright usa fallback `Show menu` (ignora o do app bar, y>120). Maestro mantém `id:` + fallback texto.

Opcional (já esperado nos flows): garantir `mural_card_editar` / `mural_card_excluir` nos itens do popup (Maestro já tenta `MENU_ACAO_ID`).

### Rotina nova (`lib/rotina/` / timeline unificada)

FAB/menu dinâmico — confirmar no dump com unidade `ind_ocor_go` se ainda falta id próprio.

### Chat — completar happy path

Com ids acima: ligar CTs `flows/chat/` (texto + anexo) no build 6.06.23+.

**Regra de ouro:** `Semantics(identifier: …)` no **mesmo** widget clicável (APP-02).

### Estratégia QA

| Faça | Evite |
|------|--------|
| Dump/PR do app como fonte | Hardcodar sugestão antiga se o app não tiver |
| `FILTRO_SENTIDO_ID=rotina_filtro_sentido` na aba Rotina | Tap em `mural_filtro_sentido` com as duas abas montadas |
| Assert `rotina_lista_vazia` | `tapOn` nesse id |
| Pedir **ajuste de hit-target** em id já canônico | Inventar nome novo tipo `mural_card_kebab` |

### Critério de aceite

- Maestro Rotina: `rotina_boom_fab` → tipo → `rotina_composer_*` → `rotina_composer_enviar`
- Maestro filtro Rotina: `id: rotina_filtro_sentido`
- Maestro Chat: `chat_input_texto` + `chat_input_enviar_ou_mic`
- Mural Comunicados: continua `mural_filtro_sentido` / `mural_*`
- **WEB:** `tapOn` / Playwright em `mural_card_menu` abre o popup (Editar\|Excluir) sem fallback `Show menu`

---

## Implementados no app

Fonte tip: `master` `85e9384d` / APK amostra **6.06.23**.

### Home — `home_card_*` (por `cod_menuitem`)

Mapeamento em `home_page.dart` → `_semanticsIdCard`. Item fora do mapa → `home_card_<slug>`.

| Código (ex.) | `identifier` |
|--------------|--------------|
| `00.02` | `home_card_mural` |
| `00.03` | `home_card_calendario` |
| `02.10` / `02.43` | `home_card_chat` |
| `02.08` / `02.42` | `home_card_atendimento` |

### Mural / Rotina / Chat

| Área | Ids |
|------|-----|
| Boom / tabs | `mural_boom_*`, `mural_tab_*`, `mural_filtro_sentido` |
| Card ⋮ | `mural_card_menu` (+ `mural_card_editar` / `_excluir` quando o popup expõe) |
| Composer mural | `mural_composer_*` |
| Rotina boom | `rotina_boom_*` |
| Rotina composer + filtro | `rotina_composer_*`, `rotina_filtro_sentido`, `rotina_lista_vazia` |
| Chat | `chat_input_*`, `chat_anexo_*`, `chat_lista_*` |

⚠️ `mural_composer_texto` pode colidir com enquete — preferir hint se necessário.

### Ainda aberto

1. **WEB hit-target** `mural_card_menu` (tabela acima) — fallback `Show menu` no Playwright
2. Rotina **nova** (timeline): confirmar Semantics no dump pós-6.06.23
3. WEB: árvore a11y no iframe — smoke `COMUNICADOS_REQUIRE_A11Y=1` quando útil

## WEB / Playwright

| Item | Estado |
|------|--------|
| Gestão → Comunicados → iframe | Smoke + enviar + **editar/excluir** (após COORDENADOR + `Show menu`) |
| Perfil | `garantir-perfil-coordenador` na sessão — sem isso o envio cai em **Pendentes** |
| Filtro sentido | Chip compacto Recebidas/Enviadas (nó `mural_filtro_sentido` é largo demais) |
| ⋮ card | Fallback **`Show menu`** até hit-target do id no WEB |
| Rotina composer WEB | Só `rotina_composer_enviar` na árvore; turma/aluno/termo/opção **sem id** (picker + cards canvas). CT-01 alimentação verde via label + Selecionar |
| Chat lista WEB | Só `chat_lista_fab_nova` + switch; **sem** `chat_lista_item_0` |
| `ensureSemantics()` | Presente — amostra 6.06.23 |

## Notas

1. Emulador / amostra: **≥ 6.06.23** para o lote Rotina/Chat. APK grande: `adb install --no-incremental -r -t …`
2. Após APK novo: smokes menus + CTs Rotina com composer por id.
3. Pickers Android: texto/DocumentsUI.
4. Rotina filtro sentido: **id diferente por aba** (`rotina_*` vs `mural_*`).
5. Pedido de Semantics: **corrigir hit-target de id existente** ≠ inventar id novo (o que foi barrado antes).
