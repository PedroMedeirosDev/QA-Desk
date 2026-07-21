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
  /** @deprecated alias → sidebarCardBg */
  sidebarBg: string;
};

/**
 * Esquema de cores por contexto.
 * Marca global QA Desk permanece vermelho/preto; isto só tinge o realce do projeto ativo.
 */
export const PROJECT_THEMES = {
  polygonus: {
    accent: "#2b73eb",
    highlight: "#e8e67a",
    sidebarCardBg: "bg-blue-900/40",
    mainContentGlow: "#2b73eb",
    sidebarText: "text-blue-100",
    sidebarBorder: "border-blue-400/50",
    cardShadow: "0 0 24px rgba(43, 115, 235, 0.22)",
    sidebarBg: "bg-blue-900/40",
  },
  anihype: {
    accent: "#ff007f",
    highlight: "#c026ff",
    sidebarCardBg: "bg-pink-900/40",
    mainContentGlow: "#ff007f",
    sidebarText: "text-pink-100",
    sidebarBorder: "border-pink-400/50",
    cardShadow: "0 0 24px rgba(255, 0, 127, 0.22)",
    sidebarBg: "bg-pink-900/40",
  },
  /** Padrão QA Desk — cartão inativo / shell neutra */
  qaDesk: {
    accent: "#ef4444",
    highlight: "#dc2626",
    sidebarCardBg: "bg-zinc-950",
    mainContentGlow: "#ef4444",
    sidebarText: "text-zinc-400",
    sidebarBorder: "border-zinc-800",
    cardShadow: "none",
    sidebarBg: "bg-zinc-950",
  },
} as const satisfies Record<string, ProjectThemeTokens>;

export function resolveProjectTheme(id: ActiveProjectId): ProjectThemeTokens {
  if (id === "polygonus") return PROJECT_THEMES.polygonus;
  if (id === "anihype") return PROJECT_THEMES.anihype;
  return PROJECT_THEMES.qaDesk;
}
