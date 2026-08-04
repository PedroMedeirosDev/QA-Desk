import type { ProductChannel } from "@/config/channels";
import { defaultChannel, getProjectChannels } from "@/config/channels";
import type { ProjectSlug } from "@/types/test-record";

export type ProjectRouteView =
  | "list"
  | "bugs-list"
  | "editor"
  | "homologation"
  | "homologations-list"
  | "kb-curation"
  | "dashboard"
  | "api-suite";

export interface ParsedProjectRoute {
  view: ProjectRouteView;
  channel?: ProductChannel;
  id?: string;
  homSlug?: string;
  isNew?: boolean;
  /** Ao criar via /bugs/novo */
  editorKind?: "bug" | "teste";
  redirectTo?: string;
}

export function projectRootPath(project: ProjectSlug): string {
  return `/projects/${project}`;
}

export function projectBasePath(project: ProjectSlug, channel?: ProductChannel): string {
  const channels = getProjectChannels(project);
  if (channels.length > 0) {
    const ch = channel ?? defaultChannel(project)!;
    return `/projects/${project}/${ch}`;
  }
  return projectRootPath(project);
}

export function projectListPath(project: ProjectSlug, channel?: ProductChannel): string {
  return projectBasePath(project, channel);
}

export function projectNewPath(project: ProjectSlug, channel?: ProductChannel): string {
  return `${projectBasePath(project, channel)}/novo`;
}

export function projectBugsListPath(project: ProjectSlug, channel?: ProductChannel): string {
  return `${projectBasePath(project, channel)}/bugs`;
}

export function projectNewBugPath(project: ProjectSlug, channel?: ProductChannel): string {
  return `${projectBugsListPath(project, channel)}/novo`;
}

export function projectBugDetailPath(
  project: ProjectSlug,
  id: string,
  channel?: ProductChannel,
): string {
  return `${projectBugsListPath(project, channel)}/${id}`;
}

export function projectDetailPath(
  project: ProjectSlug,
  id: string,
  channel?: ProductChannel,
): string {
  return `${projectBasePath(project, channel)}/${id}`;
}

/** Lista única — todas as seções do projeto */
export function projectHomologationsListPath(project: ProjectSlug): string {
  return `${projectRootPath(project)}/homologacoes`;
}

export function projectHomologationPath(project: ProjectSlug, homSlug: string): string {
  return `${projectRootPath(project)}/homologacao/${homSlug}`;
}

export function projectDashboardPath(project: ProjectSlug): string {
  return `${projectRootPath(project)}/dashboard`;
}

export function projectKbCurationPath(project: ProjectSlug): string {
  return `${projectRootPath(project)}/curadoria-kb`;
}

export function projectApiSuitePath(project: ProjectSlug): string {
  return `${projectRootPath(project)}/suite-api`;
}

export function isHomologationPath(project: ProjectSlug, pathname: string): boolean {
  const root = projectRootPath(project);
  return (
    pathname === `${root}/homologacoes` || pathname.startsWith(`${root}/homologacao/`)
  );
}

export function isDashboardPath(project: ProjectSlug, pathname: string): boolean {
  return pathname === projectDashboardPath(project);
}

export function isKbCurationPath(project: ProjectSlug, pathname: string): boolean {
  return pathname === projectKbCurationPath(project);
}

export function isApiSuitePath(project: ProjectSlug, pathname: string): boolean {
  return pathname === projectApiSuitePath(project);
}

export function parseProjectRoute(project: ProjectSlug, rest?: string): ParsedProjectRoute {
  const channels = getProjectChannels(project);

  if (!rest) {
    if (project === "desk") {
      return { view: "api-suite", redirectTo: projectApiSuitePath(project) };
    }
    if (channels.length > 0) {
      return { view: "list", redirectTo: projectListPath(project, defaultChannel(project)) };
    }
    return { view: "list" };
  }

  const segments = rest.split("/");
  const [first, second, third] = segments;

  if (channels.length > 0) {
    // Rotas de projeto (sem canal)
    if (first === "dashboard") {
      return { view: "dashboard" };
    }
    if (first === "curadoria-kb") {
      return { view: "kb-curation" };
    }
    if (first === "suite-api") {
      return { view: "api-suite" };
    }
    if (first === "homologacoes") {
      return { view: "homologations-list" };
    }
    if (first === "homologacao") {
      if (!second) {
        return { view: "homologations-list", redirectTo: projectHomologationsListPath(project) };
      }
      return { view: "homologation", homSlug: second };
    }

    const match = channels.find((c) => c.id === first);
    if (!match) {
      return { view: "list", redirectTo: projectListPath(project, defaultChannel(project)) };
    }
    const channel = match.id;

    // Legado: /app/homologacoes → /homologacoes
    if (second === "homologacoes") {
      return { view: "homologations-list", redirectTo: projectHomologationsListPath(project) };
    }
    if (second === "homologacao") {
      if (!third) {
        return { view: "homologations-list", redirectTo: projectHomologationsListPath(project) };
      }
      return { view: "homologation", homSlug: third, redirectTo: projectHomologationPath(project, third) };
    }

    if (!second) return { view: "list", channel };
    if (second === "bugs") {
      if (!third) return { view: "bugs-list", channel };
      if (third === "novo") return { view: "editor", channel, isNew: true, editorKind: "bug" };
      return { view: "editor", channel, id: third, editorKind: "bug" };
    }
    if (second === "novo") return { view: "editor", channel, isNew: true, editorKind: "teste" };
    return { view: "editor", channel, id: second, editorKind: "teste" };
  }

  // Projetos sem canais (ex.: desk) — suite-api é a casa
  if (first === "suite-api") return { view: "api-suite" };
  if (project === "desk") {
    return { view: "api-suite", redirectTo: projectApiSuitePath(project) };
  }
  if (first === "dashboard") return { view: "dashboard" };
  if (first === "curadoria-kb") return { view: "kb-curation" };
  if (first === "homologacoes") return { view: "homologations-list" };
  if (first === "homologacao") {
    if (!second) {
      return { view: "homologations-list", redirectTo: projectHomologationsListPath(project) };
    }
    return { view: "homologation", homSlug: second };
  }
  if (first === "novo") return { view: "editor", isNew: true };
  return { view: "editor", id: first };
}

