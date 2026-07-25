/** Classes reutilizáveis para orientar ações por cor */
export const actionBtn = {
  /** Salvar, confirmar dados */
  save: "bg-red-600 text-white hover:bg-red-700 disabled:opacity-50",
  /** Criar / adicionar algo novo (marca QA Desk) */
  create:
    "border border-red-500/40 bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:opacity-50",
  /** Executar automação Maestro */
  run: "bg-red-600 text-white hover:bg-red-700 disabled:opacity-50",
  /** Homologação aprovada */
  homologate:
    "border border-emerald-500/40 bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30",
  /** Checklist / sincronizar campanha (gera ou atualiza registros) */
  checklist:
    "border border-emerald-500/40 bg-emerald-600 text-white shadow-sm hover:bg-emerald-500",
  /** Botão sobre fundo brand (claro ou escuro) */
  onBrand:
    "border border-slate-300/80 bg-white text-slate-900 shadow-sm hover:bg-slate-50 dark:border-white/35 dark:bg-white/15 dark:text-foreground dark:hover:bg-white/25",
  /** Voltar / neutro */
  back: "border border-border bg-card text-foreground hover:bg-muted/60",
  /** Secundário / anexar */
  secondary: "surface-brand border hover:brightness-110",
  /** Desabilitado / em breve */
  disabled: "border text-muted-foreground opacity-50 cursor-not-allowed",
  /** Aba ativa */
  tabActive: "border-primary text-primary font-medium",
  /** Aba inativa */
  tabIdle: "border-transparent text-muted-foreground hover:text-foreground",
} as const;

export const actionBtnBase =
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors h-9 px-4";
