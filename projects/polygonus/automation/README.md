# Automação

Scripts Android (Maestro + emulador) e web (Playwright) para o Polygonus amostra.

## Diretriz

- **Emulador**: execução principal da suíte automatizada.
- **Aparelho físico**: smoke manual rápido (vídeo/compressão) — no AVD o encode é lento (sem MediaCodec HW).
- Checklist device: [`../../shared/templates/checklist-smoke-dispositivo.md`](../../shared/templates/checklist-smoke-dispositivo.md).

## Android — Maestro

Detalhes: [`maestro/README.md`](maestro/README.md).  
Skill operacional: [`.cursor/skills/polygonus-mural-maestro/`](../../../.cursor/skills/polygonus-mural-maestro/).

| Item | Notas |
|------|--------|
| Flows | `maestro/flows/mural/` (suite Mural) · `maestro/flows/smoke/` (regressão menus R/C/P) · shared em `maestro/flows/shared/` |
| Inventário | [`../HOMOLOGACAO_INVENTARIO.md`](../HOMOLOGACAO_INVENTARIO.md) — escopo APP+WEB por perfil |
| Fixtures | `maestro/fixtures/` → `adb push` / qa-desk empurra antes do Play (`Video_teste.mp4`, PDFs) |
| ANEXO-03 | Gate = sumir **Comprimindo** (não só toast). Idle qa-desk vídeo = 15 min |
| Filtros | `FILTRO-01…10` — Pagantes = sem gratuidade 100% (seed `PLLIMA`) |
| Pipeline ID | Pós-envio + assert responsável — ver `maestro/flows/docs/PIPELINE_ID_MURAL.md` |
| Semantics | Pedido aos devs: `maestro/flows/docs/SEMANTICS_SUGESTOES.md` |

```bash
cd projects/polygonus/automation/maestro
# credenciais via -e a partir de flows/.env (qa-desk faz isso no Play)
maestro test flows/mural/01_1_comunicado_video_pequeno.yaml
```

## Web — Playwright

| Spec | Uso |
|------|-----|
| [`playwright/mural/`](playwright/mural/) | Seed DN Aniversariante (FILTRO-02/09) |
| [`playwright/mural/smoke-comunicados-web.spec.ts`](playwright/mural/smoke-comunicados-web.spec.ts) | Smoke WEB: gestão → Comunicados → iframe Flutter |
| [`playwright/academico/`](playwright/academico/) | Ficha acadêmica |

Inventário / gaps: [`../HOMOLOGACAO_INVENTARIO.md`](../HOMOLOGACAO_INVENTARIO.md). Smoke menus APP: [`maestro/flows/smoke/README.md`](maestro/flows/smoke/README.md).

## iOS

Fora do escopo deste repositório até haver dispositivo ou Mac para build/execução.
