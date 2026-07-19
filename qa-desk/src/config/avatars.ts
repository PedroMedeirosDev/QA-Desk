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

export function resolveCurrentUserAvatar(): string | undefined {
  return getUserAvatarUrl(CURRENT_USER.avatarBaseName);
}
