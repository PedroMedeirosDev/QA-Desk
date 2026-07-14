# Contrato Maestro — porto seguro (ENTRAR)

Todo CT da suíte **começa e termina** na tela de login (`ENTRAR` visível).

## Subflows oficiais

| Arquivo | Quando usar |
|---------|-------------|
| `shared/auth/ensure_login_screen.yaml` | Início — chega em `ENTRAR` **sem** limpar dados |
| `shared/auth/login_as.yaml` | Digita LOGIN/SENHA e espera home |
| `shared/auth/login_phjesus.yaml` / `login_etmenezes.yaml` | ensure + login_as com credenciais do `.env` |
| `shared/auth/ensure_logged_out.yaml` | Fim — volta para `ENTRAR` (idempotente) |
| `shared/auth/logout.yaml` | Back (se no Mural) → nome → menu → **Sair** |
| `shared/auth/reset_app_state.yaml` | **Só sob demanda** — `clearState` (reseta tutorial + sessão) |

## Sessão e tutoriais (importante)

O app **permanece logado** no último perfil até logout explícito ou limpeza de dados.
Tutoriais (`PULAR`, onboarding) **só voltam** se limpar dados (`clearState: true` / clear data).

Por isso o porto seguro **não** usa `clearState`. Use `reset_app_state.yaml` só quando quiser recomeçar do zero.

## Template de CT

```yaml
appId: br.com.polygonus.mobile.amostra
---
- runFlow: ../shared/auth/login_phjesus.yaml   # = ensure + login
# ... ação + asserts ...
- runFlow: ../shared/auth/ensure_logged_out.yaml
```

Com dois usuários:

```yaml
- runFlow: ../shared/auth/login_phjesus.yaml
# ... ação A ...
- runFlow: ../shared/auth/ensure_logged_out.yaml
- runFlow: ../shared/auth/login_etmenezes.yaml
# ... assert B ...
- runFlow: ../shared/auth/ensure_logged_out.yaml
```

## Strings confirmadas no código (`polygonus-mobile`)

| UI | Fonte | Valor |
|----|-------|-------|
| Botão login | `actionLogin`.toUpperCase() | `ENTRAR` |
| Campo usuário | `AppConfig.emailLabel` | `E-mail ou Login` |
| Campo senha | `passwordLabel` | `Senha` |
| Onboarding CTA | recovery_card | `FAZER LOGIN` |
| Menu do nome | header → lista | `Perfil` / `Tutorial` / `Sair` |
| Sair | menu do nome (`actionLeave`) | `Sair` |
| Modal logout | `home_page.dart` | `Tem certeza que deseja sair do aplicativo?` |
| BoomMenu item | `mural_widget.dart` | `Comunicado` / `Evento` |
| Título composer | `nova_mensagem_page.dart` | `Novo comunicado` |
| Hint texto | `writeYourMessageHere` | `Escreva seu texto aqui` |
| Enviar | tooltip | `Enviar comunicado` |
| Turma | `turmaLabel` | `Turma` |
| Filtros | `types.dart` | `Recebidas` / `Enviadas` / `Pendentes` / `Aprovadas` |
| Menu item | `mensagem_widget.dart` | `Editar` / `Excluir` / `Salvar anexos` / `Compartilhar anexos` |
| Galeria | `galleryButtonHint` | `Adicionar imagem da galeria` |
| Enquete | `poolButtonHint` | `Adicionar enquete ou aviso de recebimento` |

## STUDIO — mapear manualmente

Itens **sem** texto estável no código (ícone / coordenadas / locale):

1. **FAB BoomMenu** — abrir o menu “Padrão” antes de tocar em `Comunicado`
2. **Overflow `Icons.more_vert`** — sem tooltip no código; Material pode expor `Mais opções` / `More options`
3. **Card home** — texto vem do servidor (`nomMenuItem`); default esperado `MURAL`
4. **Dialog excluir** — confirmar se o botão é `OK` / `Ok` / outro
5. **Picker galeria / DocumentsUI** — varia por API Android
6. **Onboarding slides** — só na 1ª instalação (ou após `reset_app_state`); coordenada `90%, 93%`
7. **Menu foto/nome** — Perfil / Tutorial / **Sair** (logout correto; não usar drawer)
8. **Logout a partir do Mural** — Voltar até a home → nome → **Sair**

Marque no cabeçalho do YAML `STATUS: draft` até passar 2× no emulador; depois `STATUS: ready`.

## Perfis (PHJESUS)

PHJESUS tem **duas funções**: Professor e Coordenador.

### Forma correta de garantir o perfil (UI)

1. Na home, tocar na **foto** ou no **nome** do usuário (topo)
2. No menu, tocar em **Perfil**
3. Na tela Perfil, o dropdown **Perfil** mostra o perfil **atual** escrito
4. Se estiver errado: tocar no valor atual → lista abre → escolher **Coordenador** ou **Professor**

Subflows: `abrir_tela_perfil.yaml` → `selecionar_funcao.yaml` (via `garantir_perfil_*`).

| Subflow | Quando |
|---------|--------|
| `shared/perfil/garantir_perfil_coordenador.yaml` | Envio sem aprovação (maioria dos CTs Mural) |
| `shared/perfil/garantir_perfil_professor.yaml` | Envio que deve ficar em Pendentes |

Env: `NOME_PHJESUS` = nome exibido no header (para o tap no nome).

Outros logins:

| Login | Papel |
|-------|-------|
| `ETMENEZES` | Responsável (visualiza) |
| `ACMENEZES` | **Aluno** (Eliza) — não envia comunicado |

## Credenciais

`flows/.env` (não commitado):

```
LOGIN_PHJESUS=PHJESUS
LOGIN_ETMENEZES=ETMENEZES
LOGIN_ACMENEZES=ACMENEZES
SENHA=poly1000
```

## Rodar

```bash
cd projects/polygonus/automation/maestro/flows
maestro test shared/auth/ensure_login_screen.yaml
maestro test mural/01_1_comunicado_enviar.yaml
```
