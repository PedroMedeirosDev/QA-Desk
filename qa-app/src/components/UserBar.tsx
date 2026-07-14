import { LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserAvatar } from "@/components/UserAvatar";
import { CURRENT_USER } from "@/config/user";
import { cn } from "@/lib/utils";

export function UserBar({ className }: { className?: string }) {

  function handleLogout() {
    window.alert("Logout será implementado na fase de autenticação.");
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2 border-l border-border pl-4",
        className,
      )}
    >
      <UserAvatar />
      <div className="hidden min-w-0 sm:block">
        <p className="truncate text-sm font-medium leading-tight">{CURRENT_USER.name}</p>
        <p className="text-[0.65rem] text-muted-foreground">QA · Admin</p>
      </div>

      <ThemeToggle className="ml-1" />

      <button
        type="button"
        onClick={handleLogout}
        title="Sair"
        aria-label="Sair"
        className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );
}
