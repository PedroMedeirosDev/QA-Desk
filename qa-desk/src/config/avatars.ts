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

/**
 * Preferência: URL pública do Storage (`avatarUrl`) → bundle local por role.
 */
export function resolveAvatarSrc(opts: {
  role?: "admin" | "visitor";
  avatarUrl?: string | null;
}): string | undefined {
  const remote = opts.avatarUrl?.trim();
  if (remote) return remote;
  return resolveAvatarForRole(opts.role);
}

/** Admin → pedro.* · visitante → visitante.* (se existir). Bundle local. */
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
