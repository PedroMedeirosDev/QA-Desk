---
name: qa-desk-ui-semantics
description: >-
  Padrão visual e semântica de cores/botões/badges do QA Desk (React + Tailwind).
  Use ao criar ou refatorar UI em qa-desk/src (páginas, botões, badges, sidebars,
  KPIs, tabelas), ao estilizar ações Salvar/Novo/Executar/Excluir, ou quando o
  usuário pedir hierarquia visual, menos ruído, ou consistência de design.
---

# QA Desk — semântica visual

Fonte canônica de classes de botão: `qa-desk/src/lib/button-styles.ts` (`actionBtn` + `actionBtnBase`). Preferir esses tokens; não reinventar `bg-red-600` em botões de ação.

Espaçamentos e fontes em **rem** (ou escala Tailwind equivalente: `p-4`, `gap-3`, `text-sm`).

## Regra de ouro — vermelho

`bg-red-*` / `text-red-*` **só** para:

1. Ação **destrutiva** (Excluir) → `actionBtn.danger`
2. Status / badge de **erro** (Falhou)
3. Confirmação `tone: "danger"` em `confirm.tsx`

**Proibido** usar vermelho sólido em Salvar, Novo, Executar, Relatório, Sync, ou CTA primário.

Nota: `--primary` do CSS ainda é vermelho de marca (tabs / links). Isso **não** autoriza botões primários vermelhos.

## Botões (`actionBtn`)

| Intenção | Token | Visual |
|----------|--------|--------|
| Primário (Salvar, Novo teste) | `save` / `create` | Alto contraste: `bg-white text-black hover:bg-gray-200` |
| Executar / play (Maestro, Playwright, suite) | `run` | Verde sóbrio: `bg-green-600/20 text-green-400 border-green-500/50` |
| Homologar / confirmar OK | `homologate` | Outline verde sutil — **não** competir com Salvar |
| Sync / checklist | `checklist` | Verde outline/soft |
| Secundário (report, copiar, voltar leve) | `ghost` | `border-gray-700 text-gray-400 hover:text-white` |
| Neutro / voltar | `back` | Borda + fundo card |
| Destrutivo | `danger` | Vermelho sólido |

Hierarquia típica numa sidebar de detalhe (cima → baixo ou peso visual):

1. **Salvar** (`save`) — único primário
2. **Executar** (`run`) — ação de play
3. Homologar (`homologate`) — outline
4. Ghosts (report / copiar)
5. Danger só se houver exclusão

## Badges

**Metadados** (com flow, rascunho, estável, modo auto/manual, pendente):

- Fundo escuro neutro: `bg-[#1a1a1a]` (ou `bg-gray-800/50`)
- Cor só no **texto** + borda bem sutil (`border-*-400/20`)
- Sem preenchimento colorido vibrante

**Resultado crítico** (Passou / Falhou na lista ou chips de suite):

- Fundos **sólidos**: `bg-emerald-600 text-white` / `bg-red-600 text-white`
- Único lugar onde verde/vermelho “gritam” em badge

## Layout — detalhe com duas colunas

Quando houver formulário + sidebar de config:

```tsx
<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_17.5rem]">
  <div className="min-w-0 …">…conteúdo…</div>
  <aside className="sticky top-8 max-h-[calc(100vh-4rem)] self-start overflow-y-auto … scrollbar-thin">
    …ações e campos…
  </aside>
</div>
```

Evitar que a coluna alta da direita estique o grid e deixe buraco vazio na esquerda.

## KPIs / cards de métrica

- Título: leve — `text-[0.75rem] uppercase tracking-wider text-gray-400`
- Número: cor semântica no valor (sucesso verde, bloqueio vermelho, atenção âmbar)
- Totalizador (Escopo): destaque sutil (`bg-gray-800/50` + borda superior), sem competir com os demais

## Checklist antes de merge de UI

- [ ] Botões usam `actionBtn.*` (ou equivalente alinhado a esta tabela)
- [ ] Nenhum CTA primário vermelho
- [ ] Badges de metadado suaves; Passou/Falhou sólidos
- [ ] Duas colunas: sticky + scroll na sidebar se necessário
- [ ] Sem cards desnecessários no hero; um propósito por seção (quando landing)

## Tipografia de dados

Em números de PR, métricas, contagens, datas e durações: sempre `tabular-nums`.

## Motion (entrada)

Classes: `animate-fade-in-up` (login), `animate-fade-in-up-soft` (shell/KPI/empty/toast), `animate-fade-in` (overlay).

Usar **só** em momentos de chegada: login, shell (1×), drawer/modal, toast, empty state, grid de KPIs (um bloco). Sem stagger por linha/card. Respeitar `prefers-reduced-motion`.

## Shell — footer e scroll

- Rodapé (“Desenvolvido por…”) vive na **base da sidebar** (`Footer variant="sidebar"`), não no main.
- Nav da sidebar: `flex-1 min-h-0 overflow-y-auto`; footer `mt-auto shrink-0`.
- Scrollbars globais: tema escuro em `index.css` (`::-webkit-scrollbar`, medidas em rem).

## Anti-padrões

- `actionBtn.create` / `save` / `run` com `bg-red-600`
- Badge “com flow” / “rascunho” com `bg-sky-500/10` ou `bg-amber-500/10` saturado
- Vários botões vermelhos ou verdes sólidos na mesma barra (hierarquia flat)
- Sidebar direita sem sticky em telas de detalhe longas
