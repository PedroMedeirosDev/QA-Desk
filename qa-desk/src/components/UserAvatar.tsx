import { useAuth } from "@/auth/AuthProvider";
import { CURRENT_USER } from "@/config/user";
import { resolveAvatarSrc } from "@/config/avatars";
import { cn } from "@/lib/utils";

export function UserAvatar({
  className,
  editable = false,
  onPickFile,
  uploading = false,
}: {
  className?: string;
  /** Admin: clique abre seletor de arquivo (controlado pelo pai). */
  editable?: boolean;
  onPickFile?: () => void;
  uploading?: boolean;
}) {
  const { profile, isAdmin } = useAuth();
  const role = profile?.role;
  const src = resolveAvatarSrc({
    role,
    avatarUrl: profile?.avatarUrl,
  });
  const name = profile?.displayName ?? CURRENT_USER.name;
  const initials = profile?.initials ?? (isAdmin ? CURRENT_USER.initials : "V");

  const face = src ? (
    <img
      src={src}
      alt=""
      className={cn(
        "shrink-0 rounded-full border border-border object-cover",
        !className?.includes("size-") && "size-8",
        uploading && "opacity-60",
        className,
      )}
    />
  ) : (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold text-muted-foreground",
        !className?.includes("size-") && "size-8",
        uploading && "opacity-60",
        className,
      )}
      aria-hidden
    >
      {initials}
    </span>
  );

  if (editable && onPickFile) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!uploading) onPickFile();
        }}
        disabled={uploading}
        title="Alterar foto de perfil"
        aria-label={`Alterar foto de perfil de ${name}`}
        className={cn(
          "relative shrink-0 rounded-full outline-none transition-opacity",
          "hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
          "cursor-pointer disabled:cursor-wait",
        )}
      >
        {face}
        <span
          className="pointer-events-none absolute inset-0 rounded-full bg-black/0 transition-colors hover:bg-black/25"
          aria-hidden
        />
      </button>
    );
  }

  return (
    <span className="inline-flex shrink-0" aria-label={name}>
      {face}
    </span>
  );
}
