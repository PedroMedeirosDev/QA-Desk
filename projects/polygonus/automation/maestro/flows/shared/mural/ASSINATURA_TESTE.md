# Assinatura nos textos de comunicado

Identifica a origem do teste no Mural (filtro visual / busca).

| Origem | Prefixo no texto |
|--------|------------------|
| Maestro (emulador) | `Teste Maestro Emulador - …` |
| Playwright (Chrome) | `Teste Playwright Chrome - …` |

No WEB o ID do card não aparece. O Playwright acrescenta um **código de run** curto (`#xxxxxx`), não horário (evita confusão de fuso).

Exemplos:

- Maestro CT-01: `Teste Maestro Emulador - Teste Comunicado`
- Playwright CT-01: `Teste Playwright Chrome - CT-MURAL-01 enviar #m3k9p2`

Usar hífen ASCII (` - `), não em-dash.

Playwright: `shared/assinatura-teste.ts` → `textoComunicadoPlaywright()`.  
Maestro: prefixar `TEXTO_COMUNICADO` nos YAMLs em `mural/01_1_*.yaml`.
