import { Bot, Hand } from "lucide-react";
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

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        mode === "automated"
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-muted text-muted-foreground",
        className,
      )}
      title={mode === "automated" ? "Teste com flow Maestro/Playwright" : "Teste executado manualmente"}
    >
      {showIcon && <Icon className="size-3 shrink-0" strokeWidth={2} />}
      {EXECUTION_MODE_LABELS[mode]}
    </span>
  );
}

export function executionModeFromFlow(hasFlow: boolean): ExecutionMode {
  return hasFlow ? "automated" : "manual";
}
