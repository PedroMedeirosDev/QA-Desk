import { Moon, Sun } from "lucide-react";
import { useColorScheme } from "@/lib/color-scheme";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  className?: string;
  /** toolbar: userbar · footer: alinhado aos ícones sociais */
  variant?: "toolbar" | "footer";
};

export function ThemeToggle({ className, variant = "toolbar" }: ThemeToggleProps) {
  const { scheme, toggleScheme } = useColorScheme();
  const isDark = scheme === "dark";
  const label = isDark ? "Tema claro" : "Tema escuro";

  return (
    <button
      type="button"
      onClick={toggleScheme}
      aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      aria-pressed={isDark}
      className={cn(
        "inline-flex items-center justify-center rounded-md transition-colors duration-200",
        variant === "toolbar" &&
          "h-[2rem] w-[2rem] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
        variant === "footer" &&
          "p-1.5 text-muted-foreground transition-colors duration-300 hover:text-primary",
        className,
      )}
    >
      {isDark ? (
        <Sun className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} />
      ) : (
        <Moon className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} />
      )}
      <span className="sr-only">{label}</span>
    </button>
  );
}
