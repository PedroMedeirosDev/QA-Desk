# Playwright — Rotina (APP WEB)

Espelho Maestro `flows/rotina/01_2_*`. Sessão: mesma de Comunicados (`openComunicadosSession` + COORDENADOR).

## Rodar

```bash
cd projects/polygonus/automation/playwright
npm run test:rotina
```

Env (`.env` / maestro): `TURMA_ROTINA`, `ALUNO_ROTINA`.

| CT | Spec |
|----|------|
| CT-ROTINA-01 Alimentação (Comida → Jantar) | `01-rotina-enviar.spec.ts` |
| CT-ROTINA-02 Soneca | idem |
| CT-ROTINA-03 Banheiro | idem |
| CT-ROTINA-04 Bilhete | idem |

Helpers: `shared/rotina-composer.ts`. WEB só expõe `rotina_composer_enviar` (turma/aluno/termo sem id).

Status amostra: CT-ROTINA-01 alimentação **ok**. Soneca/banheiro precisam da cascata de chips (como Comida→Jantar→Comeu bem). Bilhete: mesmo picker de aluno + texto.

N/A por enquanto: ocorrência, momentos, editar/excluir, receptor.
