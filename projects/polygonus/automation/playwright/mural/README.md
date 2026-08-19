# Playwright — Mural / Comunicados (APP WEB)

Espelho operacional da suíte Maestro `flows/mural/01_1_*`. Âncora WEB: assinatura `Teste Playwright Chrome` + `#runId` (sem ID adb).

## Rodar

```bash
cd projects/polygonus/automation/playwright
npm run test:comunicados-core    # smoke + CRUD + enquete + lista
npm run test:comunicados-suite   # suite completa (workers=1)
npm run test:comunicados-enviar  # só CT-01
```

Cloudflare: Chrome headed + perfil `.auth/pw-comunicados` (ver `comunicados-session.ts`).

**Perfil:** `openComunicadosSession` chama `garantirPerfilCoordenador` (espelho Maestro). Sem Coordenador, envios vão para **Pendentes** e o CRUD em Enviadas falha.

## Mapa CT → spec

| CT | Spec | Notas |
|----|------|--------|
| Smoke abertura | `smoke-comunicados-web.spec.ts` | |
| CRUD-01 enviar | `01-enviar-comunicado.spec.ts` | assert `#runId` (canvas fallback) |
| CRUD-02 editar | `02-editar-comunicado.spec.ts` | ⋮ via `Show menu` |
| CRUD-03 excluir | `03-excluir-comunicado.spec.ts` | + `assertTextoAusenteNaLista` |
| ENQUETE-01 | `04-enquete.spec.ts` | |
| ANEXO-01/02 | `05-anexos.spec.ts` (+ `fixtures/`) | ANEXO-03 vídeo N/A |
| EVENTO-01/02 | `08-evento.spec.ts` | |
| LISTA-01 | `09-filtro-enviadas.spec.ts` | assert chip Enviadas/Recebidas |
| BOLETO-01 | `11-boleto.spec.ts` | mês corrente |
| BOLETO-14 | `11b-boleto-competencia.spec.ts` | competência `01` |
| CORRESP-01 | `12-correspondencia.spec.ts` | |
| FILTRO-01..09 | `filtros-extras.spec.ts` | turmas=`Todos` 1×; texto antes/depois do funil. **Limpar** = opção de UI, não CT |

Helpers: `shared/mural-composer.ts`.

## Pegadinhas WEB (Flutter canvas)

| Sintoma | Causa / fix |
|---------|-------------|
| Turmas “somem” após marcar | Loop em checkbox = toggle; usar **Todos 1×** só se `aria-checked≠true` |
| Campo texto vazio no envio | Foco no canvas; `escreverTextoComunicado` com clique geométrico + digitar 2× (antes/depois do funil) |
| ⋮ não abre | `mural_card_menu` cobre o card; clicar **`Show menu`** 40×40 |
| Assert texto falha na a11y | Corpo do card só no canvas — fallback lista Enviadas + `Show menu` + print |

## N/A WEB (não bloquear paridade)

- Share sheet “Compartilhar anexos” (Android)
- Pipeline `ID_COMUNICADO` via adb + receptor ETMENEZES no mesmo fluxo
- ANEXO-03 vídeo / compressão longa
- E2E-99 draft do Maestro

FILTRO aniversariante (02/09): seed DN **automático** em `filtros-extras.spec.ts` (helper `garantirDnAniversariante`). Spec isolado: `ajustar-dn-aniversariante.spec.ts`.

---

# Seed Aniversariante (FILTRO-02 / FILTRO-09)

Usuário dedicado: **não** reverter a data de nascimento após o teste.

## Na suíte Playwright (recomendado)

`npm run test:filtros-extras` (ou `npx playwright test mural/filtros-extras.spec.ts`) já chama o seed **1×** antes do primeiro CT de aniversariante (02 ou 09). O mesmo seed serve para dia e mês.

| Env | Efeito |
|-----|--------|
| `SKIP_ANIVERSARIANTE_DN=1` | pula o seed (DN já ok hoje) |
| `PLAYWRIGHT_DN_GESTAO_URL` | override da URL CQ (`:8443` por padrão no helper) |

Custo: ~2–4 min na 1ª vez da run; depois é no-op na mesma sessão Node.

## Pipeline completo (APP + receptor)

1. **Playwright** — seed DN (suíte filtros ou `npm run test:mural-dn`).
2. **Maestro (app)** — `PHJESUS` Coordenador envia com filtro Aniversariantes do dia (FILTRO-02) ou do mês (FILTRO-09).
3. **Maestro (app)** — logout → login `ANIVERSARI` → assert do mesmo `ID` em Recebidas (como `verificar_responsavel_ve`).

## Playwright — só o ajuste de DN (manual)

| Campo | Valor |
|-------|--------|
| URL | `https://amostra.polygonus.com.br:8443/web/react/gestao` (amostra CQ) |
| Login amostra CQ | `SUPPETER` / `poly1000` |
| Menu | **Geral** → **Pessoas** → **Colaboradores** |
| Busca | centro da tela → `"Aniversariante"` |
| Abrir ficha | **duplo clique** no nome na lista |
| Editar | **Data Nascimento** — trocar **dia e mês** (manter o ano) |
| Salvar | **Gravar** (barra inferior) |

Não precisa voltar a DN original.

Env: `PLAYWRIGHT_LOGIN` / `PLAYWRIGHT_SENHA` (ver `.env.example`).

## Credenciais app (Maestro)

```
LOGIN_ANIVERSARI=ANIVERSARI
```

Mesma `SENHA` do ambiente amostra.

## Cloudflare

A amostra tem Turnstile. O spec abre Chrome **headed** com `.auth/chrome-profile`.

1. Marque **Confirme que é humano** se aparecer.
2. O spec loga com `SUPPETER` / `poly1000` se cair na tela de login.
3. Nas próximas, o perfil costuma reutilizar a sessão.

```bash
cd projects/polygonus/automation/playwright
npm run test:mural-dn
```
