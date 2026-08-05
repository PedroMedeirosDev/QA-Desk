import { ChevronsDownUp, ChevronsUpDown, Leaf } from "lucide-react";
import { DesignCheckbox } from "@/components/DesignCheckbox";
import { PremiumTooltip } from "@/components/PremiumTooltip";
import { cn } from "@/lib/utils";

export function SuiteListControls({
  onExpandAll,
  onCollapseAll,
  onCollapseGreens,
  playwrightHeaded,
  onPlaywrightHeadedChange,
  className,
}: {
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onCollapseGreens: () => void;
  /** Quando definido, mostra o toggle headed/headless do Playwright */
  playwrightHeaded?: boolean;
  onPlaywrightHeadedChange?: (headed: boolean) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <button
        type="button"
        onClick={onExpandAll}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ChevronsUpDown className="size-3.5" />
        Expandir tudo
      </button>
      <button
        type="button"
        onClick={onCollapseAll}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ChevronsDownUp className="size-3.5" />
        Recolher tudo
      </button>
      <PremiumTooltip label="Recolhe suites com 100% passou" side="bottom">
        <button
          type="button"
          onClick={onCollapseGreens}
          className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 px-2 py-1 text-xs text-emerald-400/90 transition-colors hover:bg-emerald-500/10"
        >
          <Leaf className="size-3.5" />
          Recolher verdes
        </button>
      </PremiumTooltip>
      {typeof playwrightHeaded === "boolean" && onPlaywrightHeadedChange && (
        <PremiumTooltip
          label={
            playwrightHeaded
              ? "Chrome visível (melhor p/ Cloudflare). Desmarque para headless."
              : "Headless — mais rápido; Cloudflare na amostra pode falhar."
          }
          side="bottom"
          wide
        >
          <div className="ml-1">
            <DesignCheckbox
              checked={!playwrightHeaded}
              onChange={(e) => onPlaywrightHeadedChange(!e.target.checked)}
              label={
                <span className="text-xs text-muted-foreground">Headless</span>
              }
            />
          </div>
        </PremiumTooltip>
      )}
    </div>
  );
}
