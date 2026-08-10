# Smoke de regressão (APP) — abrir menus da home por perfil

| Flow | Perfil | Conta |
|------|--------|--------|
| `regressao_menus_responsavel.yaml` | Responsável | ETMENEZES |
| `regressao_menus_coordenador.yaml` | Coordenador | PHJESUS → COORDENADOR |
| `regressao_menus_professor.yaml` | Professor | PHJESUS → PROFESSORES |

Helpers novos:

- `shared/auth/resume_etmenezes_responsavel.yaml`
- `shared/auth/resume_phjesus_professor.yaml`
- `shared/nav/smoke_abrir_voltar_menu.yaml` (não usar `navegar_home_card` — ele sempre toca Mural se o id existir)

## Rodar

```powershell
cd "projects/polygonus/automation/maestro"
maestro test flows/smoke/regressao_menus_coordenador.yaml `
  -e LOGIN_PHJESUS=PHJESUS -e SENHA=*** -e NOME_PHJESUS="Pedro Jesus"
```

Credenciais: `flows/.env` + `-e` no CLI (contrato auth).

## Escopo

Fora: Aula Online, Chegando. Atendimento = versão nova apenas.

Próximo: lançamentos Professor (notas/conteúdo/tarefas) + semantics WEB (CanvasKit) para espelhar taps de menu.

## WEB (Playwright)

```powershell
cd "projects/polygonus/automation/playwright"
npx playwright test mural/smoke-comunicados-web.spec.ts
```

Login: `PHJESUS` (ou `COMUNICADOS_LOGIN`). Abertura gestão → Comunicação → Comunicados → iframe Flutter. Taps de menu exigem a11y (`COMUNICADOS_REQUIRE_A11Y=1` para falhar se ausente).
