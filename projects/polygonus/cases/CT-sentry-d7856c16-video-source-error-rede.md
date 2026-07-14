# CT — Sentry `d7856c16` — `VideoError: Source error` (perda de rede durante reprodução)

**Tipo:** Regressão / incidente Sentry  
**Plataforma:** Android  
**Prioridade:** Média  
**Origem:** Issue `d7856c16` — fix **6.05.16**: em `video_widget.dart`, `_onPlayerChange()` checa `hasError` e informa conexão

## Objetivo

Homologar que queda de **rede durante vídeo** não deixa o player em estado confuso sem mensagem; usuário vê orientação tipo **"Verifique sua conexão"** quando aplicável.

## Pré-requisitos

- Build **6.05.16+**.  
- Vídeo reproduzível no app (mensagem/mural/etc.).

## Passos

1. Iniciar reprodução de vídeo com rede estável.  
2. Durante playback, desligar Wi‑Fi/dados momentaneamente (conforme política de teste).  
3. Observar mensagem de erro amigável e recuperação ao restabelecer rede.

## Resultado esperado

- Sem `PlatformException` subindo de forma não tratada; feedback explícito ao usuário.

## Evidência

- Vídeo de tela mostrando perda de rede + mensagem.

## Execução

| Data | Build | Executor | Resultado | Notas |
|------|-------|----------|-----------|--------|
| | | | | |

## Registro para suporte / Sheets

| Campo | Valor |
|--------|--------|
| versao_com_problema (referência) | 6.05.10 |
| versao_corrigida | |
| data_correcao | |
| descricao_erro (suporte) | Vídeo para ou gera erro técnico quando a internet cai durante a reprodução. |
| descricao_solucao | |
