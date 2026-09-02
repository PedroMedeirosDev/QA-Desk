/** Canal onde o QA cola o report ao Moacir (Polygonus). */
export const POLYGONUS_GESTOR_DISCORD_CHANNEL =
  "https://discord.com/channels/1339775689209024612/1524389844153925662";

export function discordUrlKind(url: string): "message" | "channel" | "other" {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace(/^www\./, "");
    if (!["discord.com", "canary.discord.com", "ptb.discord.com"].includes(host)) {
      return "other";
    }
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts[0] !== "channels") return "other";
    const ids = parts.slice(1);
    if (ids.length >= 3 && ids.slice(0, 3).every((p) => /^\d+$/.test(p))) return "message";
    if (ids.length === 2 && ids.every((p) => /^\d+$/.test(p))) return "channel";
    return "other";
  } catch {
    return "other";
  }
}
