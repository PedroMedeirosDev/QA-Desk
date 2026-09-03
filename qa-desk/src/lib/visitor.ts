import type { UserRole } from "@/types/profile";

/** Rota inicial do modo visitante (neutra, sem projeto). */
export const VISITOR_HOME_PATH = "/welcome";

/** Home do bot Grok: só Repasse Polygonus. */
export const BOT_HOME_PATH = "/projects/polygonus/repasse";

const VISITOR_BLOCKED_VIEWS = new Set([
  "kb-curation",
  "api-suite",
  "implantacoes-list",
  "implantacao",
  "gestor-cases",
  "dashboard",
]);

/** Rotas operacionais: visitante não carrega a página (evita 403 + toast). */
export function isVisitorBlockedView(view: string, isNew?: boolean): boolean {
  return Boolean(isNew) || VISITOR_BLOCKED_VIEWS.has(view);
}

/** Bot Grok: só a tela de Repasse. */
export function isBotBlockedView(view: string): boolean {
  return view !== "gestor-cases";
}

const ADMIN_HOME = "/projects/polygonus/app";

function resolveLoginRole(role: UserRole | boolean | undefined): UserRole {
  if (role === true || role === "visitor") return "visitor";
  if (role === "bot") return "bot";
  return "admin";
}

/** Visitante / bot não herdam a home do admin. */
export function postLoginPath(
  role: UserRole | boolean | undefined,
  from?: string | null,
): string {
  const resolved = resolveLoginRole(role);
  if (resolved === "visitor") return VISITOR_HOME_PATH;
  if (resolved === "bot") {
    if (from && from.startsWith(BOT_HOME_PATH)) return from;
    return BOT_HOME_PATH;
  }
  if (from && from !== "/login" && from !== VISITOR_HOME_PATH) return from;
  return ADMIN_HOME;
}
