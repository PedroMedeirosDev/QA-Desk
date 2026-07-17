# Contrato Maestro — sessão estável (sem logout entre CTs)

CTs **terminam** em home autenticada (`teardown_estavel_sessao.yaml`) — **não** forçam ENTRAR.

**Início Mural (PHJESUS):** `resume_phjesus_coordenador.yaml` reutiliza sessão, troca usuário/perfil só se necessário.

## Subflows oficiais

| Arquivo | Quando usar |
|---------|-------------|
| `shared/auth/resume_phjesus_coordenador.yaml` | Início CT Mural — **reutiliza** sessão PHJESUS+coordenador |
| `shared/auth/login_phjesus.yaml` | Alias → `resume_phjesus_coordenador.yaml` |
| `shared/auth/teardown_estavel_sessao.yaml` | **Fim de CT** — Back + home (mantém login) |
| `shared/auth/ensure_logged_out.yaml` | **Só troca de usuário** (início de `verificar_responsavel_ve`) |
| `shared/auth/logout.yaml` | Back → nome → menu → **Sair** |
| `shared/auth/reset_app_state.yaml` | **Só sob demanda** — `clearState` |

## Template de CT

```yaml
appId: br.com.polygonus.mobile.amostra
---
- runFlow: ../shared/mural/setup_coordenador_mural.yaml
# ... ação + asserts ...
- runFlow: ../shared/auth/teardown_estavel_sessao.yaml
```

CT enviar (texto) — coordenador envia, responsável confirma, logout na home:

```yaml
- runFlow: ../shared/mural/setup_coordenador_mural.yaml
- runFlow: publicar_comunicado_texto.yaml
- runFlow: filtrar_enviadas.yaml
- assertVisible: "${TEXTO_COMUNICADO}"
- runFlow:
    file: ../shared/mural/verificar_responsavel_ve.yaml
    env:
      TEXTO_COMUNICADO: "..."
- runFlow: ../shared/auth/ensure_logged_out.yaml
- assertVisible: "ENTRAR"
```

Próximo CT Mural: `resume_phjesus_coordenador` no setup (relogin PHJESUS).

## CARDÁPIO (não confundir)

`CARDÁPIO` visível na home **só** indica PHJESUS logado em **SUPORTE**. Não usar como prova de Coordenador, Professor, home genérica ou outro usuário. Perfil: tela **Perfil** → `COORDENADOR` / `PROFESSORES` / …

## Sessão e tutoriais

O app **permanece logado** no último perfil. Tutoriais (`PULAR`) só voltam com `clearState` / clear data.

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
| Documento | `documentButtonHint` | `Adicionar documento` → menu `Selecionar arquivo` |
| Enquete | `poolButtonHint` | `Adicionar enquete ou aviso de recebimento` |

## STUDIO — mapear manualmente

Itens **sem** texto estável no código (ícone / coordenadas / locale):

1. **FAB BoomMenu** — abrir o menu “Padrão” antes de tocar em `Comunicado`
2. **Overflow `Icons.more_vert`** — sem tooltip no código; Material pode expor `Mais opções` / `More options`
3. **Card home** — texto vem do servidor (`nomMenuItem`); default esperado `MURAL`
4. **Dialog excluir** — confirmar com `Sim` / `Não`
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
| `ETMENEZES` | **Responsável** — home: nomes dos filhos (`Ana, Bruno, Davi`) |
| `ACMENEZES` | **Aluno** (Ana) — home: só o nome da aluna; não confundir com ETMENEZES |

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
