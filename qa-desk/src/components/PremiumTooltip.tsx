import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type TooltipSide = "top" | "bottom" | "left" | "right";
type TooltipAlign = "center" | "start" | "end";

/** Tooltip premium (Tailwind puro) — substitui o `title` nativo do browser. */
export function PremiumTooltip({
  label,
  children,
  side = "top",
  /** `end` / `start` deslocam o balão; seta acompanha. */
  align = "center",
  /** Texto longo (quebra linha). */
  wide = false,
  className,
}: {
  label: string;
  children: ReactNode;
  side?: TooltipSide;
  align?: TooltipAlign;
  wide?: boolean;
  className?: string;
}) {
  const horizontal = side === "left" || side === "right";

  return (
    <div
      className={cn(
        "group relative inline-flex max-w-full items-center justify-center",
        className,
      )}
    >
      {children}
      <div
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 rounded px-2.5 py-1.5 text-xs font-medium shadow-md",
          "bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900",
          "opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100",
          wide ? "max-w-[18rem] whitespace-normal text-left leading-snug" : "whitespace-nowrap",
          side === "top" && "bottom-full mb-2",
          side === "bottom" && "top-full mt-2",
          side === "left" && "right-full mr-2",
          side === "right" && "left-full ml-2",
          !horizontal && align === "center" && "left-1/2 -translate-x-1/2",
          !horizontal && align === "end" && "right-0",
          !horizontal && align === "start" && "left-0",
          horizontal && align === "center" && "top-1/2 -translate-y-1/2",
          horizontal && align === "end" && "bottom-0",
          horizontal && align === "start" && "top-0",
        )}
      >
        {label}
        <div
          aria-hidden
          className={cn(
            "absolute border-[5px] border-transparent",
            side === "top" && "top-full border-t-slate-800 dark:border-t-slate-100",
            side === "bottom" && "bottom-full border-b-slate-800 dark:border-b-slate-100",
            side === "left" && "left-full border-l-slate-800 dark:border-l-slate-100",
            side === "right" && "right-full border-r-slate-800 dark:border-r-slate-100",
            !horizontal && align === "center" && "left-1/2 -translate-x-1/2",
            !horizontal && align === "end" && "right-3",
            !horizontal && align === "start" && "left-3",
            horizontal && align === "center" && "top-1/2 -translate-y-1/2",
            horizontal && align === "end" && "bottom-3",
            horizontal && align === "start" && "top-3",
          )}
        />
      </div>
    </div>
  );
}

/** Hover sutil para linhas de tabela (testes / homologações). */
export const tableRowHoverClass =
  "transition-colors duration-200 hover:bg-black/5 dark:hover:bg-white/[0.03]";
