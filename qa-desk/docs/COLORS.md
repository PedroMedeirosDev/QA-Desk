# Cores — QA Desk, projetos e temas

Fonte da verdade no código:

| Área | Arquivo |
|------|---------|
| Tokens globais claro/escuro | `src/index.css` (`:root` / `.dark`) |
| Tokens por projeto | `src/config/project-themes.ts` + `[data-theme]` em `index.css` |
| Classes de accent / sidebar | `src/config/projects.ts` |
| Semântica de botões | `src/lib/button-styles.ts` |

A **marca QA Desk** (vermelho) **não muda** com o projeto ativo: `--primary` permanece vermelho; o projeto só ajusta `--brand`, `--project-accent`, `--ring` e realces da shell.

---

## 1. Tema claro e escuro (shell global)

### Claro (`:root`)

| Token | Hex | Uso |
|-------|-----|-----|
| `--background` | `#ffffff` | Fundo da página |
| `--foreground` | `#0f172a` | Texto principal (slate-900) |
| `--card` | `#f8fafc` | Superfícies / painéis (slate-50) |
| `--primary` | `#dc2626` | Marca / CTAs vermelhos (red-600) |
| `--primary-foreground` | `#ffffff` | Texto sobre primary |
| `--secondary` | `#f1f5f9` | Superfície secundária (slate-100) |
| `--secondary-foreground` | `#0f172a` | Texto sobre secondary |
| `--muted` | `#f1f5f9` | Fundo muted |
| `--muted-foreground` | `#475569` | Texto secundário (slate-600) |
| `--accent` | `#f1f5f9` | Hover / destaque neutro |
| `--border` | `#e2e8f0` | Bordas (slate-200) |
| `--input` | `#ffffff` | Fundo de inputs |
| `--ring` | `#dc2626` | Focus ring (default marca) |
| `--brand` | `#dc2626` | Banner / surface brand |
| `--brand-muted` | `#fef2f2` | Fundo brand suave (red-50) |
| `--success` | `#16a34a` | Sucesso (green-600) |
| `--success-muted` | `#dcfce7` | Fundo sucesso (green-100) |

Sidebar clara (classes fixas): fundo `slate-50` / `#f8fafc`.

### Escuro (`.dark`)

| Token | Hex | Uso |
|-------|-----|-----|
| `--background` | `#000000` | Fundo |
| `--foreground` | `#f4f4f5` | Texto (zinc-100) |
| `--card` | `#09090b` | Painéis (zinc-950) |
| `--primary` | `#ef4444` | Marca (red-500) |
| `--primary-foreground` | `#ffffff` | Texto sobre primary |
| `--secondary` | `#18181b` | Superfície (zinc-900) |
| `--secondary-foreground` | `#f4f4f5` | Texto |
| `--muted` | `#18181b` | Fundo muted |
| `--muted-foreground` | `#a1a1aa` | Texto secundário (zinc-400) |
| `--accent` | `#18181b` | Hover neutro |
| `--border` | `#27272a` | Bordas (zinc-800) |
| `--input` | `#09090b` | Inputs |
| `--ring` | `#ef4444` | Focus |
| `--brand` | `#ef4444` | Brand |
| `--brand-muted` | `#450a0a` | Brand suave (red-950) |
| `--success` | `#22c55e` | Sucesso (green-500) |
| `--success-muted` | `#14532d` | Fundo sucesso (green-900) |

Sidebar escura: `zinc-950/80` (`#09090bcc` aproximado).

---

## 2. QA Desk (marca + projeto `desk`)

### Hex canônicos

| Papel | Hex | Notas |
|-------|-----|--------|
| Accent / primary claro | `#dc2626` | red-600 |
| Accent / primary escuro | `#ef4444` | red-500 |
| Highlight (desk) | `#dc2626` | mesmo eixo vermelho |
| Brand muted claro | `#fef2f2` | red-50 |
| Brand muted escuro | `#450a0a` | red-950 |
| Check do logo Stack | `#dc2626` | traço vermelho no SVG |

### Shell (`PROJECT_THEMES.desk` / `qaDesk`)

| Token | Valor |
|-------|--------|
| `accent` | `#ef4444` |
| `highlight` | `#dc2626` |
| `mainContentGlow` | `#ef4444` |
| Cartão ativo | `bg-red-50` / `dark:bg-red-950/35` |
| Texto cartão | `text-red-950` / `dark:text-red-100` |
| Borda cartão | `border-red-300` / `dark:border-red-500/45` |
| Glow sombra | `rgba(220, 38, 38, 0.18)` |

### Login / marca

