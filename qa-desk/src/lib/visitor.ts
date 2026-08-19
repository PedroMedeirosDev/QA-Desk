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

const ADMIN_HOME = "/projects/polygonus/app";

/** Visitante nunca herda a URL do login anterior (admin). */
export function postLoginPath(isVisitor: boolean, from?: string | null): string {
  if (isVisitor) return VISITOR_HOME_PATH;
  if (from && from !== "/login" && from !== VISITOR_HOME_PATH) return from;
  return ADMIN_HOME;
}
