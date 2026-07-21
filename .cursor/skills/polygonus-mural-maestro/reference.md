# Mural Maestro — referência

Complemento de `.cursor/skills/polygonus-mural-maestro/SKILL.md`.

## Catálogo Mural (por suite / domínio)

- **testKey global:** `mural/crud-01`, `mural/anexo-02`, … (módulo/ctId)
- Numeração **local por bloco**; legado `01…99` ainda aceito no runner
- Futuro Atendimento: `atendimento/anexo-01` (mesmo domínio, outro módulo)

| Suite | testKey | Legado | Notas |
|-------|---------|--------|--------|
| CRUD | `mural/crud-01` … `03` | 01–03 | Enviar / editar / excluir |
| Enquete | `mural/enquete-01` | 04 | Enquete Nova Sim/Não |
| Anexos | `mural/anexo-01` … `03` | 05–07 | Foto / PDF / vídeo |
| Boleto | `mural/boleto-01` … `02` | 11, 14 | Mês corrente / competência |
| Correspondência | `mural/corresp-01` | 12 | Declaração IR |
| Eventos | `mural/evento-01` … `02` | 08, 13 | Padrão / dia inteiro |
| Lista | `mural/lista-01` | 09 | Filtro Enviadas — escopo a definir |
| Filtros | `mural/filtro-01` … `10` | 21–30 | Funil do composer (menu reformulado) |
| E2E | `mural/e2e-99` | 99 | Jornada completa (por último) — **não é smoke** |

Manual (não automatizar nesta suíte): gravação de câmera; vídeo médio/grande (timeout). Ver `flows/docs/mural-manual.md`.

## Subflows por pasta

```
shared/auth/     ensure_login_screen, login_as, login_phjesus, login_etmenezes,
                 ensure_logged_out, logout, logout_se_logado
shared/perfil/   abrir_tela_perfil, selecionar_funcao, garantir_perfil_*, verificar_perfil_*
shared/nav/      navegar_mural, voltar_para_home, navegar_home_card, navegar_rotina
shared/mural/    setup_coordenador_mural, composer_novo_comunicado, publicar_comunicado_texto,
                 filtrar_mural, filtrar_enviadas, abrir_menu_tres_pontos, editar/excluir_comunicado_lista,
                 adicionar_enquete_nova, adicionar_foto_galeria, verificar_responsavel_ve,
                 abrir_novo_comunicado, selecionar_turmas_comunicado, escrever_comunicado,
                 enviar_comunicado, anexar_arquivo_por_nome, pick_galeria_android
```

## Env / fixtures

`.env` típico:

```
LOGIN_PHJESUS=PHJESUS
LOGIN_ETMENEZES=ETMENEZES
LOGIN_ACMENEZES=ACMENEZES
LOGIN_RBBARBOSA=RBBARBOSA   # bolsista 100% + pai de menino (NÃO é Pagantes no funil)
LOGIN_PLLIMA=PLLIMA         # bolsista 50% + pai de menina (= Pagantes; FILTRO-04/06)
LOGIN_ANIVERSARI=ANIVERSARI # aniversariante — Playwright ajusta DN; assert ID no app
SENHA=poly1000
NOME_PHJESUS=Pedro Jesus
FIXTURE_PDF=...
FIXTURE_FOTO=...
FIXTURE_VIDEO=...
```

**Filtros — seeds:** Sexo valida nos dois pais; bolsistas 100%/50%/todos reutilizam os mesmos logins.  
**Pagantes** = sem gratuidade 100% → assert em `PLLIMA` (50%); `RBBARBOSA` (100%) **não** deve ver.
Push de fixtures: scripts sob `projects/polygonus/automation/maestro` (ver README / `push-maestro-fixtures`).

## Onboarding (ensure_login)

Após `clearState`:

1. Slides “Acompanhe de perto…” / “Colégio Polygonus” → taps `90%, 93%` (5×)
2. `FAZER LOGIN` se aparecer
3. Assert `ENTRAR`, `E-mail ou Login`, `Senha`, `Versão:.*`

`login_as` espera home com card MURAL (perfil com menu).

## Anti-padrões (aprendidos na prática)

| Evitar | Fazer |
|--------|--------|
| Usar ACMENEZES para enviar | Só PHJESUS (+ perfil) |
| Trocar perfil por atalho errado / Instagram | foto/nome → Perfil → lista |
| Labels `Coordenador` / `Professor` (title case) | `COORDENADOR` / `PROFESSORES` |
| Tap `Comunicado` genérico no BoomMenu | `.*Aviso.*` |
| `clearState: true` em todo CT | logout via nome → Sair; clear só em `reset_app_state` |
| Logout pelo drawer hamburger | Voltar do Mural → nome → **Sair** |
| Back cego sem abrir o menu | Back até home, depois tap no nome |
| Vários Studios + batch paralelo | 1 device, CLI, um CT por vez se ANR |
| Path absoluto com espaço no `maestro test` | cwd maestro + path relativo |
| Assumir home já tem MURAL | Garantir perfil antes de `navegar_mural` |
| Editar/excluir sem filtro Enviadas | Abrir Enviadas primeiro (CTs 02/03) |
| Reimplementar captura de ID ad-hoc | Usar `PIPELINE_ID_MURAL.md` + helpers shared |
| `uiautomator dump` no meio do Maestro | Dump só com Maestro parado (Pipeline qa-desk) |

## Pontos que ainda precisam do Studio

Marcar no YAML e validar no device:

1. FAB BoomMenu (coordenada) se API/densidade mudar
2. Overflow `more_vert` (Editar/Excluir/anexos)
3. Dialog excluir (`OK` / `Ok` / outro)
4. DocumentsUI / galeria nativa
5. Campos da tela Evento
6. Menu de tipos de enquete

## Diagnóstico de falha (qa-desk)

`parseMaestroFailure` extrai do stdout:

- ação: linha `… FAILED` que não é `Run …`
- flow: `Run …/arquivo.yaml... FAILED`
- passo humano: heurística por keywords do flow/ação × `steps[]` do CT

Histórico mostra `v{appVersion}` + bloco “Onde falhou”. Editor destaca o passo.

## Comandos úteis

```bash
cd projects/polygonus/automation/maestro
adb devices
maestro --udid emulator-5554 test flows/shared/auth/ensure_login_screen.yaml
maestro --udid emulator-5554 test flows/mural/01_1_comunicado_enviar.yaml
```

Versão instalada (igual login):

```bash
adb shell dumpsys package br.com.polygonus.mobile.amostra | findstr version
```
