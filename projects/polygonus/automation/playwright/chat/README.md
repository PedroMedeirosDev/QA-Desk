# Playwright — Chat / Atendimento novo (APP WEB)

Espelho Maestro `flows/chat/06_*`. Legado Fale Conosco (`home_card_atendimento`) fora de escopo.

## Rodar

```bash
cd projects/polygonus/automation/playwright
npm run test:chat
# só anexos:
npx playwright test chat/02-chat-anexos.spec.ts --workers=1
```

| CT | Spec |
|----|------|
| CT-CHAT-00 smoke | `01-chat-texto.spec.ts` |
| CT-CHAT-01 texto | idem |
| CT-CHAT-04 PDF | `02-chat-anexos.spec.ts` |
| CT-CHAT-05 foto (galeria) | idem |
| CT-CHAT-06 vídeo (galeria) | idem |

Helpers: `shared/chat-composer.ts` (`home_card_chat`, `chat_input_*`, `chat_anexo_*` + filechooser).

Fixtures: `maestro/fixtures/PDF_TESTE.pdf`, `Foto_1.jpeg`, `Video_teste.mp4` (fallback `mural/fixtures`).

N/A: áudio (CHAT-02) — gravação nativa / `chat_input_audio` (SEMANTICS item 19). Se `chat_input_anexo` / `chat_anexo_*` não existirem no WEB → item 4.
