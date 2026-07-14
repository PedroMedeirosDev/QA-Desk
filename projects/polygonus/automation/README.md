# Automação

Pasta reservada para scripts (Android em emulador) e, no futuro, web conforme a stack escolhida.

## Diretriz

- **Emulador**: execução principal da suíte automatizada.
- **Aparelho físico**: smoke manual rápido (ver [`../../shared/templates/checklist-smoke-dispositivo.md`](../../shared/templates/checklist-smoke-dispositivo.md)).

## Android — opções comuns

| Abordagem                   | Quando favorece                                       |
| --------------------------- | ----------------------------------------------------- |
| **Maestro**                 | YAML, início rápido, bom para fluxos E2E              |
| **Appium**                  | Linguagem à escolha, reaproveitamento em times mistos |
| **Espresso / UI Automator** | App nativo, integração forte com Android Studio       |

**Maestro (escolhido):** detalhes de device, ADB e exemplos em [`maestro/README.md`](maestro/README.md).

Fluxo de exemplo: [`maestro/flows/smoke/example_launch_app.yaml`](maestro/flows/smoke/example_launch_app.yaml) — altere `appId` e o `assertVisible` para o app real.

Checklist rápido:

- Versão do Maestro: `maestro --version`
- Device listado: `adb devices`
- Instalar APK: `adb install caminho\app.apk`
- Rodar suíte: `maestro test projects\polygonus\automation\maestro\flows\smoke\example_launch_app.yaml` _(a partir da raiz do projeto QA Automate)_

## Web

Registrar framework (ex.: Playwright, Cypress), URL base e variáveis em arquivo de exemplo (sem segredos reais).

## iOS

Fora do escopo deste repositório até haver dispositivo ou Mac para build/execução.
