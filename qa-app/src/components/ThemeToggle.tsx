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

  return (
    <button
      type="button"
      onClick={toggleScheme}
      title={isDark ? "Tema claro" : "Tema escuro"}
      aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      aria-pressed={isDark}
      className={cn(
        "inline-flex items-center justify-center rounded-md transition-colors duration-200",
        variant === "toolbar" &&
          "border border-border p-2 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        variant === "footer" &&
          "p-1.5 text-muted-foreground transition-colors duration-300 hover:text-primary",
        className,
      )}
    >
      {isDark ? (
        <Sun className="size-4" strokeWidth={1.75} />
      ) : (
        <Moon className="size-4" strokeWidth={1.75} />
      )}
    </button>
  );
}
