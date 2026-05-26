# CT — Centec (Android) — token inválido ao carregar menu

**Tipo:** Regressão / incidente Sentry  
**Plataforma:** Android (homologação no seu aparelho ou emulador)  
**Prioridade:** Alta  
**Origem:** Evento Sentry `5c5ecadf…` (mesma família de erro que iOS: `ApiException: token inválido` + HTTP 401 em `mobile_menu`)

## Contexto resumido (sem dados reais de usuário)

- **App:** `br.com.polygonus.mobile.centec` — build de referência do incidente **6.05.10 (60510)**.  
- **Sintoma:** ao abrir / retomar o app, a chamada ao menu mobile recebe **401**; o app trata como **`ApiException: token inválido`**.  
- **Ambiente do evento:** `production`.  
- **SO do evento:** Android 16 (aparelho Samsung série A — modelo genérico no log).

## Pré-requisitos

- APK Centec **6.05.10+60510** (ou o build que o time indicar como candidato à correção).  
- Conta de teste com permissão de uso do app (sem dados de produção de terceiros nos relatórios).  
- Rede estável (Wi‑Fi); opcional: repetir com dados móveis se for política do time.

## Objetivo

Confirmar se o usuário consegue **abrir a home e carregar o menu** sem crash fatal e sem erro de sessão indevido; após correção, confirmar que **401 em `/usuarios/eu/mobile_menu`** não ocorre em fluxo válido.

## Passos sugeridos

1. Instalar o build sob teste; limpar dados do app **ou** usar sessão controlada conforme combinado com o time.  
2. Fazer login (ou fluxo que renova token, se existir).  
3. Na home, aguardar o carregamento do **menu mobile** (equivalente ao endpoint `…/usuarios/eu/mobile_menu`).  
4. Colocar o app em **segundo plano** e retornar (o evento original ocorreu com transições de ciclo de vida); repetir 2–3 vezes.  
5. Se possível, deixar o token expirar ou simular sessão inválida **só** se o time passar roteiro seguro (senão pule).  
6. Observar: crash, tela branca, mensagem ao usuário, ou recuperação após novo login.

## Resultado esperado (pós-correção)

- Com sessão válida: menu carrega; **não** há fatal `ApiException: token inválido` só pelo fluxo normal de abertura.  
- Se 401 for esperado (sessão expirada): app deve **orientar re-login** de forma controlada, sem estado inconsistente (definir com o time o comportamento aceito).

## Evidência

- Print ou vídeo curto da home com menu carregando.  
- Se falhar: print da mensagem + anotação de horário aproximado (para cruzar com Sentry, sem colar JSON com PII).

## Execução

| Data | Build | Executor | Resultado | Notas |
|------|-------|----------|-----------|--------|
| | | | | |

## Registro para suporte / Sheets (preencher após teste)

| Campo | Valor |
|--------|--------|
| versao_com_problema (referência) | 6.05.10 (60510) |
| versao_corrigida | *(build em que passou no teste)* |
| data_correcao | *(data da homologação)* |
| descricao_erro (suporte) | Ex.: *Sessão/token inválido ao carregar o menu do app (erro de autorização no servidor).* |
| descricao_solucao | *(o que mudou para o usuário, em uma frase)* |
