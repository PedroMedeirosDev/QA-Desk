# Playwright — Chat / Atendimento novo (APP WEB)

Espelho Maestro `flows/chat/06_*`. Legado Fale Conosco (`home_card_atendimento`) fora de escopo.

## Rodar

```bash
cd projects/polygonus/automation/playwright
npm run test:chat
```

| CT | Spec |
|----|------|
| CT-CHAT-00 smoke | `01-chat-texto.spec.ts` |
| CT-CHAT-01 texto | idem |

Helpers: `shared/chat-composer.ts` (`home_card_chat`, `chat_input_*`).

Status amostra: CT-CHAT-00 smoke **ok**. CT-CHAT-01 skip — lista WEB só tem `chat_lista_fab_nova` (sem `chat_lista_item_0`); Novo grupo não seleciona pessoa.

N/A por enquanto: áudio, anexos PDF/vídeo (filechooser).
