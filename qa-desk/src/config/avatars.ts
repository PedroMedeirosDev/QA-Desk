import { CURRENT_USER } from "@/config/user";

const avatarModules = import.meta.glob<string>(
  "@/assets/avatars/*.{png,jpg,jpeg,webp}",
  { eager: true, import: "default" },
);

export function getUserAvatarUrl(baseName: string): string | undefined {
  for (const [path, url] of Object.entries(avatarModules)) {
    const file = path.split("/").pop()?.replace(/\.[^.]+$/, "");
    if (file === baseName) return url;
  }
  return undefined;
}

/** Admin → pedro.* · visitante → visitante.* (se existir). */
export function resolveAvatarForRole(
  role: "admin" | "visitor" | undefined,
): string | undefined {
  if (role === "admin") {
    return getUserAvatarUrl(CURRENT_USER.avatarBaseName) ?? getUserAvatarUrl("pedro");
  }
  if (role === "visitor") {
    return getUserAvatarUrl("visitante");
  }
  return getUserAvatarUrl(CURRENT_USER.avatarBaseName);
}

export function resolveCurrentUserAvatar(): string | undefined {
  return getUserAvatarUrl(CURRENT_USER.avatarBaseName);
}
