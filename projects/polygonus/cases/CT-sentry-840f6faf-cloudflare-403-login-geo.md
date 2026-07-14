# CT — Sentry `840f6faf` — Cloudflare 403 em `selecionarEntidade` (POST login)

**Tipo:** Regressão / incidente Sentry  
**Plataforma:** Android (fluxo de login / entidade)  
**Prioridade:** Alta  
**Origem:** Issue `840f6faf` — mesma linha de correção de `1425636d` (`_mensagemParaRespostaHtml`)  
**Build de referência (empresa):** 6.05.10; correção citada: **6.05.16**

**Evento de referência (Sentry):** `event_id` `840f6faf028e48bdab3bdf6190df28c6` — stack `runMobileApp` → `selecionarEntidade` (`utils.dart`) → `PolyHttpClient.post` → `_handleResponse`; **POST** com **403** e corpo **HTML** Cloudflare (mesma sessão em que `GET /usuarios/eu/permissoes` e `GET /usuarios/eu/mobile_menu` também retornaram 403).

## Objetivo

Homologar que **403 HTML** no **POST de login / seleção de entidade** exibe a mesma mensagem amigável e não expõe HTML nem sobe erro bruto indevido ao Sentry.

## Pré-requisitos

- Build **6.05.16+** para homologar a **correção**; build **6.05.10** reproduz o **problema** como no evento acima.  
- App **Instituto Imaculada** (`br.com.polygonus.mobile.imaculada`), flavor de produção conforme release do evento.  
- Cenário em que a API **`api.polygonus.com.br`** responde **403** com página **Cloudflare** (tipicamente **acesso aparentemente fora do Brasil** / IP em POP internacional — nos logs costuma aparecer `cf-ray` com sufixo tipo **`-MIA`**).  
- Conta com **sessão já persistida** (login anterior): o fluxo do evento inclui `checkPersistentLogin` e chamadas autenticadas antes do **POST** em `selecionarEntidade`.

## Como reproduzir (passo a passo)

1. **Preparar rede:** conectar o celular a uma **VPN** (ou rede) que faça as requisições saírem de região **bloqueada** pelo WAF/Cloudflare da Polygonus, **alinhado à política da empresa** (mesma ideia do CT `1425636d`).  
2. **Sessão salva:** com VPN **desligada**, abrir o app no Brasil (ou ambiente permitido), fazer login e uso normais até persistir sessão; fechar o app (ou manter instalado).  
3. **Ligar VPN** para o país/região de bloqueio acordado no teste.  
4. **Cold start:** encerrar o app por completo e abrir de novo. O startup chama `runMobileApp`, que em seguida pode chamar **`selecionarEntidade`** (`utils.dart`) via **`PolyHttpClient.post`**.  
5. **Confirmar no tráfego** (proxy, log de debug ou Sentry): após os **GET** que falharem com 403 HTML (ex.: `/usuarios/eu/permissoes`, `/usuarios/eu/mobile_menu`), o **POST** do fluxo de **seleção de entidade** também recebe **403** com **`text/html`** — é nesse ponto que o agrupamento **`840f6faf`** é disparado (não basta reproduzir só o `mobile_menu`, que é o issue **`1425636d`**).  
6. **Comportamento a validar:** toast/mensagem de política de acesso (sem HTML cru na UI); app não fica sem feedback.

## Passos (homologação da correção)

1. Instalar build **6.05.16+** (ou candidato com `_mensagemParaRespostaHtml` / tratamento equivalente).  
2. Repetir a sequência da secção **Como reproduzir**.  
3. Observar tratamento quando o **POST** de `selecionarEntidade` receber **403** com HTML Cloudflare.

## Resultado esperado

- Usuário vê mensagem de política de acesso (não HTML).  
- App não fica em estado inconsistente sem orientação.

## Evidência

- Print/vídeo + horário aproximado.

## Execução

| Data | Build | Executor | Resultado | Notas |
|------|-------|----------|-----------|--------|
| 2026-04-17 | 6.05.16 | PEDRO | OK | Homologado: **POST** `selecionarEntidade` com 403 Cloudflare — mensagem amigável (6.05.16). Cenário VPN/geo alinhado ao CT `1425636d`. |

## Registro para suporte / Sheets

| Campo | Valor |
|--------|--------|
| event_id (Sentry) | `840f6faf028e48bdab3bdf6190df28c6` |
| versao_com_problema (referência) | 6.05.10 (`br.com.polygonus.mobile.imaculada@6.05.10+60510`) |
| versao_corrigida | **6.05.16** |
| data_ocorrencia_utc | 2026-04-16T12:52:00.445000+00:00 |
| data_correcao | 2026-04-17 |
| descricao_erro (suporte) | Bloqueio de acesso (403) no login/seleção de entidade com página HTML de firewall. |
| descricao_solucao | Mensagem amigável ao usuário (política geo / Cloudflare); sem HTML cru na UI (`_mensagemParaRespostaHtml` / 6.05.16). |
| observacoes | Homologado em conjunto com fila geo; VPN no celular. |

Linha CSV: [`support/sheets/linhas_para_google_sheets.csv`](../support/sheets/linhas_para_google_sheets.csv) (segunda linha de dados).
