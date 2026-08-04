/** Classes reutilizáveis para orientar ações por cor.
 * Vermelho (bg-red-* / text-red-*) só para destrutivo ou erro.
 */
export const actionBtn = {
  /** Primário: Salvar / Novo teste — alto contraste neutro */
  save: "border border-transparent bg-white text-black hover:bg-gray-200 disabled:opacity-50",
  /** Criar / adicionar algo novo (mesmo peso visual do Salvar) */
  create:
    "border border-transparent bg-white text-black shadow-sm hover:bg-gray-200 disabled:opacity-50",
  /** Executar automação (play) */
  run: "border border-green-500/50 bg-green-600/20 text-green-400 hover:bg-green-600/30 disabled:opacity-50",
  /** Homologação aprovada — outline sutil, não compete com Salvar */
  homologate:
    "border border-emerald-500/40 bg-transparent text-emerald-300/90 hover:bg-emerald-500/10",
  /** Checklist / sincronizar campanha */
  checklist:
    "border border-emerald-500/40 bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30",
  /** Botão sobre fundo brand (claro ou escuro) */
  onBrand:
    "border border-slate-300/80 bg-white text-slate-900 shadow-sm hover:bg-slate-50 dark:border-white/35 dark:bg-white/15 dark:text-foreground dark:hover:bg-white/25",
  /** Voltar / neutro */
  back: "border border-border bg-card text-foreground hover:bg-muted/60",
  /** Ghost / outline cinza (ações secundárias) */
  ghost:
    "border border-gray-700 bg-transparent text-gray-400 hover:text-white hover:bg-gray-800/40",
  /** Secundário / anexar */
  secondary: "surface-brand border hover:brightness-110",
  /** Desabilitado / em breve */
  disabled: "border text-muted-foreground opacity-50 cursor-not-allowed",
  /** Destrutivo (Excluir) — único uso de vermelho sólido em botões */
  danger:
    "border border-red-500/40 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50",
  /** Aba ativa */
  tabActive: "border-primary text-primary font-medium",
  /** Aba inativa */
  tabIdle: "border-transparent text-muted-foreground hover:text-foreground",
} as const;

export const actionBtnBase =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors outline-none";

/** Anel de foco teclado (espelha a regra global em index.css). */
export const focusRingClass =
  "outline-none focus-visible:ring-[0.125rem] focus-visible:ring-[var(--project-highlight-bg)] focus-visible:ring-offset-[0.125rem] focus-visible:ring-offset-[var(--background)]";
