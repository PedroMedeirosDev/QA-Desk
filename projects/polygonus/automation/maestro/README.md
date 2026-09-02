# Maestro — Android local

## Configuração inicial do ambiente (Windows) — ordem sugerida

Siga na sequência; no fim você deve conseguir `adb devices` com um emulador **ou** celular e `maestro test` num YAML.

1. **Primeira abertura do Android Studio**  
   Complete o assistente; deixe baixar o **Android SDK** (pode demorar). Anote o caminho do SDK (em geral `C:\Users\<você>\AppData\Local\Android\Sdk`).

2. **SDK Manager** (ícone de engrenagem ou *More Actions* → SDK Manager)  
   Aba **SDK Platforms**: marque pelo menos uma API (ex.: **Android 14 / API 34** ou **API 33**).  
   Aba **SDK Tools**: confira **Android SDK Build-Tools**, **Android Emulator**, **Android SDK Platform-Tools** (contém o `adb`). Aplique / OK e espere o download.

3. **`adb` no PATH (recomendado)**  
   No Studio: **Settings** → **Languages & Frameworks** → **Android SDK** → copie *Android SDK Location*.  
   Adicione à variável de ambiente **Path** do Windows (usuário ou sistema):  
   `...\Android\Sdk\platform-tools`  
   Feche e reabra o terminal; teste: `adb version`.

4. **Variável ANDROID_HOME (opcional, mas útil)**  
   Variável de usuário **ANDROID_HOME** = pasta do SDK (mesma do passo 3). Algumas ferramentas esperam isso.

5. **Aceleração do emulador (Windows)**  
   Se o emulador reclamar de performance: *Turn Windows features on* → habilite **Windows Hypervisor Platform** (e/ou **Hyper-V** conforme documentação da sua CPU/Studio). Reinicie se pedir.

6. **Criar e ligar um AVD**  
   **Device Manager** → **Create Device** → siga a tabela *Qual emulador escolher* mais abaixo → **Play** e espere a home do Android.

7. **Conferir ADB**  
   Com o emulador **rodando**: no PowerShell ou CMD:  
   `adb devices`  
   Deve listar `emulator-5554` (ou similar) como `device`. Celular USB: mesma ideia (não pode estar `unauthorized`).

8. **Conferir Maestro**  
   `maestro --version`  
   Se o comando não for encontrado, reabra o terminal após instalar o Maestro ou confira se o instalador adicionou o Maestro ao PATH.

9. **Primeiro teste**  
   Ajuste `appId` em `flows/smoke/example_launch_app.yaml`, instale o APK no emulador (`adb install "...\app.apk"`) e, na pasta `projects/polygonus/automation/maestro`, rode:  
   `maestro test flows/smoke/example_launch_app.yaml`

10. **Maestro Studio**  
    Defina o *workspace* para `projects/polygonus/automation/maestro`. Aba **Local** → atualize devices após o emulador estar ligado.

---

O Maestro executa fluxos **no dispositivo que o ADB enxerga**: emulador Android ou **celular físico** por USB (ou ADB wireless).

## Por que aparece "No device connected"

O Studio só mostra device quando existe **pelo menos um** alvo em `adb devices` (emulador aberto ou USB com depuração ativa). Não depende de "Environment" do Cloud para rodar **Local**.

## Celular físico (rápido)

1. Android: **Opções do desenvolvedor** → **Depuração USB** ativada.
2. Conecte o cabo; na primeira vez, aceite o fingerprint no telefone.
3. No PC, no terminal: `adb devices` — deve aparecer algo como `XXXXXXXX device` (não `unauthorized`).
4. No Maestro Studio, use a aba **Local** e atualize; o device deve aparecer.

## Android Studio — preciso mesmo?

Para **criar e abrir emuladores (AVD)** no Windows, o caminho mais simples é o **Android Studio** (vem com SDK, `adb` e Device Manager). Dá para usar só o SDK na linha de comando, mas você economiza dor de cabeça com o Studio.

O Maestro **não substitui** o emulador: ele só “dirige” o Android que já está rodando (AVD ou celular).

## Qual emulador escolher (se ainda não definiu)

Objetivo: **um AVD estável** que rode o APK da empresa e o Maestro sem milagre.

