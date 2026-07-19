# N8N — pós-run Maestro (MVP)

Webhook opcional após cada execução Maestro ou suite Mural.

## Subir com Docker (recomendado)

Pré-requisito: Docker Desktop rodando.

```powershell
cd projects/polygonus/automation/n8n
docker compose up -d
```

- UI: http://localhost:5678 (criar usuário admin na 1ª vez)
- Parar: `docker compose down`
- Logs: `docker compose logs -f n8n`

Webhook padrão após importar e **ativar** `workflow-maestro-post-run.json`:

```
http://localhost:5678/webhook/maestro-run
```

Coloque em `qa-desk/.env`:

```env
N8N_WEBHOOK_URL=http://localhost:5678/webhook/maestro-run
```

Reinicie a qa-desk (`npm run dev`).

## Subir sem Docker (alternativa)

```powershell
npx n8n
```

## Variáveis

| Variável | Onde | Descrição |
|----------|------|-----------|
| `N8N_WEBHOOK_URL` | `.env` na raiz do repo ou `qa-desk/.env` | URL do webhook N8N (POST JSON) |
| `QA_N8N_WEBHOOK_URL` | alternativa | Mesmo efeito |

## Fluxo

1. Maestro termina (CLI, qa-desk ou `run-mural-suite.mjs`)
2. `analyze-maestro-run.mjs` parseia o log → `projects/polygonus/automation/maestro/.maestro-analysis/latest.json`
3. Se `N8N_WEBHOOK_URL` estiver definida, POST com payload `{ source, ok, counts, alerts, lastSteps, meta }`
4. N8N pode: notificar Discord/Slack, abrir issue, agregar métricas

## Uso manual

```powershell
cd projects/polygonus/automation/maestro
maestro test --udid emulator-5554 flows/mural/01_1_comunicado_editar.yaml 2>&1 | Tee-Object run.log
node analyze-maestro-run.mjs --log run.log
```

Com webhook:

```powershell
$env:N8N_WEBHOOK_URL = "https://seu-n8n/webhook/maestro-run"
node analyze-maestro-run.mjs --log run.log
```

## Importar workflow

1. Abrir N8N → **Workflows** → **Import from File**
2. Selecionar `workflow-maestro-post-run.json`
3. Ativar workflow e copiar URL do nó **Webhook**
4. Colar em `N8N_WEBHOOK_URL`

O workflow de exemplo:
- Recebe POST JSON
- Filtra `alerts` com level `error`
- Responde 200 com resumo (adicione nó Discord/Email conforme ambiente)

## Integração qa-desk

Após `POST /api/projects/:slug/automation/tests/:id/run`, o servidor chama `analyzeMaestroOutput()` em background (não bloqueia resposta).

## Geração de CT (campos) — contrato IA / N8N

Ao gerar um fluxo/caso de teste, a IA (ou um nó AI no N8N) deve preencher campos **disjuntos**:

| Campo | Conteúdo | Não fazer |
|-------|----------|-----------|
| `description` | Objetivo do teste | Incluir “Pré-requisito: …” |
| `preconditions` | Estado antes de rodar | Misturar com resultado |
| `expectedResult` | O que é verdade ao final | Deixar vazio |
| `steps` | Ações humanas | Numerar obrigatoriamente |

Artefatos:

- Schema JSON: [`ct-draft.schema.json`](./ct-draft.schema.json)
- Workflow: [`workflow-ct-draft-normalize.json`](./workflow-ct-draft-normalize.json) → chama a qa-desk
- API: `POST /api/projects/polygonus/tests/normalize-fields`  
  Body = rascunho CT → move pré-requisito da description e devolve `warnings` se faltar campo
- Prompt de sistema (também na resposta da API em `meta.llmSystemPrompt`)

Fluxo sugerido no N8N:

1. Nó AI gera JSON no schema `CtDraftFields`
2. (Opcional) Validar com `ct-draft.schema.json`
3. POST `normalize-fields` na qa-desk
4. Você revisa no editor (botão **Corrigir texto** também aplica o contrato)

Exemplo rápido:

```powershell
curl -s -X POST http://localhost:3001/api/projects/polygonus/tests/normalize-fields `
  -H "Content-Type: application/json" `
  -d '{ "title":"Mural — editar", "description":"Edita o card. Pré-requisito: 1 item em Enviadas.", "steps":["Abrir Enviadas","Editar"] }'
```

## Próximas fases

- Agregar histórico por CT (pass rate, flaky steps)
- Correlacionar `failedStepIndex` com passos do `tests.json`
- LLM no N8N usando o schema + `normalize-fields` (rascunho; humano revisa)
- ~~Gravação de vídeo~~ — na qa-desk: checkbox “Gravar vídeo” (adb screenrecord, evidência MP4)
