# Todo — homologação “fora do Brasil” (403 Cloudflare / geo)

São **dois** CTs distintos para o mesmo tipo de falha (resposta **403** com **HTML** do Cloudflare), em **endpoints diferentes**:

| # | Issue | Fluxo | Arquivo CT | Homologação |
|---|--------|--------|------------|---------------|
| 1 | `1425636d` | `loadMenuItems` / **`GET /usuarios/eu/mobile_menu`** | [`CT-sentry-1425636d-cloudflare-403-mobile-menu.md`](CT-sentry-1425636d-cloudflare-403-mobile-menu.md) | OK (2026-04-17) — VPN no celular; mensagem conforme esperado |
| 2 | `840f6faf` | Login / **`selecionarEntidade`** (POST) | [`CT-sentry-840f6faf-cloudflare-403-login-geo.md`](CT-sentry-840f6faf-cloudflare-403-login-geo.md) | OK (2026-04-17) — **6.05.16**; mensagem conforme esperado (VPN/geo) |

**Build corretiva de referência:** 6.05.16+ (`poly_http_client` — `_mensagemParaRespostaHtml()`).

**Export Sheets:** linhas dos eventos `1425636d` e `840f6faf` em [`support/sheets/linhas_para_google_sheets.csv`](../support/sheets/linhas_para_google_sheets.csv).

**Fila geo:** concluída.

**Próximo foco sugerido (fora desta fila):** homologação **Centec** — token/menu — [`CT-centec-token-mobile-menu-android.md`](CT-centec-token-mobile-menu-android.md).

**Nota sobre IDs no Sentry:** no JSON do evento, `9e71630b-9b21-498c-8355-9863929db30d` aparece como **`user.id`** (e id de dispositivo em contexto), **não** como `event_id`. O `event_id` desse evento é `1425636d682241f9a746b78bfb2aaaa2`.
