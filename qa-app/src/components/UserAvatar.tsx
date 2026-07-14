import { cn } from "@/lib/utils";
import { CURRENT_USER } from "@/config/user";
import { resolveCurrentUserAvatar } from "@/config/avatars";

export function UserAvatar({ className }: { className?: string }) {
  const src = resolveCurrentUserAvatar();

  if (src) {
    return (
      <img
        src={src}
        alt={CURRENT_USER.name}
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
      {CURRENT_USER.initials}
    </span>
  );
}
