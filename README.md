# QA Automate

Espaço para padrões de homologação, rascunhos de casos de teste e automação (Android e web).

## Escopo de homologação

| Plataforma | Cobertura |
|------------|-----------|
| Android | Sim (automação em emulador + confirmação rápida no aparelho físico) |
| Web | Sim |
| iOS | Não — sem dispositivo Apple para validação |

Qualquer item que dependa exclusivamente de iOS deve ser registrado como **não homologado neste ambiente** ou encaminhado a quem tenha hardware iOS.

## Estrutura na raiz

| Pasta / item | Uso |
|--------------|-----|
| **`polygonus-mobile/`** | Clone do app Flutter (**polygonus-mobile** no GitHub). Na sua máquina a pasta pode ainda chamar-se `app-polygonus` — renomeie para `polygonus-mobile` quando nenhum programa estiver usando a pasta (IDE fechada ou sem workspace apontando para ela). |
| **`polygonus-react/`** | Clone do sistema web (**polygonus-react** no GitHub). |
| **`testes/`** | Tudo que é caso de teste, automação, templates, evidências, suporte/Sentry e notas (ver tabela abaixo). |
| **`README.md`**, **`.gitignore`** | Documentação e exclusões de versionamento. |

## Conteúdo de `testes/`

| Pasta | Uso |
|-------|-----|
| `templates/` | Modelos de relatório, caso de teste e checklist |
| `cases/` | Casos de teste e suítes em texto (rascunho ou Gherkin) |
| `automation/` | Scripts, configuração e notas da pilha de automação |
| `evidence/` | Screenshots, logs exportados (por padrão não versionar arquivos grandes — ver `.gitignore`) |
| `notes/` | Notas de exploração, dúvidas, IDs de build |
| `support/` | Registro enxuto para Sheets/Discord a partir de evento Sentry — ver [`testes/support/README.md`](testes/support/README.md) |
| `polygonus-sentry-suporte/` | Dados e scripts de exportação Sentry → CSV/suporte — ver [`testes/polygonus-sentry-suporte/README.md`](testes/polygonus-sentry-suporte/README.md) |

## Fluxo recomendado

1. **Automação**: rodar scripts contra **emulador Android** (build estável / APK acordado).
2. **Confirmação manual**: smoke curto no **seu aparelho Android** nos fluxos críticos ou após mudanças sensíveis (permissões, rede, performance).
3. **Web**: casos manuais ou automação conforme a stack que forem adotar; registrar navegador e versão.

## Convenções rápidas

- Identificar sempre **build** (versão, commit, APK) nos relatórios e nos casos.
- Um relatório de homologação por entrega ou por conjunto de correções, com link ou referência ao canal interno (ex.: Discord) se necessário.
- Evidência mínima: resultado da automação + smoke manual quando aplicável.

## Próximos passos sugeridos

- **Configurar ambiente (Android Studio + Maestro + PATH):** checklist no início de [`testes/automation/maestro/README.md`](testes/automation/maestro/README.md).
- Preencher `testes/templates/caso-de-teste.md` para o produto real e duplicar em `testes/cases/`.
