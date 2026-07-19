import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserAvatar } from "@/components/UserAvatar";
import { cn } from "@/lib/utils";

export function UserBar({ className }: { className?: string }) {
  const { profile, isAdmin, authEnabled, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await signOut();
    if (authEnabled) navigate("/login", { replace: true });
  }

  const name = profile?.displayName ?? "Usuário";
  const roleLabel = isAdmin ? "QA · Admin" : "Visitante · Portfólio";

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2 border-l border-border pl-4",
        className,
      )}
    >
      <UserAvatar />
      <div className="hidden min-w-0 sm:block">
        <p className="truncate text-sm font-medium leading-tight">{name}</p>
        <p className="text-[0.65rem] text-muted-foreground">{roleLabel}</p>
      </div>

      <ThemeToggle className="ml-1" />

      {authEnabled && (
        <button
          type="button"
          onClick={() => void handleLogout()}
          title="Sair"
          aria-label="Sair"
          className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut className="size-4" />
        </button>
      )}
    </div>
  );
}
