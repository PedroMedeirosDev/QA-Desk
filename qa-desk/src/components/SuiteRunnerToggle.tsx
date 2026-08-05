import { MonitorSmartphone, Smartphone } from "lucide-react";
import { PremiumTooltip } from "@/components/PremiumTooltip";
import { cn } from "@/lib/utils";
import {
  AUTOMATION_RUNNER_SHORT,
  type AutomationRunner,
} from "@/lib/automation-runners";

const RUNNER_META = {
  maestro: {
    icon: Smartphone,
    tip: "Emulador / Maestro",
    activeClass: "bg-emerald-500/20 text-emerald-300",
  },
  playwright: {
    icon: MonitorSmartphone,
    tip: "Web / Playwright",
    activeClass: "bg-sky-500/20 text-sky-300",
  },
} as const;

/** Badge estática (ex.: WEB/PORTAL — só Playwright, sem toggle). */
export function SuiteRunnerBadge({
  runner,
  size = "sm",
  className,
}: {
  runner: AutomationRunner;
  size?: "sm" | "xs";
  className?: string;
}) {
  const meta = RUNNER_META[runner];
  const Icon = meta.icon;
  const pad = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs";
  return (
    <PremiumTooltip label={meta.tip}>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-[5px] font-medium",
          pad,
          meta.activeClass,
          className,
        )}
        aria-label={meta.tip}
      >
        <Icon className={size === "xs" ? "size-3" : "size-3.5"} />
        {AUTOMATION_RUNNER_SHORT[runner]}
      </span>
    </PremiumTooltip>
  );
}

export function SuiteRunnerToggle({
  value,
  onChange,
  className,
  size = "sm",
}: {
  value: AutomationRunner;
  onChange: (runner: AutomationRunner) => void;
  className?: string;
  size?: "sm" | "xs";
}) {
  const pad = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs";
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border border-border/80 bg-background/80 p-0.5",
        className,
      )}
      role="group"
      aria-label="Executor da suíte"
      onClick={(e) => e.stopPropagation()}
    >
      {(["maestro", "playwright"] as const).map((id) => {
        const meta = RUNNER_META[id];
        const Icon = meta.icon;
        const active = value === id;
        return (
          <PremiumTooltip key={id} label={meta.tip}>
            <button
              type="button"
              aria-pressed={active}
              aria-label={meta.tip}
              onClick={() => onChange(id)}
              className={cn(
                "inline-flex items-center gap-1 rounded-[5px] font-medium transition-colors",
                pad,
                active
                  ? meta.activeClass
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Icon className={size === "xs" ? "size-3" : "size-3.5"} />
              {AUTOMATION_RUNNER_SHORT[id]}
            </button>
          </PremiumTooltip>
        );
      })}
    </div>
  );
}