| Escolha | Sugestão prática |
|--------|-------------------|
| **Perfil de hardware** | **Pixel 6** ou **Pixel 5** (genérico, bom suporte). |
| **Imagem de sistema (API)** | Se souber o Android mínimo do app, use **≥ essa API**. Se não souber, comece com **API 33 ou 34** (13/14) — costuma instalar apps atuais. API muito antiga pode falhar no APK. |
| **Google Play vs “Google APIs only”** | Se o app usa **Play Services**, loja, login Google, etc., prefira imagem com **ícone do Play Store**. |
| **Arquitetura** | Em PC comum (Intel/AMD), imagem **x86_64** com aceleração (HAXM/WHPX) costuma ser mais leve. Mac Apple Silicon usa imagem **arm64**. |

Crie **um** AVD primeiro, homologue nele; depois, se precisar, replique outra API para regressão.

## Emulador (passo a passo)

1. **Android Studio** instalado (ou só *Android SDK* + `adb` no PATH, mas o AVD costuma vir pelo Studio).
2. **Device Manager** (ícone de telefone na barra do Android Studio) → **Create Device** → perfil sugerido acima → baixe a **imagem de sistema** se pedir → finalize o AVD.
3. Clique em **Play** no AVD e espere o Android bootar completamente na janela do emulador.
4. No terminal: `adb devices` — deve aparecer uma linha como `emulator-5554   device`.
5. **Instale o APK** no emulador (se ainda não estiver):  
   `adb install "C:\caminho\para\seu_app.apk"`
6. Rode o Maestro (na pasta do projeto ou com caminho absoluto ao YAML):  
   `maestro test flows/smoke/example_launch_app.yaml`  
   *(na pasta `projects/polygonus/automation/maestro`; ajuste o `appId` no YAML antes.)*

**Dica:** com **emulador e celular** ligados ao mesmo tempo, o `adb` mostra dois seriais. Aí use `maestro --device emulator-5554 test ...` (troque pelo serial que o `adb devices` mostrar).

**Maestro Studio:** com o emulador já rodando, abra a aba **Local** e atualize a lista de devices — o emulador deve aparecer igual a um aparelho físico.

## Rodar um fluxo (CLI)

Na pasta `projects/polygonus/automation/maestro` (ou apontando o arquivo):

```bash
maestro test --config config.yaml --test-output-dir .maestro-output flows/seu_fluxo.yaml
```

Com um device só, o Maestro usa esse. Com vários: `maestro --device <serial> test ...` (o serial é o da lista `adb devices`).

## Limpeza automática de artefatos

Os testes geram dois tipos de lixo:

| Origem | O que acumula | Política |
|--------|----------------|----------|
| **Salvar / Compartilhar anexos** | Downloads no emulador (`Download/`, cache do app) — o Compartilhar **baixa antes** do share sheet | Removidos após run **PASS** |
| **Maestro** | PNG de cada passo em `.maestro-output/` | Pasta do run apagada em **PASS**; mantida em **FAIL** |

A **qa-desk** e o `run-mural-suite.mjs` já chamam `scripts/cleanup-test-artifacts.mjs` ao terminar cada flow.

Limpeza manual ou agendada (Task Scheduler / cron):

```powershell
cd projects/polygonus/automation/maestro
# Cópias no emulador + runs Maestro > 14 dias
.\scripts\cleanup-test-artifacts.ps1 -Emulator -PruneDays 14

# Só simular
node scripts/cleanup-test-artifacts.mjs --emulator --prune-days 14 --dry-run
```

**Histórico antigo:** você pode ter ~100+ pastas em `%USERPROFILE%\.maestro\tests` (261 PNG, ~78 MB). Os runs novos vão para `.maestro-output/` no repo; a pasta antiga pode ser apagada manualmente quando quiser.

Originais protegidos (nunca removidos): arquivos em `fixtures/` (`Foto_1.jpeg`, `PDF TESTE.pdf`, `Video_teste.mp4`, …).

## Cloud vs Local

- **Local**: seu PC + `adb` + APK já instalado (ou `launchApp` com app id se já estiver instalado).
- **Cloud / Environment**: execução remota Maestro; opcional; **não é obrigatório** para usar no seu celular ou emulador.

## Onde guardar os YAML

Este repositório: `projects/polygonus/automation/maestro/flows/`. O workspace do Maestro Studio pode apontar para esta pasta (ou para a raiz `QA-Desk`) para ficar alinhado ao portfolio.
