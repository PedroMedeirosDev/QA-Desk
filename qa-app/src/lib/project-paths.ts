import type { ProductChannel } from "@/config/channels";
import { defaultChannel, getProjectChannels } from "@/config/channels";
import type { ProjectSlug } from "@/types/test-record";

export type ProjectRouteView = "list" | "editor" | "homologation" | "homologations-list";

export interface ParsedProjectRoute {
  view: ProjectRouteView;
  channel?: ProductChannel;
  id?: string;
  homSlug?: string;
  isNew?: boolean;
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

export function isHomologationPath(project: ProjectSlug, pathname: string): boolean {
  const root = projectRootPath(project);
  return (
    pathname === `${root}/homologacoes` || pathname.startsWith(`${root}/homologacao/`)
  );
}

export function parseProjectRoute(project: ProjectSlug, rest?: string): ParsedProjectRoute {
  const channels = getProjectChannels(project);

  if (!rest) {
    if (channels.length > 0) {
      return { view: "list", redirectTo: projectListPath(project, defaultChannel(project)) };
    }
    return { view: "list" };
  }

  const segments = rest.split("/");
  const [first, second, third] = segments;

  if (channels.length > 0) {
    // Rotas de homologação no nível do projeto (todas as seções)
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
    if (second === "novo") return { view: "editor", channel, isNew: true };
    return { view: "editor", channel, id: second };
  }

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
