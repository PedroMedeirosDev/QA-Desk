# Homologação — Boletos (APK): caso **A** (mensagem deveria aparecer e não aparece)

**Objetivo do time:** onde o código **prevê** feedback ao usuário (`polyShowMessage`, toast, etc.), **simular** a situação e **confirmar** se a mensagem **aparece de fato**. Se **não aparecer**, avisar o chefe (texto curto — **prints não são obrigatórios**).

**Tela:** `Boletos` (`VerBoletoPage` — lista por aluno + ícone PDF por título).

**Registrar quando achar falha:** build do APK, ambiente (homolog/prod), horário aproximado, passos (3–5 linhas), **“esperava mensagem X / não apareceu nada”**.

---

## Fluxo de trabalho (caso A)

1. Olhar a tabela abaixo: coluna **“Mensagem esperada (código)”** = o que *deveria* acontecer segundo o código atual.
2. Coluna **“Como simular”** = tentativa de forçar aquela situação no APK.
3. Marcar: **apareceu?** sim / não / não consegui simular.
4. Se **não** e você tinha certeza do cenário → **avisar** o chefe.

---

## Legenda rápida

| Como forçar | O que é |
|-------------|---------|
| **Rede off** | Modo avião ou Wi‑Fi/dados desligados antes ou durante a ação. |
| **Só backend** | Resposta específica da API (homolog com dado de teste, ou apoio do dev). |

---

## Lista de boletos — `boletoByAluno` → `GET .../interface_legado/boletos_aluno`

| ID | Situação (código) | Mensagem esperada | Como simular | Se não aparecer → avisar |
|----|-------------------|-------------------|--------------|---------------------------|
| L1 | Resposta `Map` com chave **`error`** | `polyShowMessage` com o texto do back | Cenário em homolog onde a API devolve erro nesse formato (precisa de **backend**/caso de teste). | Sim — “lista boletos: erro do back sem dialog”. |
| L2 | Lista **vazia** (sem `error` no map) | **“Nenhum boleto disponível para visualização”** | Aluno **sem** boletos; ou API com `rows` vazio. | Sim — “lista vazia sem a frase de nenhum boleto”. |
| L3 | Falha de rede / DNS / timeout no `get` da lista | **Não há `polyShowMessage` dedicado** no mesmo padrão do PDF (risco de **silêncio** ou só loading/UI estranha). | **Rede off** ao abrir Boletos ou ao **trocar o aluno** no dropdown; repetir com rede cortada no meio do loading. | **Principal candidato ao caso A** na lista: “falha de rede na lista e **zero** mensagem”. |

**Checklist rápido (lista):**  
- [ ] L2: aluno sem boletos → aparece “Nenhum boleto…”?  
- [ ] L3: rede off na lista → aparece **algum** aviso? Se não, anotar e avisar.

---

## PDF do boleto — `boletoPdfByBoleto` → `GET .../interface_legado/report_boleto`

| ID | Situação (código) | Mensagem esperada | Como simular | Se não aparecer → avisar |
|----|-------------------|-------------------|--------------|---------------------------|
| P1 | Falha de rede / exceção no `get` | `polyShowMessage` (via `catchError` + `mensagemErroAmigavel`) | Lista ok → **rede off** → ícone **PDF** no título. | Sim — “PDF sem rede: nenhum Atenção!”. |
| P2 | Resposta sem URL válida (`extrairUrlRelatorio` null) | Mensagem ligada a **“Não foi possível gerar o boleto…”** | Backend devolvendo sucesso sem `url` (homolog/dev). | Sim — “sem URL e não avisou”. |
| P3 | Erro HTTP tratado como exceção | Alguma `polyShowMessage` (texto da exceção / API) | 403/500 em homolog nesse endpoint, se conseguir reproduzir. | Sim — “erro HTTP e silêncio”. |

**Checklist rápido (PDF):**  
- [ ] P1: rede off + PDF → aparece dialog “Atenção!”? (no seu teste já apareceu — ok para P1.)

---

## Outras mensagens na mesma tela (Boletos)

Só avisar “sumiu mensagem” se **antes** aparecia e agora não; ou se o código promete toast e não vem.

| ID | Ação | Mensagem esperada (código) | Como simular |
|----|------|----------------------------|--------------|
| X1 | FAB **Pagar** (primeiro toque, sem seleção) | `polyShowToast`: “Marque os boletos…” | Toque em Pagar sem marcar boleto. |
| X2 | Pagamento cartão em título não aceito | “Este título não aceita pagamento por cartão” | Modo pagar + boleto com flag de não aceitar cartão. |
| X3 | Pix / cópia | SnackBars de cópia / “não habilitado para pix” | Ícones de copiar; Pix com QR vazio ou múltiplos boletos. |

---

## Texto pronto para avisar o chefe (quando faltar mensagem)

> **Build:** … | **Ambiente:** …  
> **Tela:** Boletos → [lista | PDF].  
> **Simulação:** [ex.: rede off ao trocar aluno / rede off ao abrir PDF].  
> **Esperado:** [ex.: algum aviso ao usuário / “Nenhum boleto disponível…”].  
> **Obtido:** nenhuma mensagem; [lista ficou vazia / loading X / app ok].  
> **Caso no checklist:** L3 ou P1 etc.

---

## Referência no código (`polygonus-mobile`)

- Lista: `lib/portal/bloc/portal_boleto_bloc.dart` → `boletoByAluno`  
- PDF: `lib/portal/bloc/portal_boleto_bloc.dart` → `boletoPdfByBoleto`  
- Botão PDF: `lib/portal/page/ver_boleto.dart` → `BoletoTile`  
- `mensagemErroAmigavel`: `lib/shared/basis/utils.dart`

**Obs. (fora deste arquivo, mas mesmo “caso A”):** lista de **cartas** em Documentos — `DocumentosStore.loadCartas` não tem `try/catch` com mensagem; falha de rede ali também é candidata a “deveria avisar e não avisa” se o time quiser estender o mesmo critério.
