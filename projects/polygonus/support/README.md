# Suporte — Sheets + JSON enxuto

Objetivo: partir de um **evento exportado do Sentry** (JSON) e gerar um **registro mínimo** para:

1. Colar / importar no **Google Sheets** (uma linha por correção ou por incidente).
2. O **bot do Discord** consumir JSON com o mesmo formato (`support_record`).

## Privacidade

Exportações completas do Sentry podem trazer **PII** (nomes, URLs com ids, etc.) em `breadcrumbs` e `contexts`. O script **`sentry_to_support_record.py`** só lê campos **lista branca** (metadados do evento + tipo/mensagem da exceção + release). **Não commite** JSON bruto de produção no repositório; use arquivo local ou cole no stdin e redirecione a saída.

## Gemini preenchendo o Sheet

Fluxo sugerido: você cola o JSON do Sentry no Gemini com o prompt pronto; o modelo grava a linha (Workspace) ou devolve CSV para colar; **você** só completa **observacoes** depois.

Prompt copy-paste: [`prompts/gemini_preencher_sheet.md`](prompts/gemini_preencher_sheet.md).

## Google Sheets — linha de cabeçalho sugerida

Crie a primeira linha **exatamente** nesta ordem (ajuste nomes no bot para bater com as chaves JSON em `snake_case` se preferir mapear por posição). Inclui **`observacoes`** no final para preenchimento **somente humano**:

| Coluna | Conteúdo |
|--------|----------|
| `event_id` | ID do evento no Sentry |
| `pacote` | Ex.: `br.com.polygonus.mobile.immc` (extraído do `release`) |
| `versao_app` | Ex.: `6.05.10` |
| `build` | Ex.: `60510` (`dist` ou sufixo do release) |
| `versao_corrigida` | Preenchido quando a correção existir (manual ou pipeline) |
| `data_ocorrencia_utc` | ISO do evento |
| `data_correcao` | Data da correção homologada (manual) |
| `plataforma` | `iOS`, `Android`, etc. |
| `ambiente` | `production`, `staging`, … |
| `descricao_erro` | Texto curto para suporte (sem stack) |
| `descricao_solucao` | Texto curto (preenchido após fix) |
| `titulo_sentry` | Título agrupado do Sentry, se existir |
| `culprit` | Arquivo/função de referência (opcional para suporte) |
| `sentry_release` | Release completo como veio no evento |
| `dist` | Mesmo sentido do `build` quando o Sentry envia `dist` |
| `observacoes` | **Só humano** (Gemini e automações deixam vazio) |

Depois o Apps Script / API só precisa ler linhas e montar JSON por coluna.

## Extrair registro a partir do JSON do Sentry

Pré-requisito: **Python 3.9+** no PATH.

```powershell
cd "C:\Users\PEDRO\Documents\Projetos Portfolio\QA Automate"
python testes\support\tools\sentry_to_support_record.py caminho\para\evento.json
```

Saída: um JSON **uma linha** (ou formatado com `--pretty`) no stdout.

Gravar em arquivo (para testar o bot / pipeline):

```powershell
python testes\support\tools\sentry_to_support_record.py evento.json --out testes\support\out\ultimo.json
```

Linha para colar no Sheets (mesma ordem do cabeçalho):

```powershell
python testes\support\tools\sentry_to_support_record.py evento.json --csv
```

## Caso que você colou (resumo técnico, sem PII)

- **Release:** `br.com.polygonus.mobile.immc@6.05.10+60510` → app **6.05.10**, build **60510**.
- **Plataforma do evento:** **iOS** (homologação iOS não está no seu escopo; para suporte ainda vale registrar “ocorreu em iOS”).
- **Erro visível:** `ApiException` / **token inválido**; contexto de negócio: falha ao carregar menu mobile com **HTTP 401** (`/usuarios/eu/mobile_menu`).  
  Para **suporte**, descrição em linguagem simples pode ser: *“Sessão/token inválido ao abrir o app; servidor respondeu não autorizado no menu.”* (ajuste com o texto que o suporte usar com cliente.)

Preencha `versao_corrigida`, `data_correcao` e `descricao_solucao` quando homologar a build corretiva.

## Arquivos

| Caminho | Uso |
|---------|-----|
| `schemas/support_record.schema.json` | Contrato do JSON enxuto |
| `examples/sentry_event_minimal.example.json` | Exemplo mínimo para testar o script |
| `tools/sentry_to_support_record.py` | Extração Sentry → `support_record` |
| `out/` | Saídas locais (gitignore) |
