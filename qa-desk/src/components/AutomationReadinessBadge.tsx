import { Construction, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AUTOMATION_READINESS_LABELS,
  getAutomationReadiness,
  type TestRecord,
} from "@/types/test-record";

export function AutomationReadinessBadge({
  record,
  runner,
  className,
}: {
  record: Pick<TestRecord, "automation">;
  runner?: "maestro" | "playwright";
  className?: string;
}) {
  const readiness = getAutomationReadiness(record, runner);
  if (!readiness) return null;

  const isReady = readiness === "ready";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium bg-[#1a1a1a]",
        isReady
          ? "border-emerald-400/20 text-emerald-400"
          : "border-amber-400/20 text-amber-300",
        className,
      )}
      title={
        isReady
          ? runner === "playwright"
            ? "Spec estável — validado no Playwright"
            : "Flow estável — validado no Maestro / emulador"
          : runner === "playwright"
            ? "Spec em rascunho — existe, mas ainda pode falhar"
            : "Flow em rascunho — existe, mas ainda pode falhar em seletores"
      }
    >
      {isReady ? (
        <Sparkles className="size-3 shrink-0" strokeWidth={2} />
      ) : (
        <Construction className="size-3 shrink-0" strokeWidth={2} />
      )}
      {AUTOMATION_READINESS_LABELS[readiness]}
    </span>
  );
}
