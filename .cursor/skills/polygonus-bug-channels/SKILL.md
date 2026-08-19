---
name: polygonus-bug-channels
description: >-
  Classifica e redige bugs Polygonus no QA Desk: App mobile (Android/iOS/Maestro)
  vs APP versão WEB (Flutter Web no browser) vs canal WEB/PORTAL de produto.
  Use ao criar ou editar bugs, abrir/atualizar issues GitHub, preencher channel/
  platform/título/passos, ou quando o usuário falar em app, mobile, emulador,
  APP WEB, Flutter Web, iframe, amostra web, ou canal App/WEB/PORTAL.
---

# Polygonus — canais de bug (App mobile vs APP WEB)

Evita misturar **App nativo**, **APP versão WEB** (Flutter Web do mesmo produto) e **WEB/PORTAL** de produto no Desk.

## Decisão rápida

| Onde reproduziu | Canal Desk (`channel`) | Plataforma (`platform`) | Código público | Menu sidebar |
|-----------------|------------------------|-------------------------|----------------|--------------|
| App no celular / emulador (Maestro, APK) | `app` | `android` ou `ios` | `APP-NN` | **APP** |
| **APP versão WEB** — mesmo app Polygonus no **browser** (Flutter Web, iframe `flt-*`) | `app` | `web` | `APP-NN` | **APP** (não WEB) |
| **App nativo e APP WEB** (mesmo sintoma nos dois) | `app` | `app_web` (label **App e APP WEB**) | `APP-NN` | **APP** |
| Produto web de gestão / portal escolar (não é o shell Flutter do app) | `web` ou `portal` | `web` | `WEB-NN` / `PORTAL-NN` | **WEB** / **PORTAL** |

Se o usuário disser **“APP versão WEB”**, **“app no Chrome”**, **“Flutter Web”**, **“iframe do mural”** → **APP WEB**: `channel: app` + `platform: web`. Fica no menu **APP**.

Se disser **emulador**, **Maestro**, **APK**, **device** → **App mobile** (`channel: app` + `android`/`ios`).

Menu **WEB** do Desk = produto de gestão / portal — **não** o Flutter do app no browser.

## Redação obrigatória

### App mobile
- Título: sintoma no App (sem “WEB”).
- Pré / passos: abrir o **App** (amostra), login, navegação nativa.
- Evidência técnica: device/AVD, build, Maestro se couber.
- Automação típica: Maestro.

### APP versão WEB
- Título: incluir **APP WEB** ou **APP versão WEB** (ex.: `Rotina (Mural · APP WEB): …`).
- Pré: **APP versão WEB (browser, amostra)**; URL se conhecida.
- Passos: “Abrir o APP na versão WEB (browser)…”, preferir **clique/tap** (mouse + touch).
- Evidência técnica: **Flutter Web / iframe**; hit-testing/gesture se relevante.
- Automação típica: Playwright (não Maestro).
- Não escrever só “Abrir o App” sem “versão WEB” — fica ambíguo.
- No formulário: canal **App**, plataforma **web** (não mudar canal para WEB).
- Se o mesmo widget Flutter também roda no App nativo e o sintoma vale nos dois → usar a seção abaixo (`app_web`), não só APP WEB.

### App nativo e APP WEB (os dois)
- Título: incluir **App e APP WEB** (ex.: `Rotina (Mural · App e APP WEB): …`).
- Pré: os dois ambientes — APK/emulador **e** APP versão WEB (browser).
- Passos: deixar explícito que reproduz no App **e** no APP WEB (mesmo widget Flutter).
- Ambiente na issue: lista com **Reproduz nos dois** + bullets **App nativo** e **APP versão WEB**. Nunca `App · APP + WEB` nem `App · Web` numa linha só.
- No formulário: canal **App**, plataforma **App e APP WEB** (`app_web`).
- `bugCode` continua `APP-NN` — não criar outro código.

### WEB / PORTAL de produto (não Flutter do app)
- Deixar claro o produto (gestão, portal, ficha, etc.).
- Não usar a label “APP WEB”.

## Checklist ao criar/editar bug

```
- [ ] channel + platform batem com a tabela acima
- [ ] APP WEB está em App → Bugs (channel app), não em WEB → Bugs
- [ ] título distingue App mobile vs APP WEB vs os dois (`App e APP WEB`)
- [ ] se vale nos dois: `platform: app_web` (não só `web`)
- [ ] passos/pré não misturam emulador com browser — salvo `app_web`, que cita os dois
- [ ] evidência (print/vídeo) no ambiente certo
- [ ] se já houver issue GitHub: atualizar título + body após editar o Desk
```

## Issue GitHub

Repo: `polygonus-br/polygonus-suporte-kb` (label `bug`).

- Criar: botão **Abrir issue GitHub** → `POST .../github-issue`.
- **Sync** (após editar o bug): botão **Sync issue GitHub** → `POST .../github-issue/sync` (título + body + evidências em `bug-evidence/`). Não cria issue nova.
- **Comentário do gestor** (webhook `issue_comment` na live): histórico + status `em_tratamento`; QA fecha a issue depois de homologar.
- `bugCode` é imutável após criação — se canal/lista mudou, corrigir o texto; não inventar outro código.

## Anti-padrões

- Colocar APP WEB em `channel: web` só porque abriu no browser → some do menu APP e mistura com WEB de gestão.
- Registrar só APP WEB (`platform: web`) quando o mesmo widget Flutter roda no App nativo e o sintoma vale nos dois → usar `app_web`.
- Passos de emulador num bug só APP WEB (ou o inverso), sem ser `app_web`.
- Assumir que “iframe” = bug de produto WEB de gestão — no Mural costuma ser **Flutter Web do APP**.
