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
| CT-ROTINA-05 Humor (Sorridente) | idem |
| CT-ROTINA-06 Vestuário (Fralda + Uniforme) | idem |
| CT-ROTINA-07 Momentos (8 fotos) | idem |

Helpers: `shared/rotina-composer.ts`. WEB só expõe `rotina_composer_enviar` (turma/aluno/termo sem id).

Status amostra (2026-08-13):

| CT | WEB |
|----|-----|
| CT-ROTINA-01 Alimentação | verde — Comida → Jantar → Comeu bem |
| CT-ROTINA-02 Soneca | verde — Dormiu → Bem |
| CT-ROTINA-03 Banheiro | verde — Xixi → No vaso |
| CT-ROTINA-04 Bilhete | verde — modelo `Se machucou` (lista após o boom) → turma/aluno + texto |
| CT-ROTINA-05 Humor | verde — Sorridente |
| CT-ROTINA-06 Vestuário | verde — Fralda + Uniforme |
| CT-ROTINA-07 Momentos | verde — modelo `Se divertindo` + 8 fotos (`maestro/fixtures/Foto_1`–`Foto_8`) |

Aluno: turma normal só o Davi → `Selecionar` + OK.

N/A por enquanto: ocorrência, editar/excluir, receptor.
