# Estratégia de testes — QA Desk

O QA Desk é um portfólio público (visitante) e uma ferramenta de trabalho (admin). A estratégia prioriza o que mais custa se der errado: **dado pessoal exposto**, **acesso indevido** e **publicação quebrada**.

## Matriz de riscos

Impacto e probabilidade de 1 (baixo) a 3 (alto). Risco = impacto × probabilidade.

| # | Risco | Imp. | Prob. | Risco | Como é coberto | Onde |
|---|---|---|---|---|---|---|
| 1 | Visitante vê dado pessoal (CPF, e-mail, login, nome de aluno) | 3 | 2 | **6** | Sanitização e redação de PII testadas; revisão manual antes de `showInPortfolio` | `sanitize-visitor.test.ts`, `redact-pii.test.ts` |
| 2 | Publicar versão quebrada em produção | 3 | 2 | **6** | CI obrigatório no `main`; auto-deploy só publica commit verde e confere `/api/health` | `qa-desk-ci.yml`, `auto-deploy.sh` |
| 3 | Visitante ou anônimo altera dados pela API | 3 | 1 | 3 | `requireAdmin` nas rotas de escrita | **Lacuna:** sem teste de 403 para visitante |
| 4 | Bug perde o vínculo com o teste ou mostra status errado | 2 | 2 | 4 | Regras do Bug v2 em teste unitário; cartão, filtro e vínculo em E2E | `bug-v2.test.ts`, `e2e/bugs-v2.spec.ts` |
| 5 | Tela inacessível (contraste, campo sem rótulo, link sem nome) | 2 | 2 | 4 | axe (WCAG 2 A/AA) no CI; reprova em violação crítica ou grave | `e2e/bugs-v2.spec.ts` |
| 6 | Teste instável gera falso alarme e o time para de confiar no CI | 2 | 2 | 4 | Suíte E2E 5× seguidas sem retry, toda segunda-feira | `qa-desk-estabilidade.yml` |
| 7 | Contrato da API muda e o front quebra | 2 | 1 | 2 | Testes de API (Playwright) e Newman | `e2e/api/`, `postman/` |
| 8 | API lenta sob uso simultâneo | 1 | 1 | 1 | k6: 10 usuários, falha < 1% e p95 < 500 ms | `e2e/carga/api-leitura.js` |
| 9 | Banco pausado por inatividade (Supabase gratuito) | 2 | 2 | 4 | `SELECT 1` diário pelo cron da VM | `/api/health/db`, `keep-alive.sh` |
| 10 | Automação Maestro falha no agente remoto | 2 | 2 | 4 | Execução manual com emulador; histórico por rodada | **Fora do CI:** depende de emulador |

## Níveis de teste

| Nível | Ferramenta | O que verifica | Quando roda |
|---|---|---|---|
| Unitário | `tsx` + `node:assert` | Regras puras: PII, Bug v2, repasse, comentários de issue | Todo PR |
| API | Playwright `request`, Newman | Contrato HTTP, CRUD, erros 400 | Todo PR |
| E2E de interface | Playwright | Fluxos do Bug v2 com massa criada pela própria API | Todo PR |
| Acessibilidade | axe-core | WCAG 2 A/AA nas listas de bugs e de testes | Todo PR |
| Carga | k6 | Rotas de leitura com critérios de aceite | Todo PR |
| Estabilidade | Playwright `--repeat-each=5` | E2E sem flakiness | Semanal |
| Exploratório | Manual, com charter | Telas novas, tema claro e escuro, visitante | A cada entrega de tela |

## Critérios

- **Entrada no `main`:** tipos, lint, unitários, build, API, E2E, axe e k6 verdes (check `ci`). Avisos do ESLint não podem passar do limite em `eslint-limite.json` (hoje 11, todos `react-hooks/exhaustive-deps`).
- **Publicação:** o auto-deploy só usa commit com CI verde; falha de saúde após o restart bloqueia e tenta de novo em 30 min.
- **Massa de dados:** API, E2E e carga rodam com `QA_DATA_DIR=e2e/.dados`, apagado a cada subida (`e2e/api-server.mjs`). Cada teste cria a própria massa pela API e nenhum grava nos projetos reais. Specs que dependem dos dados de verdade marcam `@local`, rodam com `npm run e2e:local` e o CI pula.

## Limitações conhecidas

- A autenticação nos E2E é mock (admin). O fluxo de login real e o perfil visitante não têm E2E.
- O axe cobre duas telas e reprova só em violação crítica ou grave; as moderadas ficam no relatório.
- O k6 mede rotas de leitura em modo JSON, não o Postgres de produção.
- O Repasse (`gestor-cases.ts`) ainda usa `data/` fixo; nenhum teste automático passa por ele hoje.
