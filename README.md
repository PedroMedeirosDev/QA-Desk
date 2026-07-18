# QA Desk

Repositório **multi-projeto** de qualidade de software: homologação, casos de teste, automação (Maestro / Playwright) e aplicação web de registro de bugs.

> **Produto:** [QA Desk](https://github.com/PedroMedeirosDev/QA-Desk)  
> **App:** pasta `qa-app/` · multi-projeto (`polygonus`, `anihype`, …)

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
| **`qa-app/`** | **QA Desk** — app web (bugs, homologação, runs Maestro) — [`qa-app/SPEC.md`](qa-app/SPEC.md) |
| **`scripts/`** | Sincronização de clones locais (gitignored) |
| **`polygonus-mobile/`**, **`polygonus-react/`** | Clones locais (gitignored — não versionar) |
| **`testes/`** | Redirect legado → ver [`testes/README.md`](testes/README.md) |

## Escopo de homologação

| Plataforma | Cobertura |
|------------|-----------|
| Android | Sim (emulador + smoke no físico) |
| Web | Sim |
| iOS | Não neste ambiente |

## Clones locais (somente leitura)

```powershell
.\sync.bat
```

## QA Desk (app)

```powershell
cd qa-app
npm install
npm run dev
```

- API: http://localhost:3001  
- UI: http://localhost:5174  

Credenciais e `.env` ficam **só locais** (gitignored). Use `flows/.env.example` como modelo — **nunca** commitar senhas reais.
