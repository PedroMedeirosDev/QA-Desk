/** Rota inicial do modo visitante (neutra, sem projeto). */
export const VISITOR_HOME_PATH = "/welcome";

const VISITOR_BLOCKED_VIEWS = new Set([
  "kb-curation",
  "api-suite",
  "implantacoes-list",
  "implantacao",
  "dashboard",
  "homologations-list",
  "homologation",
]);

/** Rotas operacionais: visitante não carrega a página (evita 403 + toast). */
export function isVisitorBlockedView(view: string, isNew?: boolean): boolean {
  return Boolean(isNew) || VISITOR_BLOCKED_VIEWS.has(view);
}
