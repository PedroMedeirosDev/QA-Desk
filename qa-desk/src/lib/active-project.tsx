import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import {
  PROJECT_THEMES,
  resolveProjectTheme,
  type ActiveProjectId,
  type ProjectThemeTokens,
} from "@/config/project-themes";
import { getProject } from "@/config/projects";
import type { ProjectSlug } from "@/types/test-record";

type ActiveProjectContextValue = {
  /** Slug do projeto da rota atual */
  activeProject: ActiveProjectId;
  /** Tokens de realce do projeto ativo (ou QA Desk se null) */
  theme: ProjectThemeTokens;
  /** Tema neutro da marca (sempre vermelho/cinza) */
  brandTheme: ProjectThemeTokens;
  /** Config de catálogo do projeto ativo, se houver */
  project: ReturnType<typeof getProject>;
};

const ActiveProjectContext = createContext<ActiveProjectContextValue | null>(
  null,
);

/**
 * Sincroniza o projeto ativo com a rota (`/projects/:project`).
 * Expõe tema dinâmico para sidebar + moldura do conteúdo.
 */
export function ActiveProjectProvider({
  project: slug,
  children,
}: {
  project: ProjectSlug;
  children: ReactNode;
}) {
  const value = useMemo<ActiveProjectContextValue>(() => {
    const activeProject: ActiveProjectId = slug;
    return {
      activeProject,
      theme: resolveProjectTheme(activeProject),
      brandTheme: PROJECT_THEMES.qaDesk,
      project: getProject(slug),
    };
  }, [slug]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--project-accent", value.theme.accent);
    root.style.setProperty("--project-highlight", value.theme.highlight);
    root.style.setProperty("--project-glow", value.theme.mainContentGlow);
    root.dataset.theme = getProject(slug)?.themeId ?? "default";
    return () => {
      root.style.removeProperty("--project-accent");
      root.style.removeProperty("--project-highlight");
      root.style.removeProperty("--project-glow");
    };
  }, [slug, value.theme.accent, value.theme.highlight, value.theme.mainContentGlow]);

  return (
    <ActiveProjectContext.Provider value={value}>
      {children}
    </ActiveProjectContext.Provider>
  );
}

export function useActiveProject() {
  const ctx = useContext(ActiveProjectContext);
  if (!ctx) {
    throw new Error("useActiveProject must be used within ActiveProjectProvider");
  }
  return ctx;
}

/** Versão segura para componentes fora do layout de projeto (ex.: login). */
export function useActiveProjectOptional() {
  return useContext(ActiveProjectContext);
}
