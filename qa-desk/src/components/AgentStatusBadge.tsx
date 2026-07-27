import { useEffect, useState } from "react";
import { api, type HealthStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Badge Agente online/offline (API remota + PC com npm run agent). */
export function AgentStatusBadge() {
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      api
        .health()
        .then((h) => {
          if (!cancelled) setHealth(h);
        })
        .catch(() => {
          if (!cancelled) setHealth(null);
        });
    };
    poll();
    const timer = window.setInterval(poll, 12_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  // Local com Maestro in-process: badge irrelevante
  if (health?.automationRun) return null;
  // Sem token no servidor: não mostra
  if (health && health.agentConfigured === false) return null;

  const online = Boolean(health?.agentOnline);
  const host = health?.agentHostname;

  return (
    <div
      className={cn(
        "hidden items-center gap-1.5 rounded-md border px-2 py-1 text-xs sm:flex",
        online
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "border-border bg-muted/40 text-muted-foreground",
      )}
      title={
        online
          ? `Agente online${host ? ` · ${host}` : ""} — Executar e emulador via PC`
          : "Agente offline — no PC: npm run agent"
      }
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          online ? "bg-emerald-500" : "bg-muted-foreground/50",
        )}
        aria-hidden
      />
      <span>
        Agente: {online ? "online" : "offline"}
        {online && host ? (
          <span className="ml-1 opacity-70">({host})</span>
        ) : null}
      </span>
    </div>
  );
}
