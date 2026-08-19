import { Bot, Hand } from "lucide-react";
import { PremiumTooltip } from "@/components/PremiumTooltip";
import { cn } from "@/lib/utils";
import {
  EXECUTION_MODE_LABELS,
  getExecutionMode,
  type ExecutionMode,
  type TestRecord,
} from "@/types/test-record";

export function ExecutionModeBadge({
  record,
  className,
  showIcon = true,
}: {
  record: Pick<TestRecord, "executionMode" | "automation">;
  className?: string;
  showIcon?: boolean;
}) {
  const mode = getExecutionMode(record);
  const Icon = mode === "automated" ? Bot : Hand;
  const tip =
    mode === "automated"
      ? "Teste com flow Maestro/Playwright"
      : "Teste executado manualmente";

  return (
    <PremiumTooltip label={tip}>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
          mode === "automated"
            ? "border-sky-400/20 bg-[#1a1a1a] text-sky-400"
            : "border-gray-700 bg-[#1a1a1a] text-gray-400",
          className,
        )}
      >
        {showIcon && <Icon className="size-3 shrink-0" strokeWidth={2} />}
        <span className="md:hidden">{mode === "automated" ? "Auto" : "Manual"}</span>
        <span className="hidden md:inline">{EXECUTION_MODE_LABELS[mode]}</span>
      </span>
    </PremiumTooltip>
  );
}

export function executionModeFromFlow(hasFlow: boolean): ExecutionMode {
  return hasFlow ? "automated" : "manual";
}
