# Issues rastreadas (espelho local)

**Fonte:** arquivo `issues_rastreadas.md` fornecido pela empresa (Downloads).  
**Uso:** referência rápida; cada issue tem um **CT** dedicado em `cases/CT-sentry-*.md` para homologação e exportação para planilha.

| Issue ID | Título resumido | Data | Status |
|----------|-----------------|------|--------|
| `cb1d5a2b` | TypeError em `NotificationData.fromMessageData` (null → String) | 2026-04-16 | ✅ Corrigido (6.05.15) — duplicata de `3a338a00` |
| `5ab3ed0d` | Timeout 30s em `MenuController._loadMenuItems` (`/mobile_menu`) | 2026-04-16 | ✅ Corrigido (trunk) |
| `f03837da` | Timeout em `selecionarEntidade` ao iniciar app | 2026-04-16 | ✅ Corrigido (6.05.16) |
| `d7856c16` | PlatformException `VideoError: Source error` | 2026-04-16 | ✅ Corrigido (6.05.16) |
| `fcfdd4f8` | `ERROR_ALREADY_REQUESTING_PERMISSIONS` (áudio gravador) | 2026-04-16 | ✅ Corrigido (6.05.16) |
| `3a338a00` | TypeError null/String em `NotificationData.fromMessageData` | 2026-04-16 | ✅ Corrigido (6.05.15) |
| `9f495089` | NoSuchMethodError ao abrir boletim PDF | 2026-04-16 | ✅ Corrigido (trunk) |
| `840f6faf` | ApiException Cloudflare 403 HTML em `selecionarEntidade` | 2026-04-16 | ✅ Corrigido (6.05.16) |
| `1425636d` | Cloudflare 403 HTML em `loadMenuItems` | 2026-04-16 | ✅ Corrigido (6.05.16) |
| `ebea251a` | `UnsupportedError: Platform._operatingSystem` (Flutter Web startup) | 2026-04-16 | ✅ Corrigido (trunk) |
| `3c8b22f4` | SIGABRT nativo no startup (Android 11 / emulador) | 2026-04-16 | ❌ Não reproduzível |
| `86a0dc9f` | Firebase `permission-blocked` (Web) | 2026-04-16 | ✅ Corrigido (6.05.16) |
| `8a56fb06` | Null check em `MensagemWidgetState` (scroll / desmontagem) | 2026-04-16 | ✅ Corrigido (6.05.16) |

## Casos de teste correspondentes

| Issue ID | Arquivo CT |
|----------|-------------|
| `cb1d5a2b` | `CT-sentry-cb1d5a2b-notification-frommessagedata-null.md` |
| `5ab3ed0d` | `CT-sentry-5ab3ed0d-mobile-menu-timeout.md` |
| `f03837da` | `CT-sentry-f03837da-selecionar-entidade-timeout.md` |
| `d7856c16` | `CT-sentry-d7856c16-video-source-error-rede.md` |
| `fcfdd4f8` | `CT-sentry-fcfdd4f8-ios-audio-permission-already-requesting.md` |
| `3a338a00` | `CT-sentry-3a338a00-notification-frommessagedata-null.md` |
| `9f495089` | `CT-sentry-9f495089-boletim-pdf-null-response.md` |
| `840f6faf` | `CT-sentry-840f6faf-cloudflare-403-login-geo.md` |
| `1425636d` | `CT-sentry-1425636d-cloudflare-403-mobile-menu.md` |
| `ebea251a` | `CT-sentry-ebea251a-web-platform-operatingsystem-startup.md` |
| `3c8b22f4` | `CT-sentry-3c8b22f4-sigabrt-startup-symbols.md` |
| `86a0dc9f` | `CT-sentry-86a0dc9f-web-firebase-permission-blocked.md` |
| `8a56fb06` | `CT-sentry-8a56fb06-mensagem-widget-scroll-deactivate.md` |

## Geo / acesso fora do Brasil (403 Cloudflare)

Fila fechada: [`todo-homologacao-geo-fora-brasil.md`](todo-homologacao-geo-fora-brasil.md) — `1425636d` e `840f6faf` homologados (**6.05.16**).

## Homologações por `event_id` (Sheets)

| event_id | Issue | Data homolog. | Resultado | Arquivo / export |
|----------|-------|---------------|-----------|------------------|
| `1425636d682241f9a746b78bfb2aaaa2` | `1425636d` | 2026-04-17 | OK — mensagem conforme esperado; **VPN no celular** | `CT-sentry-1425636d-cloudflare-403-mobile-menu.md`, `support/sheets/linhas_para_google_sheets.csv` |
| `840f6faf028e48bdab3bdf6190df28c6` | `840f6faf` | 2026-04-17 | OK — **6.05.16**; POST `selecionarEntidade` + 403 Cloudflare tratado | `CT-sentry-840f6faf-cloudflare-403-login-geo.md`, `support/sheets/linhas_para_google_sheets.csv` |

No payload do Sentry, `9e71630b-9b21-498c-8355-9863929db30d` é **`user.id`** (e id em `contexts.device`), não o `event_id`.
