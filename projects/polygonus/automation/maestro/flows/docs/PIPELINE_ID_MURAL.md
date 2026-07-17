# Pipeline de ID do Mural (consolidado)

Badge `ID 1234567` vive no **content-desc** de `mural_card_menu` (não no texto copiável).  
`copyTextFrom` falha; `assertVisible` com regex `.*ID\s*DIGITS.*` funciona.

## Helpers (reutilizar — não duplicar)

| Flow | Papel |
|------|--------|
| `seed_id_comunicado_env.yaml` | Normaliza `ID_COMUNICADO` / `MURAL_ID` → `output.idComunicado` (`ID N`) |
| `assert_comunicado_por_id.yaml` | Confirma presença por regex no content-desc |
| `assert_comunicado_ausente_por_id.yaml` | Confirma ausência após excluir |
| `confirmar_comunicado_enviado.yaml` | Seed + assert por ID (+ voltar home) |
| `verificar_responsavel_ve.yaml` | ETMENEZES + assert pelo **mesmo** ID (obrigatório) |
| `capturar_id_comunicado_lista.yaml` | Legacy/`copyTextFrom` — **não** usar como prova de envio |

Código Node (qa-app):

| Módulo | Papel |
|--------|--------|
| `qa-app/server/mural-card-id.ts` | `captureMuralCardId`, `assertTopCardMatches`, `assertCardIdAbsent` |
| `runMaestroFlowWithMuralCardId` | Orquestra pré-ação (02/03) e pós-envio (01/04/05/06/07) |

## Pipeline A — pré-ação (CT-02 editar / CT-03 excluir)

```
1. prep_lista_enviadas.yaml (PHJESUS + COORDENADOR + Enviadas)
2. adb captureMuralCardId(0)
3. .generated/_run_{editar|excluir}_id_{digits}.yaml
4. adb pós-check
```

## Pipeline B — pós-envio (CT-01 / 04 / 05 / 06 / 07)

```
1. YAML do CT (fase 1): setup → composer → enviar → filtrar_enviadas
   (para na lista; não confirma por texto)
2. adb captureMuralCardId(0)  ← card recém-enviado
3. .generated/_run_post_send_*_id_{digits}.yaml
   - assert_comunicado_por_id
   - opcional: verificar_responsavel_ve (mesmo ID)
   - opcional: Compartilhar anexos (CT-05)
   - teardown_estavel_sessao
```

**Não** capturar via `uiautomator dump` *dentro* do Maestro. Dump só entre JVMs.

## Destaque vs captura no topo

Comunicado **Destaque** (CT futuro) fica pinado no topo de **Recebidas** do responsável — o ID pode ser maior e não é o “mais recente” por tempo.

| Quem | Lista | Captura `captureMuralCardId(0)` | Assert recebimento |
|------|--------|--------------------------------|--------------------|
| PHJESUS pós-envio | Enviadas | OK = card recém-enviado (se não houver outro pin) | — |
| ETMENEZES | Recebidas (sem filtro de situação) | **Não** usar índice 0 se houver Destaque | `assert_comunicado_por_id` + menu ⋮ com `id: mural_card_menu` + `text: .*ID\s*DIGITS.*` (`abrir_menu_compartilhar_anexos.yaml`) |

## Anexos no composer

| Tipo | Caminho | Semantics / flow |
|------|---------|------------------|
| Foto | ícone galeria (extrema esquerda) | `mural_composer_galeria` |
| PDF / vídeo | clipe → **Selecionar arquivo** → picker | `anexar_arquivo_por_nome.yaml` |
| Boleto | funil → **Inadimplentes** → Período (mês corrente **ou** competência `01`) + clipe → **Boleto** | CT-11 / CT-14 |
| Correspondência | clipe → **Correspondência** → Declaração de IR → Ok | `anexar_correspondencia_declaracao_ir.yaml` |

Menu do clipe: `abrir_menu_anexo_clip.yaml` (`mural_composer_anexo`).

## Composer padrão (todos os envios)

Após turmas: `selecionar_alvo_todos.yaml` — chip ao lado de `Para:` (default Alunos) → **Todos**.  
Semantics desejado: `mural_composer_alvo` (hoje regex/texto).

## CLI

```powershell
# Só dígitos no -e (sem espaço)
maestro test -e ID_COMUNICADO=9083330 mural/01_1_comunicado_editar.yaml

# CTs de envio com pipeline completo:
cd qa-app
npx tsx server/scripts/run-ct-mural.ts 01 04 05
```

Windows: nunca `-e MURAL_ID=ID 123` com `shell:true`.
