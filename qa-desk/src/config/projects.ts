import type { ProjectSlug } from "@/types/test-record";

export type ProjectThemeId = "default" | "polygonus" | "anihype";

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
          "bg-[#e8e67a]/95 font-medium text-[#141824] shadow-sm border border-[#d4d269]/60",
        hover:
          "hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-blue-900/25 dark:hover:text-blue-200",
        idle: "text-slate-600 dark:text-slate-400",
        homologationsIdle: "text-slate-600 dark:text-slate-400",
        homologationsHover:
          "hover:bg-[#e8e67a]/80 hover:text-[#141824] hover:font-medium hover:border hover:border-[#d4d269]/50",
        homologationsActive:
          "bg-[#e8e67a] font-medium text-[#141824] shadow-sm border border-[#d4d269]/60",
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
          "bg-violet-100 font-medium text-violet-900 dark:bg-violet-500/30 dark:text-violet-100",
        hover:
          "hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-pink-900/25 dark:hover:text-pink-200",
        idle: "text-slate-600 dark:text-neutral-400",
        homologationsIdle: "text-slate-600 dark:text-neutral-400",
        homologationsHover:
          "hover:bg-amber-300/80 hover:text-[#1a1008] hover:font-medium hover:border hover:border-amber-400/50",
        homologationsActive:
          "bg-amber-300 font-medium text-[#1a1008] shadow-sm border border-amber-400/50 dark:bg-amber-400/55",
      },
    },
    description: "Plataforma de anime",
  },
];

export function getProject(slug: ProjectSlug): ProjectConfig | undefined {
  return PROJECTS.find((p) => p.slug === slug);
}
