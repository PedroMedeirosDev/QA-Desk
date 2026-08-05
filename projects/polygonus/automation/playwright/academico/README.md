# Playwright — Ficha Acadêmica (amostra CQ)

Homologação Desk: **`ficha-academica-homologacao`**.

## Suite

| CT | Spec | O que valida |
|----|------|--------------|
| **FICHA-01** | `ui/ficha-abrir-novo.spec.ts` | Smoke: login → novo → contexto + fill enxuto |
| **FICHA-10** | `ui/ficha-dados-principais.spec.ts` | Fill completo Dados Principais (**sem Gravar**) |
| **FICHA-30** | `ui/ficha-matricula-cascata.spec.ts` | Self-setup → cascata Curso/Grade/Período/Turma → **Excluir** |
| **FICHA-90** | `ui/ficha-e2e-novo-aluno.spec.ts` | E2E: fill → **Gravar** → abas → cascata → **Excluir** |
| FICHA-02 / 20 | — | Manual / draft (consulta, família) |
| **DIAG KEEP** | `ui/ficha-gravar-keep.spec.ts` | Grava 1 aluno e **não exclui** — confere CQ vs amostra sem porta |

Abas Complementares / Documentos / Usuário / Auditoria: draft no Desk (campos dinâmicos).

## Diagnóstico CQ vs produção (mesmo host)

```powershell
npm run test:ficha:gravar-keep
```

O log imprime URL configurada, URL após login e URL após Gravar. Busque o nome `QA Desk KEEP …` em:

- CQ: `https://amostra.polygonus.com.br:8443/...`
- Sem porta: `https://amostra.polygonus.com.br/...`

Se o aluno só aparecer no `:8443`, o destino está certo.
## Massa brasileira

[`fixtures/massa.ts`](fixtures/massa.ts) usa **`massa-br`** (`buildAlunoCompleto` / `buildAlunoDemo`):

- CPF / celular válidos, nome BR, seed reproduzível
- Prefixo **`QA Desk `** no nome
- CEP fixo ViaCEP (`01310-100`) para endereço

## Gravar vs popular vs limpar

| Modo | Comportamento |
|------|----------------|
| Smoke / FICHA-10 | Não grava |
| FICHA-30 / FICHA-90 | Grava aluno → exercita → **Excluir** no `finally` |
| População | `PLAYWRIGHT_FICHA_KEEP=1` pula o Excluir |

## Rodar

```powershell
cd projects/polygonus/automation/playwright
npm install
npm run test:ficha          # smoke
npm run test:ficha:dados    # fill completo
npm run test:ficha:matricula
npm run test:ficha:e2e
npm run test:ficha:gravar-keep   # grava e NÃO exclui (diagnóstico CQ)
```

Chrome headed na **amostra CQ** (`:8443`). Perfil: `.auth/pw-ficha`.

Credenciais: `PLAYWRIGHT_*` no `.env` (login padrão **SUPPETER**).

## Desk

```powershell
cd qa-desk
npx tsx scripts/seed-ficha-homologacao.ts
```

Na homologação **Ficha acadêmica**, rode FICHA-01 / 10 / 30 / 90 (Playwright).
