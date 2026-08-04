import { useEffect, useMemo, useState } from "react";
import { useActiveProject } from "@/lib/active-project";
import { api, type AndroidDeviceStatus, type HealthStatus } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ProjectSlug } from "@/types/test-record";

type Tone = "ok" | "warn" | "off" | "muted";

export type OpsStatusItem = {
  id: string;
  title: string;
  value: string;
  detail: string;
  tone: Tone;
};

function toneDot(tone: Tone) {
  return cn(
    "size-2 shrink-0 rounded-full",
    tone === "ok" && "bg-emerald-500",
    tone === "warn" && "bg-amber-500",
    tone === "off" && "bg-muted-foreground/50",
    tone === "muted" && "bg-muted-foreground/35",
  );
}

function toneValueClass(tone: Tone) {
  return cn(
    "text-[0.75rem] font-semibold tabular-nums",
    tone === "ok" && "text-emerald-600 dark:text-emerald-400",
    tone === "warn" && "text-amber-700 dark:text-amber-300",
    (tone === "off" || tone === "muted") && "text-muted-foreground",
  );
}

function buildItems(
  health: HealthStatus | null,
  device: AndroidDeviceStatus | null,
  activeProject: string | null | undefined,
): OpsStatusItem[] {
  if (!health) {
    return [
      {
        id: "loading",
        title: "Ambiente",
        value: "…",
        detail: "Consultando /api/health…",
        tone: "muted",
      },
    ];
  }

  const showAvd = Boolean(activeProject && activeProject !== "desk");

  if (health.automationRun) {
    const ready = Boolean(device?.ready);
    const booting = Boolean(device?.booting);
    const items: OpsStatusItem[] = [
      {
        id: "mode",
        title: "Execução",
        value: "Local",
        detail: "Maestro local (QA_AUTOMATION_RUN=1) — sem agente remoto",
        tone: "ok",
      },
    ];
    if (showAvd) {
      const tone: Tone = ready ? "ok" : booting ? "warn" : "off";
      const value = ready ? "Pronto" : booting ? "Ligando" : "Offline";
      items.push({
        id: "avd",
        title: "Emulador",
        value,
        detail:
          device?.message ??
          (ready
            ? `AVD pronto${device?.primarySerial ? ` · ${device.primarySerial}` : ""}`
            : "Consultando emulador…"),
        tone,
      });
    }
    return items;
  }

  if (health.agentConfigured === false) {
    const items: OpsStatusItem[] = [
      {
        id: "agent",
        title: "Agente",
        value: "—",
        detail: "QA_AGENT_TOKEN não configurado no servidor",
        tone: "muted",
      },
    ];
    if (showAvd) {
      items.push({
        id: "avd",
        title: "Emulador",
        value: "—",
        detail: "Precisa de agente remoto (npm run agent) ou QA_AUTOMATION_RUN=1 local",
        tone: "muted",
      });
    }
    return items;
  }

  const online = Boolean(health.agentOnline);
  const host = health.agentHostname;
  const items: OpsStatusItem[] = [
    {
      id: "agent",
      title: "Agente",
      value: online ? "Online" : "Offline",
      detail: online
        ? `Agente online${host ? ` · ${host}` : ""} — Executar e emulador via PC`
        : "Agente offline — no PC: npm run agent",
      tone: online ? "ok" : "off",
    },
  ];

  if (showAvd) {
    let tone: Tone = "muted";
    let value = "—";
    let detail = "Emulador depende do agente online";
    if (!online) {
      tone = "off";
      value = "Off";
      detail = "Agente offline — emulador indisponível";
    } else if (device?.ready) {
      tone = "ok";
      value = "Pronto";
      detail = `Emulador pronto${device.primarySerial ? ` · ${device.primarySerial}` : ""}${
        device.avdName ? ` (${device.avdName})` : ""
      }`;
    } else if (device?.booting) {
      tone = "warn";
      value = "Ligando";
      detail = device.message || `Ligando ${device.avdName || "emulador"}…`;
    } else if (device) {
      tone = "off";
      value = "Offline";
      detail = device.message || `Emulador offline (${device.avdName || "AVD"})`;
    }
    items.push({ id: "avd", title: "Emulador", value, detail, tone });
  }

  return items;
}

/** Hook de status ops (agente / AVD / local) — poll a cada 12s. */
export function useOpsStatus() {
  const { activeProject } = useActiveProject();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [device, setDevice] = useState<AndroidDeviceStatus | null>(null);

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

  useEffect(() => {
    if (!activeProject || activeProject === "desk") {
      setDevice(null);
      return;
    }
    if (health && health.automationRun !== true && health.agentConfigured === false) {
      setDevice(null);
      return;
    }

    let cancelled = false;
    const project = activeProject as ProjectSlug;
    const poll = () => {
      api
        .getDeviceStatus(project)
        .then((d) => {
          if (!cancelled) setDevice(d);
        })
        .catch(() => {
          if (!cancelled) setDevice(null);
        });
    };
    poll();
    const timer = window.setInterval(poll, 12_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeProject, health?.agentConfigured, health?.automationRun, health?.agentOnline]);

  const items = useMemo(
    () => buildItems(health, device, activeProject),
    [health, device, activeProject],
  );

  /** Tom agregado para o ponto no trigger do menu. */
  const summaryTone: Tone = useMemo(() => {
    if (items.some((i) => i.tone === "warn")) return "warn";
    if (items.some((i) => i.tone === "ok") && !items.some((i) => i.tone === "off")) return "ok";
    if (items.some((i) => i.tone === "off")) return "off";
    return "muted";
  }, [items]);

  return { items, summaryTone, health };
}

/** Lista de status para o menu da UserBar. */
export function OpsStatusPanel({
  items,
  className,
}: {
  items: OpsStatusItem[];
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="px-1 pb-1 text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">
        Ambiente
      </p>
      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-[0.8125rem] text-foreground">
              <span className={toneDot(item.tone)} aria-hidden />
              {item.title}
            </span>
            <span className={toneValueClass(item.tone)}>{item.value}</span>
          </div>
          <p className="mt-0.5 pl-4 text-[0.65rem] leading-snug text-muted-foreground">
            {item.detail}
          </p>
        </div>
      ))}
    </div>
  );
}
