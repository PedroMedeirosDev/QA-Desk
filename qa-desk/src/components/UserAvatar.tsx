import { useAuth } from "@/auth/AuthProvider";
import { CURRENT_USER } from "@/config/user";
import { resolveCurrentUserAvatar } from "@/config/avatars";
import { cn } from "@/lib/utils";

export function UserAvatar({ className }: { className?: string }) {
  const { profile, isAdmin } = useAuth();
  const src = isAdmin ? resolveCurrentUserAvatar() : null;
  const name = profile?.displayName ?? CURRENT_USER.name;
  const initials = profile?.initials ?? CURRENT_USER.initials;

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn("size-8 shrink-0 rounded-full border border-border object-cover", className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold text-muted-foreground",
        className,
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}
