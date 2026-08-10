export type UserRole = "admin" | "visitor";

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  actor: string;
  initials: string;
  /** Path no bucket avatars (ex.: uuid/avatar.jpg) */
  avatarPath?: string | null;
  /** URL pública do Storage, se houver */
  avatarUrl?: string | null;
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
