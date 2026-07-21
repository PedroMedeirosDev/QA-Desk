import { Construction, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AUTOMATION_READINESS_LABELS,
  getAutomationReadiness,
  type TestRecord,
} from "@/types/test-record";

export function AutomationReadinessBadge({
  record,
  className,
}: {
  record: Pick<TestRecord, "automation">;
  className?: string;
}) {
  const readiness = getAutomationReadiness(record);
  if (!readiness) return null;

  const isReady = readiness === "ready";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        isReady
          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
          : "border-amber-500/40 bg-amber-500/15 text-amber-300",
        className,
      )}
      title={
        isReady
          ? "Flow estável — validado no Maestro / emulador"
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
