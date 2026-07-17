# Comunicado exibe horário errado no Mural (“há 3h”)

**Tipo:** Bug · App mobile · Mural  
**Prioridade:** Baixa (impacto maior fora do Brasil / fuso divergente)  
**Status:** Reportado — aguardando backend  
**Relacionado:** POL-11 (chat, mesmo padrão UTC vs GMT-3)

---

## Passo a passo

1. Abrir o app **br.com.polygonus.mobile.amostra** (build CQ / homologação).
2. Entrar como **PHJESUS** (coordenador) e abrir o **Mural**.
3. Garantir relógio do emulador/dispositivo em **GMT-3** (`America/Sao_Paulo`) — conferir barra de status.
4. Enviar um **novo comunicado** (ex.: “novo teste gmt 3”) — anotar horário real do envio.
5. Voltar à lista do Mural (Recebidas ou Enviadas) e observar o carimbo relativo do card (**“há Xm” / “há Xh”**).

---

## Resultado atual

Comunicado enviado **há poucos minutos** aparece como **“há 3h”** (desvio fixo de ~3 horas).

Exemplo observado em **14/07/2026 ~13:33** (GMT-3): mensagens “novo teste gmt 3”, “teste emulador fuso horario gmt 3” e “comunicado enviado” todas com **“há 3h”**, embora tenham sido enviadas manualmente minutos antes.

Ajustar fuso no emulador de GMT+0 para GMT-3 **não corrigiu** novos envios — indica problema na **gravação/serialização de `datEnvio` no backend**, não só relógio local.

---

## Ambiente mobile

| Campo | Valor |
|--------|--------|
| **Versão** | amostra CQ (informar build exato da tela Perfil → Versão) |
| **SO** | Android (API 33+ — emulador **Medium_Phone**) |
| **Dispositivo** | Emulador `emulator-5554` (reproduzido também após `auto_time_zone=0` + `America/Sao_Paulo`) |
| **App** | `br.com.polygonus.mobile.amostra` |

---

## Evidência técnica

**Hipótese (código):**

- Gravação Go: `dat_envio` via `database.AgoraBrasil()` em `polygonus-go/internal/comunicacao/envio.go`.
- Leitura feed: `MensagemFeed.DatEnvio` como `*time.Time` (JSON RFC3339 **Z**) em `feed.go` — diferente de `BrasilTime` usado na escrita em `model.go`.
- App Flutter: `datEnvio = decodeDateTime(...)` + `formatPastDateTime()` em `mensagem_widget.dart` — **não** usa `forceToUtcDateTime()` apesar do comentário em `poly_date_utils.dart`.

**Conferir na API:** valor bruto de `datEnvio` no JSON do feed após envio — esperado `-03:00` alinhado ao horário local; suspeita de instante UTC interpretado como local (offset 3h).

**Dump A11y (header Mural):** card `"Pedro Jesus\nRecebidas"` — filtro ok; problema é só carimbo temporal.

---

## Resultado esperado

Carimbo relativo coerente com o horário real de envio (ex.: envio às 13:30 → **“há 2min”** ou **“há 5min”**, não **“há 3h”**).

`datEnvio` no JSON deve representar o mesmo instante que o usuário vê no fuso **America/Sao_Paulo**.

---

## Impacto em homologação / Maestro

- Ordenação e “1º comunicado da lista” podem enganar o teste.
- Evitar asserts em **“há X min”**; preferir **texto do comunicado** (`Teste Comunicado`, etc.).

---

## Registro para Discord (copiar)

```
Comunicado exibe horário errado no Mural (“há 3h”)

Passo a passo:

1 - Entrar como PHJESUS e abrir o Mural (app amostra CQ)
2 - Confirmar relógio do device em GMT-3 (America/Sao_Paulo)
3 - Enviar comunicado de teste e anotar horário real
4 - Voltar à lista e ler o carimbo “há …” no card

resultado atual: Comunicado enviado há poucos minutos aparece como “há 3h” (desvio ~3h). Ajustar fuso no emulador não corrigiu.

Ambiente mobile:
Versão: (build CQ / amostra)
SO: Android — emulador Medium_Phone
Dispositivo: emulador

Evidência técnica: Suspeita de serialização de datEnvio no feed Go (*time.Time com Z) vs BrasilTime na gravação; Flutter usa decodeDateTime sem forceToUtcDateTime.

resultado esperado: Carimbo “há Xm” coerente com o horário real de envio.
```
