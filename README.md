# QA Automate

Repositório **multi-projeto** de qualidade de software: homologação, casos de teste, automação (Maestro / Playwright) e aplicação web de registro de bugs.

> **Nome do produto:** QA Automate  
> **Pasta local sugerida:** `qa-automate` (renomeie de `Polygonus-QA` quando conveniente — ver [`RENAMING.md`](RENAMING.md))

## Projetos

| Slug | Pasta | Status |
|------|-------|--------|
| **polygonus** | [`projects/polygonus/`](projects/polygonus/) | Ativo — mobile, web, CQ |
| **anihype** | [`projects/anihype/`](projects/anihype/) | Em setup |

Detalhes: [`projects/README.md`](projects/README.md)

## Estrutura na raiz

| Pasta / item | Uso |
|--------------|-----|
| **`projects/`** | Um diretório por cliente/produto (cases, automação, evidência) |
| **`shared/`** | Templates e recursos comuns |
| **`qa-app/`** | Aplicação web de QA (registro de bugs, histórico, upload) — [`qa-app/SPEC.md`](qa-app/SPEC.md) |
| **`scripts/`** | Sincronização de clones da empresa |
| **`polygonus-mobile/`**, **`polygonus-react/`** | Clones locais Polygonus (gitignored) |
| **`testes/`** | Redirect legado → ver [`testes/README.md`](testes/README.md) |

## Escopo de homologação

| Plataforma | Cobertura |
|------------|-----------|
| Android | Sim (emulador + smoke no físico) |
| Web | Sim |
| iOS | Não neste ambiente |

## Clones Polygonus (somente leitura)

```powershell
.\sync.bat
```

## QA App (fase 1)

```powershell
cd qa-app
npm install
npm run dev
```

- API: http://localhost:3001  
- UI: http://localhost:5174  

## Fluxo Polygonus (referência)

1. `.\sync.bat` — atualizar clones  
2. [`projects/polygonus/homologacao/`](projects/polygonus/homologacao/) — planejar sessão  
3. [`projects/polygonus/automation/maestro/`](projects/polygonus/automation/maestro/) — E2E mobile  
4. [`projects/polygonus/automation/playwright/`](projects/polygonus/automation/playwright/) — E2E web  
5. **QA App** — registrar bug, anexar print, histórico  

## Migração jul/2026

O conteúdo de `testes/` foi reorganizado em `projects/polygonus/` + `shared/templates/`. Links antigos: [`testes/README.md`](testes/README.md).