- Fundo login: `#0a0a0a`
- Glow azul atmosférico (só login): `rgba(43, 115, 235, 0.16)` — não é cor de produto
- Glow vermelho sutil: `rgba(220, 38, 38, 0.10)`

---

## 3. Polygonus

### Hex canônicos

| Papel | Hex | Notas |
|-------|-----|--------|
| Accent (azul) | `#2b73eb` | Realce principal / glow / ring do projeto |
| Highlight (amarelo) | `#e8e67a` | Header bar, Homologações, nested ativo |
| Highlight hover/borda | `#d4d269` | Borda do amarelo |
| Texto sobre amarelo | `#141824` | Quase preto azulado |
| Brand muted claro | `#e8f0fe` | Azul muito claro |
| Brand muted escuro | `#1a2d52` | Azul navy |

### Shell (`PROJECT_THEMES.polygonus`)

| Token | Valor |
|-------|--------|
| `accent` | `#2b73eb` |
| `highlight` | `#e8e67a` |
| `mainContentGlow` | `#2b73eb` |
| Cartão ativo | `bg-blue-50` / `dark:bg-blue-900/40` |
| Texto | `text-blue-950` / `dark:text-blue-100` |
| Borda | `border-blue-300` / `dark:border-blue-400/50` |
| Glow sombra | `rgba(43, 115, 235, 0.18)` |

### Nav / homologações

- Item ativo canal: azul (`blue-100` / `blue-800` claro · `blue-900/40` / `blue-300` escuro)
- Nested / Homologações ativo: fundo `#e8e67a`, texto `#141824`

---

## 4. Anihype

### Hex canônicos

| Papel | Hex | Notas |
|-------|-----|--------|
| Accent (magenta) | `#ff007f` | `project-themes.ts` (glow / shell) |
| Accent CSS | `#ff0080` | `[data-theme="anihype"]` em `index.css` (quase idêntico) |
| Highlight (violeta) | `#c026ff` | Segundo realce (`PROJECT_THEMES`) |
| Brand muted claro | `#fff0f7` | `index.css` |
| Brand muted escuro | `#1a0010` | `index.css` |
| Nested ativo claro | violet-100 / violet-900 | classes Tailwind |
| Nested ativo escuro | `violet-500/30` / `violet-100` | |
| Homologações ativo | `amber-300` (#fcd34d) | texto `#1a1008` |
| Homologações escuro | `amber-400/55` | |
| Inset frame | `rgba(122, 0, 255, 0.2)` | violeta no shadow |

### Shell (`PROJECT_THEMES.anihype`)

| Token | Valor |
|-------|--------|
| `accent` | `#ff007f` |
| `highlight` | `#c026ff` |
| `mainContentGlow` | `#ff007f` |
| Cartão ativo | `bg-pink-50` / `dark:bg-pink-900/40` |
| Texto | `text-pink-950` / `dark:text-pink-100` |
| Borda | `border-pink-300` / `dark:border-pink-400/50` |
| Glow sombra | `rgba(255, 0, 127, 0.16)` |

---

## 5. Cores semânticas de UI (status / ações)

Usadas nas listas, badges e botões (independentes do projeto):

| Semântica | Claro / tipico | Escuro / tipico |
|-----------|----------------|-----------------|
| Passou / ok | `emerald-600` `#059669` sólido, texto branco | igual |
| Falhou / erro | `red-600` `#dc2626` sólido | igual |
| Pendente / neutro | borda `gray-700`, fundo `#1a1a1a`, texto `gray-400` | (mesmo padrão nas tabelas) |
| Rascunho / aviso | `amber-300` / `amber-400` | `amber-300` |
| Automatizado / info | `sky-400` | `sky-400` |
| Executar (play) | `green-600/20` + `green-400` | idem |
| Destrutivo | `bg-red-600` texto branco | idem |
| Primário neutro (Salvar) | fundo branco / texto preto | idem |

Badge “Perfil em configuração” (visitante):

- Claro: `bg-amber-100` + `text-amber-900` + borda `amber-600/35`
- Escuro: `bg-amber-500/15` + `text-amber-200` + borda `amber-500/35`

---

## 6. Resumo rápido (hex)

```
QA Desk     accent #dc2626 (claro) / #ef4444 (escuro)
Polygonus   azul #2b73eb · amarelo #e8e67a · texto/amarelo #141824
Anihype     magenta #ff007f · violeta #c026ff · homologação amber #fcd34d

Shell clara  bg #ffffff · fg #0f172a · card #f8fafc · border #e2e8f0
Shell escura bg #000000 · fg #f4f4f5 · card #09090b · border #27272a
```

Atualize este arquivo quando mudar `index.css`, `project-themes.ts` ou `projects.ts`.
