import type { ProjectSlug } from "@/types/test-record";

/** Canal de produto dentro de um projeto (ex.: App, WEB, PORTAL) */
export type ProductChannel = "app" | "web" | "portal";

export interface ChannelConfig {
  id: ProductChannel;
  label: string;
  description?: string;
}

export const CHANNEL_LABELS: Record<ProductChannel, string> = {
  app: "App",
  web: "WEB",
  portal: "PORTAL",
};

/**
 * Maestro (emulador) só no App.
 * WEB e PORTAL usam apenas Playwright.
 * Sem canal (= legado) → trata como App.
 */
export function channelSupportsMaestro(
  channel?: ProductChannel | null,
): boolean {
  return channel !== "web" && channel !== "portal";
}

/** Subcategorias por projeto — adicione canais conforme escalar */
export const PROJECT_CHANNELS: Partial<Record<ProjectSlug, ChannelConfig[]>> = {
  polygonus: [
    {
      id: "app",
      label: "App",
      description: "Mobile / desktop no app — Maestro (+ Playwright quando houver)",
    },
    {
      id: "web",
      label: "WEB",
      description: "Aplicações web — Playwright",
    },
    {
      id: "portal",
      label: "PORTAL",
      description: "Portal escolar — Playwright",
    },
  ],
};

export function getProjectChannels(project: ProjectSlug): ChannelConfig[] {
  return PROJECT_CHANNELS[project] ?? [];
}

export function isValidChannel(project: ProjectSlug, channel: string): channel is ProductChannel {
  return getProjectChannels(project).some((c) => c.id === channel);
}

export function defaultChannel(project: ProjectSlug): ProductChannel | undefined {
  return getProjectChannels(project)[0]?.id;
}
