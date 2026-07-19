/** Usuário mock — fase 1 sem auth (espelha src/config/user.ts) */
export const CURRENT_USER = {
  id: "pedro",
  name: "Pedro Medeiros",
  /** Nome exibido no histórico de execuções e auditoria */
  actor: "Pedro",
} as const;
