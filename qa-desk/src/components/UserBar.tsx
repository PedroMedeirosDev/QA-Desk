import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { PremiumTooltip } from "@/components/PremiumTooltip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserAvatar } from "@/components/UserAvatar";
import { useColorScheme } from "@/lib/color-scheme";
import { cn } from "@/lib/utils";

const actionBtnClass =
  "flex h-[2rem] w-[2rem] items-center justify-center rounded-md text-[var(--muted-foreground)] outline-none transition-colors duration-200 hover:bg-[var(--accent)] hover:text-[var(--foreground)]";

export function UserBar({ className }: { className?: string }) {
  const { profile, isAdmin, authEnabled, signOut } = useAuth();
  const { scheme } = useColorScheme();
  const navigate = useNavigate();

  async function handleLogout() {
    await signOut();
    if (authEnabled) navigate("/login", { replace: true });
  }

  const name = profile?.displayName ?? "Usuário";
  const roleLabel = isAdmin ? "QA · Admin" : "Visitante · Portfólio";
  const themeLabel = scheme === "dark" ? "Tema claro" : "Tema escuro";

  return (
    <div className={cn("flex shrink-0 items-center gap-[1rem]", className)}>
      <div className="flex items-center gap-[0.75rem]">
        <UserAvatar className="ring-1 ring-black/5 dark:ring-white/10" />
        <div className="hidden min-w-0 flex-col items-start sm:flex">
          <p className="truncate text-[0.875rem] font-semibold leading-none text-[var(--foreground)]">
            {name}
          </p>
          <p className="mt-[0.25rem] text-[0.75rem] font-medium text-[var(--muted-foreground)]">
            {roleLabel}
          </p>
        </div>
      </div>

      <div className="mx-[0.25rem] h-[1.5rem] w-px bg-[var(--border)]" aria-hidden />

      <div className="flex items-center gap-[0.25rem]">
        <PremiumTooltip label={themeLabel} side="bottom" align="end">
          <ThemeToggle variant="toolbar" className={actionBtnClass} />
        </PremiumTooltip>
        {authEnabled && (
          <PremiumTooltip label="Sair" side="bottom" align="end">
            <button
              type="button"
              onClick={() => void handleLogout()}
              aria-label="Sair"
              className={actionBtnClass}
            >
              <LogOut className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} />
            </button>
          </PremiumTooltip>
        )}
      </div>
    </div>
  );
}
