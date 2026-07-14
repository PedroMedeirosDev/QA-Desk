# CT — CDB (iOS) — VideoError / CoreMedia -12939 (byte range no streaming)

**Tipo:** Incidente Sentry (fatal tratado via `PlatformDispatcher.onError`)  
**Plataforma:** iOS (dispositivo físico)  
**Prioridade:** Alta  
**Origem:** Evento Sentry `e6f36fcebff84789b9f7cf70dcc38906`  
**Release de referência:** `br.com.polygonus.mobile.cdb@6.05.10+60510`

## Contexto resumido (sem dados pessoais no corpo do relatório público)

- **App:** `br.com.polygonus.mobile.cdb` — nome exibido no pacote do evento: **Colégio Dom Bosco**.  
- **Sintoma:** falha ao carregar vídeo — `PlatformException(VideoError, … CoreMediaErrorDomain -12939 — byte range length mismatch …)`.  
- **Ambiente:** `production`.  
- **Stack:** Flutter **3.41.4** / Dart **3.11.1**; mecanismo **VideoError** no iOS.  
- **Pista de fluxo (breadcrumbs):** carregamento de contexto, mensagens, mural; em seguida referência a recurso em `https://isma.polygonus.com.br/acropoly/docs/…` (arquivo com extensão **.pdf** no log original); ciclo **background → foreground** próximo ao momento do erro.

## Pré-requisitos

- IPA / TestFlight **6.05.10+60510** (ou build indicado pelo time).  
- iOS recente (o evento ocorreu em **iOS 26.3.1**).  
- Conta de teste alinhada ao time (perfil com mensagens/mural/documentos), sem expor credenciais em evidência pública.

## Objetivo

Reproduzir o **VideoError -12939** ao abrir o player (ou equivalente) com a URL/recurso que dispara requisições HTTP com **Range** incorreto ou recurso não-vídeo tratado como vídeo; validar correção de servidor, roteamento de URL ou widget de mídia.

## Passos sugeridos

1. Instalar o build; login em produção conforme roteiro interno.  
2. Aguardar carga inicial (home, permissões, menu mobile, mensagens).  
3. Abrir o fluxo que exibe **mídia** (mensagem com anexo, mural, documento, etc.) até atingir URL servida em **isma.polygonus.com.br** no path `acropoly/docs/…`, se for o caso do defeito.  
4. Colocar o app em **segundo plano** e retornar ao **primeiro plano**; repetir abertura do mesmo recurso.  
5. Observar: crash, tela de erro, ou reprodução estável do `VideoError` no console/Sentry.

## Resultado esperado (pós-correção)

- Recurso abre sem fatal; se for PDF/imagem, **não** deve ser enviado ao player de vídeo sem conversão/rota correta.  
- Se for vídeo: servidor/CDN deve responder corretamente a **Range** para AVFoundation.

## Evidência

- Gravação de tela ou print da tela onde ocorre a falha + horário aproximado (cruzar com Sentry).  
- Não anexar JSON completo do Sentry em canais públicos (PII / tokens).

## Execução

| Data | Build | Executor | Resultado | Notas |
|------|-------|----------|-----------|--------|
| | | | | |

## Registro para suporte / Sheets (preencher após teste)

| Campo | Valor |
|--------|--------|
| versao_com_problema (referência) | 6.05.10 (60510) |
| versao_corrigida | *(build em que passou)* |
| data_correcao | *(data)* |
| descricao_erro (suporte) | Falha ao carregar vídeo no iOS (CoreMedia -12939 / mismatch de byte range em HTTP Range). |
| descricao_solucao | *(uma frase do que mudou para o usuário)* |

---

## Uso interno apenas — dados para encaminhar ao tester (não publicar)

Preenchido a partir do payload do evento `e6f36fcebff84789b9f7cf70dcc38906`. O Sentry **não** trouxe o **nome cadastral da unidade** em texto; apenas identificadores e dados retornados por API no breadcrumb.

| Campo | Valor no evento | Observação |
|--------|-----------------|------------|
| App / marca | `br.com.polygonus.mobile.cdb` — **Colégio Dom Bosco** | Nome do app no contexto Sentry. |
| **Nome da unidade (texto)** | *(não consta no JSON)* | Há apenas **`idEntidade: 12930`** nos dados de matrícula e no path do documento (`…/docs/12930/…`). Confirmar nome no cadastro/backoffice com esse ID. |
| **Usuário (nome login)** | *(não consta no JSON)* | `user.id` no Sentry = `67E8EA6D-DE22-4A8D-8F71-1B497620C765` (correlação de dispositivo/instalação, não é nome). |
| Pessoa na API (matrícula) | Requisição `GET …/pessoa/**806671**/matricula?…` | Indica contexto com **id pessoa 806671** (provável titular da sessão no fluxo). |
| Dados de dependente no response (breadcrumb) | **LARA PERCILIA SILVA GUEDES** — `idPessoa` 806665, `idEntidade` 12930 | Aparece no corpo de resposta de matrícula/disciplinas; usar só para reprodução autorizada. |
| Geo (Sentry) | Manaus, AM — BR | Aproximação geográfica do evento. |
| URL citada no breadcrumb | `https://isma.polygonus.com.br/acropoly/docs/12930/388774/8873357/1776273878258_LIVRO COM OS NOMES.pdf` | Contém espaços no nome do arquivo; útil para repetir o mesmo recurso em teste controlado. |
