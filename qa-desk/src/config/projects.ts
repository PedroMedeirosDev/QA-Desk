import type { ProjectSlug } from "@/types/test-record";

export type ProjectThemeId = "default" | "desk" | "polygonus" | "anihype";

export interface ProjectConfig {
  slug: ProjectSlug;
  label: string;
  logoFile: string;
  themeId: ProjectThemeId;
  accent: {
    ring: string;
    bg: string;
    bgActive: string;
    text: string;
    border: string;
    /** Barra do header (borda esquerda) */
    headerBar: string;
    /** Moldura da área principal */
    contentFrame: string;
    /** Subitens (canais, homologações) no projeto ativo */
    subNav: {
      rail: string;
      active: string;
      activeNested: string;
      hover: string;
      idle: string;
      /** Item Homologações — amarelo com texto escuro */
      homologationsIdle: string;
      homologationsHover: string;
      homologationsActive: string;
    };
  };
  description?: string;
}

export const PROJECTS: ProjectConfig[] = [
  {
    slug: "desk",
    label: "QA Desk",
    logoFile: "qa_desk",
    themeId: "desk",
    accent: {
      ring: "ring-red-500/40",
      bg: "bg-red-950/40",
      bgActive: "bg-red-900/30 text-red-400 border-red-500/35",
      text: "text-red-400",
      border: "border-red-500/35",
      headerBar: "border-l-red-500",
      contentFrame:
        "border border-red-500/35 shadow-[inset_0_0_0_1px_rgba(220,38,38,0.12)]",
      subNav: {
        rail: "border-slate-200 dark:border-red-500/35",
        active: "bg-red-100 font-semibold text-red-800 dark:bg-red-900/40 dark:text-red-300",
        activeNested:
          "bg-[var(--project-highlight-bg)] font-medium text-[var(--project-highlight-text)] shadow-sm border border-[var(--project-highlight-border)]",
        hover:
          "hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-red-900/25 dark:hover:text-red-200",
        idle: "text-slate-600 dark:text-slate-400",
        homologationsIdle: "text-slate-600 dark:text-slate-400",
        homologationsHover:
          "hover:bg-[var(--project-highlight-bg)] hover:text-[var(--project-highlight-text)] hover:font-medium hover:border hover:border-[var(--project-highlight-border)]",
        homologationsActive:
          "bg-[var(--project-highlight-bg)] font-medium text-[var(--project-highlight-text)] shadow-sm border border-[var(--project-highlight-border)]",
      },
    },
    description: "Portfólio & automação",
  },
  {
    slug: "polygonus",
    label: "Polygonus",
    logoFile: "polygonus_logo",
    themeId: "polygonus",
    accent: {
      ring: "ring-blue-500/40",
      bg: "bg-blue-950/40",
      bgActive: "bg-blue-900/30 text-blue-400 border-blue-500/35",
      text: "text-blue-400",
      border: "border-blue-500/35",
      headerBar: "border-l-[#e8e67a]",
      contentFrame: "border border-[#2b73eb]/35 shadow-[inset_0_0_0_1px_rgba(232,230,122,0.12)]",
      subNav: {
        rail: "border-slate-200 dark:border-blue-500/35",
        active: "bg-blue-100 font-semibold text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
        activeNested:
          "bg-[var(--project-highlight-bg)] font-medium text-[var(--project-highlight-text)] shadow-sm border border-[var(--project-highlight-border)]",
        hover:
          "hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-blue-900/25 dark:hover:text-blue-200",
        idle: "text-slate-600 dark:text-slate-400",
        homologationsIdle: "text-slate-600 dark:text-slate-400",
        homologationsHover:
          "hover:bg-[var(--project-highlight-bg)] hover:text-[var(--project-highlight-text)] hover:font-medium hover:border hover:border-[var(--project-highlight-border)]",
        homologationsActive:
          "bg-[var(--project-highlight-bg)] font-medium text-[var(--project-highlight-text)] shadow-sm border border-[var(--project-highlight-border)]",
      },
    },
    description: "Gestão Acadêmica",
  },
  {
    slug: "anihype",
    label: "Anihype",
    logoFile: "anihype_logo",
    themeId: "anihype",
    accent: {
      ring: "ring-pink-500/40",
      bg: "bg-pink-950/40",
      bgActive: "bg-pink-900/30 text-pink-400 border-pink-500/35",
      text: "text-pink-400",
      border: "border-pink-500/35",
      headerBar: "border-l-pink-500",
      contentFrame:
        "border border-pink-500/40 shadow-[inset_0_0_0_1px_rgba(122,0,255,0.2)]",
      subNav: {
        rail: "border-slate-200 dark:border-pink-500/35",
        active: "bg-pink-100 font-medium text-pink-800 dark:bg-pink-900/40 dark:text-pink-300",
        activeNested:
          "bg-[var(--project-highlight-bg)] font-medium text-[var(--project-highlight-text)] shadow-sm border border-[var(--project-highlight-border)]",
        hover:
          "hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-pink-900/25 dark:hover:text-pink-200",
        idle: "text-slate-600 dark:text-neutral-400",
        homologationsIdle: "text-slate-600 dark:text-neutral-400",
        homologationsHover:
          "hover:bg-[var(--project-highlight-bg)] hover:text-[var(--project-highlight-text)] hover:font-medium hover:border hover:border-[var(--project-highlight-border)]",
        homologationsActive:
          "bg-[var(--project-highlight-bg)] font-medium text-[var(--project-highlight-text)] shadow-sm border border-[var(--project-highlight-border)]",
      },
    },
    description: "Plataforma de anime",
  },
];

export function getProject(slug: ProjectSlug): ProjectConfig | undefined {
  return PROJECTS.find((p) => p.slug === slug);
}
