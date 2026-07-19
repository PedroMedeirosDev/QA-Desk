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
      ring: "ring-[#2b73eb]",
      bg: "bg-[#1a2d52]",
      bgActive: "bg-[#2b73eb] text-white shadow-md",
      text: "text-white",
      border: "border-[#2b73eb]",
      subNav: {
        rail: "border-[#2b73eb]/45",
        active: "bg-[#2b73eb]/45 font-semibold text-white",
        activeNested: "bg-[#e8e67a] font-medium text-[#141824] shadow-sm border border-[#d4d269]/50",
        hover: "hover:bg-[#1a4080] hover:text-slate-100",
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
      ring: "ring-[#ff0080]",
      bg: "bg-[#1a0010]",
      bgActive: "bg-gradient-to-r from-[#ff0080] to-[#7a00ff] text-white shadow-md shadow-fuchsia-500/20",
      text: "text-white",
      border: "border-fuchsia-500/40",
      subNav: {
        rail: "border-fuchsia-500/40",
        active: "bg-fuchsia-500/30 font-medium text-white",
        activeNested: "bg-violet-500/30 font-medium text-violet-100",
        hover: "hover:bg-fuchsia-500/20 hover:text-white",
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
