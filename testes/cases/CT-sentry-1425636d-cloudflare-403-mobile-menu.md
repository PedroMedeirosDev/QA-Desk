# CT — Sentry `1425636d` — Cloudflare 403 em `loadMenuItems` (mensagem geo / HTML)

**Tipo:** Regressão / incidente Sentry  
**Plataforma:** Android (e demais onde o menu mobile for chamado)  
**Prioridade:** Alta  
**Origem:** Issue `1425636d` — `ApiException` com HTML Cloudflare 403 em `loadMenuItems`  
**Build de referência (empresa):** 6.05.10; correção citada: **6.05.16** (`poly_http_client` — `_mensagemParaRespostaHtml()`)

## Objetivo

Homologar que resposta **403 HTML** do Cloudflare **não** sobe ao Sentry como erro bruto e que o usuário vê mensagem amigável sobre acesso fora do Brasil (texto acordado com o produto).

## Pré-requisitos

- Build **6.05.16+** (ou trunk equivalente indicado pelo time).  
- Cenário de teste **fora do Brasil** ou simulação acordada com infra (VPN/geo), sem violar política da empresa.

## Passos

1. Instalar o build candidato.  
2. Abrir o app e autenticar até o ponto em que **`/mobile_menu`** (ou fluxo equivalente) é carregado.  
3. Forçar ou aguardar resposta **403** com corpo HTML (mesmo padrão Cloudflare), conforme roteiro do time.  
4. Verificar toast/mensagem ao usuário e ausência de tela quebrada com HTML cru.

## Resultado esperado

- Mensagem clara (ex.: acesso fora do Brasil não permitido + orientação à unidade), sem crash.  
- Evento não deve ser tratado como falha não tratada enviada ao Sentry com HTML completo.

## Evidência

- Print ou vídeo curto + horário aproximado (cruzar com Sentry).

## Execução

| Data | Build | Executor | Resultado | Notas |
|------|-------|----------|-----------|--------|
| 2026-04-17 | 6.05.16+ (homolog.) | PEDRO | OK | VPN no celular; mensagem conforme esperado (geo fora do BR). Evento ocorrido em **6.05.10** — ver JSON / Sheets. |

## Registro para suporte / Sheets

| Campo | Valor |
|--------|--------|
| event_id (Sentry) | `1425636d682241f9a746b78bfb2aaaa2` |
| user.id / device (Sentry, referência) | `9e71630b-9b21-498c-8355-9863929db30d` — **não** é `event_id` |
| versao_com_problema (referência) | 6.05.10 (`br.com.polygonus.mobile.imaculada@6.05.10+60510`) |
| versao_corrigida | 6.05.16 |
| data_ocorrencia_utc | 2026-04-16T12:52:00.439000+00:00 |
| data_correcao | 2026-04-17 |
| descricao_erro (suporte) | Acesso bloqueado por segurança (403) ao carregar menu; usuário via HTML ilegível ou erro técnico. |
| descricao_solucao | Mensagem amigável (política de acesso fora do Brasil / geo); sem HTML cru na UI. |
| observacoes | Homologado com **VPN no celular**. |

Linha CSV: [`support/sheets/linhas_para_google_sheets.csv`](../support/sheets/linhas_para_google_sheets.csv).
