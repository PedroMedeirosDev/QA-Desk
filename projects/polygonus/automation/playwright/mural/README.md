# Playwright — seed Aniversariante (FILTRO-02 / FILTRO-09)

Usuário dedicado: **não** reverter a data de nascimento após o teste.

## Pipeline completo

1. **Playwright (amostra CQ)** — ajusta dia/mês da DN do colaborador `Aniversariante` para o dia/mês do teste.
2. **Maestro (app)** — `PHJESUS` Coordenador envia com filtro Aniversariantes do dia (FILTRO-02) ou do mês (FILTRO-09).
3. **Maestro (app)** — logout → login `ANIVERSARI` → assert do mesmo `ID` em Recebidas (como `verificar_responsavel_ve`).

## Playwright — só o ajuste de DN

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
