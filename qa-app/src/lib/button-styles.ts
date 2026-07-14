/** Classes reutilizáveis para orientar ações por cor */
export const actionBtn = {
  /** Salvar, confirmar dados */
  save: "bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-50",
  /** Criar / adicionar algo novo */
  create:
    "border border-emerald-500/40 bg-emerald-600 text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50",
  /** Executar automação Maestro */
  run: "bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-50",
  /** Homologação aprovada */
  homologate:
    "border border-emerald-500/40 bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30",
  /** Checklist / sincronizar campanha (gera ou atualiza registros) */
  checklist:
    "border border-emerald-500/40 bg-emerald-600 text-white shadow-sm hover:bg-emerald-500",
  /** Botão visível sobre fundo brand (banner escuro) */
  onBrand:
    "border border-white/35 bg-white/15 text-foreground shadow-sm hover:bg-white/25",
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
