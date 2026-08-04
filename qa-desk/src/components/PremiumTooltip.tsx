import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Tooltip premium (Tailwind puro) — substitui o `title` nativo do browser. */
export function PremiumTooltip({
  label,
  children,
  side = "top",
  /** `end` evita vazamento na coluna de Ações (direita da tabela). */
  align = "center",
  className,
}: {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom";
  align?: "center" | "end";
  className?: string;
}) {
  const atEnd = align === "end";

  return (
    <div
      className={cn(
        "group relative inline-flex items-center justify-center",
        className,
      )}
    >
      {children}
      <div
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 whitespace-nowrap rounded px-2.5 py-1.5 text-xs font-medium shadow-md",
          "bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900",
          "opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100",
          side === "top" ? "bottom-full mb-2" : "top-full mt-2",
          atEnd ? "right-0" : "left-1/2 -translate-x-1/2",
        )}
      >
        {label}
        <div
          aria-hidden
          className={cn(
            "absolute border-[5px] border-transparent",
            atEnd ? "right-3" : "left-1/2 -translate-x-1/2",
            side === "top"
              ? "top-full border-t-slate-800 dark:border-t-slate-100"
              : "bottom-full border-b-slate-800 dark:border-b-slate-100",
          )}
        />
      </div>
    </div>
  );
}

/** Hover sutil para linhas de tabela (testes / homologações). */
export const tableRowHoverClass =
  "transition-colors duration-200 hover:bg-black/5 dark:hover:bg-white/[0.03]";
