# Homologação CQ — Notas, Conteúdo, Frequência (React / Amostra)

Canal: **WEB React** da gestão, **o Amostra** (`:8443`). Não é APP Flutter.

Pedido Moacir: priorizar CQ; Conteúdo e Frequência têm **dois forms** cada.

| Área | Form 1 (quadro / etapa) | Form 2 (por turma) |
|------|-------------------------|--------------------|
| Notas | `/academico/notas-parciais` | — |
| Conteúdo | `/academico/conteudo` | `/academico/conteudo-por-turma` |
| Frequência | `/academico/faltas-diarias` | `/academico/faltas-por-turma` |

Fora deste recorte (avisar se entrar): Plano de aula (`/academico/plano-de-aula`), tarefas diárias, APP iOS/Android, Delphi legado.

## Manual (você)

Checklist no Desk: homologação **diario-cq-homologacao** (Polygonus → Homologações). Briefing na página + **Exportar escopo HTML** para o gestor.

Bugs desta campanha (canal **WEB**, não App): **WEB-01** (AV não aceita conceito), **WEB-02** (célula amarela após Gravar).

Massa típica do Amostra: turma com Ciências / 2º trimestre / AT (valor 30) ou o equivalente local. Gravar com um aluno só + vírgula (`29,5`) + nota = máximo.

## Playwright (smoke — abrir tela)

```bash
cd projects/polygonus/automation/playwright
npx playwright test academico/cq --headed --workers=1
```

Gravação (lançar nota / falta / conteúdo) fica **draft** até o manual cravar seletores.
