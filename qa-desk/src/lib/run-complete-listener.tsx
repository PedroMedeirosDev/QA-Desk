import { useEffect } from "react";
import { QA_RUN_FINISHED_EVENT, type LiveRunState } from "@/lib/run-progress";
import { useToast } from "@/lib/toast";

/** Toast quando a aba está em segundo plano (notificação do sistema é o canal principal). */
export function RunCompleteListener() {
  const toast = useToast();

  useEffect(() => {
    const onFinished = (event: Event) => {
      const state = (event as CustomEvent<LiveRunState>).detail;
      if (!state?.result) return;
      if (document.visibilityState !== "hidden") return;

      const label = state.batchLabel
        ? `${state.batchLabel} · ${state.title ?? "Teste"}`
        : (state.title ?? "Teste");
      const run = state.runNumber != null ? ` #${state.runNumber}` : "";
      const where = state.action ? ` — ${state.action}` : "";

      if (state.result === "success") {
        toast.success(`${label}${run} passou${where}`, { title: "Maestro" });
      } else if (state.result === "cancelled") {
        toast.info(`${label}${run} cancelado`, { title: "Maestro", duration: 8000 });
      } else {
        toast.error(`${label}${run} falhou${where}`, { title: "Maestro" });
      }
    };

    window.addEventListener(QA_RUN_FINISHED_EVENT, onFinished);
    return () => window.removeEventListener(QA_RUN_FINISHED_EVENT, onFinished);
  }, [toast]);

  return null;
}
