import { MonitorSmartphone, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AUTOMATION_RUNNER_SHORT,
  type AutomationRunner,
} from "@/lib/automation-runners";

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
      {(
        [
          { id: "maestro" as const, icon: Smartphone },
          { id: "playwright" as const, icon: MonitorSmartphone },
        ] as const
      ).map(({ id, icon: Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            title={
              id === "maestro"
                ? "Emulador / Maestro"
                : "Web / Playwright"
            }
            onClick={() => onChange(id)}
            className={cn(
              "inline-flex items-center gap-1 rounded-[5px] font-medium transition-colors",
              pad,
              active
                ? id === "maestro"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-sky-500/20 text-sky-300"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <Icon className={size === "xs" ? "size-3" : "size-3.5"} />
            {AUTOMATION_RUNNER_SHORT[id]}
          </button>
        );
      })}
    </div>
  );
}
