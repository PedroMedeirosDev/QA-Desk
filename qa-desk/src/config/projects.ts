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
        rail: "border-blue-500/35",
        active: "bg-blue-900/40 font-semibold text-blue-300",
        activeNested: "bg-[#e8e67a]/90 font-medium text-[#141824] shadow-sm border border-[#d4d269]/50",
        hover: "hover:bg-blue-900/25 hover:text-blue-200",
        idle: "text-slate-400",
        homologationsIdle: "text-slate-400",
        homologationsHover:
          "hover:bg-[#e8e67a]/70 hover:text-[#141824] hover:font-medium hover:border hover:border-[#d4d269]/40",
        homologationsActive:
          "bg-[#e8e67a] font-medium text-[#141824] shadow-sm border border-[#d4d269]/50",
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
        rail: "border-pink-500/35",
        active: "bg-pink-900/40 font-medium text-pink-300",
        activeNested: "bg-violet-500/30 font-medium text-violet-100",
        hover: "hover:bg-pink-900/25 hover:text-pink-200",
        idle: "text-neutral-400",
        homologationsIdle: "text-neutral-400",
        homologationsHover:
          "hover:bg-amber-400/45 hover:text-[#1a1008] hover:font-medium hover:border hover:border-amber-400/30",
        homologationsActive:
          "bg-amber-400/55 font-medium text-[#1a1008] shadow-sm border border-amber-400/40",
      },
    },
    description: "Plataforma de anime",
  },
];

export function getProject(slug: ProjectSlug): ProjectConfig | undefined {
  return PROJECTS.find((p) => p.slug === slug);
}
