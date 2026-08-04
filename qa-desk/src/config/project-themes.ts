import type { ProjectSlug } from "@/types/test-record";

/** Projeto ativo na shell; `null` = marca QA Desk (sem destaque de subprojeto). */
export type ActiveProjectId = ProjectSlug | null;

export type ProjectThemeTokens = {
  /** Cor de realce principal (borda do conteúdo, ring) */
  accent: string;
  /** Destaque secundário (borda / glow do logo) */
  highlight: string;
  /** Fundo do cartão de projeto na sidebar (classe Tailwind) */
  sidebarCardBg: string;
  /** Brilho do contêiner principal */
  mainContentGlow: string;
  /** Texto do cartão selecionado */
  sidebarText: string;
  /** Borda do cartão selecionado */
  sidebarBorder: string;
  /** Sombra/glow CSS do cartão ativo */
  cardShadow: string;
  /** Offset do ring do logo (claro / escuro) */
  logoRingOffset: string;
  /** @deprecated alias → sidebarCardBg */
  sidebarBg: string;
};

/**
 * Esquema de cores por contexto.
 * Marca global QA Desk permanece vermelho/preto; isto só tinge o realce do projeto ativo.
 * Classes usam variantes `dark:` para o tema claro da sidebar.
 */
export const PROJECT_THEMES = {
  polygonus: {
    accent: "#2b73eb",
    highlight: "#e8e67a",
    sidebarCardBg: "bg-blue-50 dark:bg-blue-900/40",
    mainContentGlow: "#2b73eb",
    sidebarText: "text-blue-950 dark:text-blue-100",
    sidebarBorder: "border-blue-300 dark:border-blue-400/50",
    cardShadow: "0 0 20px rgba(43, 115, 235, 0.18)",
    logoRingOffset: "ring-offset-slate-50 dark:ring-offset-zinc-950",
    sidebarBg: "bg-blue-50 dark:bg-blue-900/40",
  },
  anihype: {
    accent: "#ff007f",
    highlight: "#c026ff",
    sidebarCardBg: "bg-pink-50 dark:bg-pink-900/40",
    mainContentGlow: "#ff007f",
    sidebarText: "text-pink-950 dark:text-pink-100",
    sidebarBorder: "border-pink-300 dark:border-pink-400/50",
    cardShadow: "0 0 20px rgba(255, 0, 127, 0.16)",
    logoRingOffset: "ring-offset-slate-50 dark:ring-offset-zinc-950",
    sidebarBg: "bg-pink-50 dark:bg-pink-900/40",
  },
  /** Projeto QA Desk (dogfood) — marca vermelha */
  desk: {
    accent: "#ef4444",
    highlight: "#dc2626",
    sidebarCardBg: "bg-red-50 dark:bg-red-950/35",
    mainContentGlow: "#ef4444",
    sidebarText: "text-red-950 dark:text-red-100",
    sidebarBorder: "border-red-300 dark:border-red-500/45",
    cardShadow: "0 0 20px rgba(220, 38, 38, 0.18)",
    logoRingOffset: "ring-offset-slate-50 dark:ring-offset-zinc-950",
    sidebarBg: "bg-red-50 dark:bg-red-950/35",
  },
  /** Padrão QA Desk — cartão inativo / shell neutra */
  qaDesk: {
    accent: "#ef4444",
    highlight: "#dc2626",
    sidebarCardBg: "bg-white dark:bg-zinc-950",
    mainContentGlow: "#ef4444",
    sidebarText: "text-slate-600 dark:text-zinc-400",
    sidebarBorder: "border-slate-200 dark:border-zinc-800",
    cardShadow: "none",
    logoRingOffset: "ring-offset-slate-50 dark:ring-offset-zinc-950",
    sidebarBg: "bg-white dark:bg-zinc-950",
  },
} as const satisfies Record<string, ProjectThemeTokens>;

export function resolveProjectTheme(id: ActiveProjectId): ProjectThemeTokens {
  if (id === "polygonus") return PROJECT_THEMES.polygonus;
  if (id === "anihype") return PROJECT_THEMES.anihype;
  if (id === "desk") return PROJECT_THEMES.desk;
  return PROJECT_THEMES.qaDesk;
}
