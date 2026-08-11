# Assinatura nos textos de comunicado / rotina

Identifica a origem do teste no Mural (filtro visual / busca).

| Origem | Prefixo no texto |
|--------|------------------|
| Maestro (emulador) | `Teste Maestro Emulador - …` |
| Playwright (Chrome) | `Teste Playwright Chrome - …` |

## Mural = dois contextos

| Aba | Setup Maestro | Semantics |
|-----|---------------|-----------|
| **Comunicados** | `setup_coordenador_mural.yaml` | `mural_boom_*`, lista Recebidas/Enviadas |
| **Rotina** | `setup_coordenador_rotina.yaml` | `mural_tab_rotina`, `rotina_boom_*` |

No WEB o ID do card não aparece. O Playwright acrescenta um **código de run** curto (`#xxxxxx`), não horário.

Exemplos:

- Maestro CT-01 comunicado: `Teste Maestro Emulador - Teste Comunicado`
- Maestro bilhete rotina: `Teste Maestro Emulador - Bilhete Rotina`
- Playwright CT-01: `Teste Playwright Chrome - CT-MURAL-01 enviar #m3k9p2`

Usar hífen ASCII (` - `), não em-dash.
