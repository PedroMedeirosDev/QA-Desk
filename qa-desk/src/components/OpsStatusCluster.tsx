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

function toneDot(tone: Tone, pulse = false) {
  return cn(
    "size-[0.5rem] shrink-0 rounded-full",
    tone === "ok" && "bg-emerald-500",
    tone === "warn" && "bg-amber-400",
    tone === "off" && "bg-slate-400",
    tone === "muted" && "bg-slate-500",
    pulse && (tone === "warn" || tone === "off" || tone === "muted") && "animate-pulse",
  );
}

function badgeClass(tone: Tone) {
  return cn(
    "inline-flex items-center gap-[0.375rem] rounded-full border px-[0.5rem] py-[0.125rem] text-[0.6875rem] font-semibold",
    tone === "ok" &&
      "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
    tone === "warn" &&
      "border-amber-500/35 bg-amber-500/15 text-amber-200",
    tone === "off" &&
      "border-slate-500/40 bg-slate-500/15 text-slate-300",
    tone === "muted" &&
      "border-slate-600/50 bg-slate-700/40 text-slate-400",
  );
}

function detailBorderClass(tone: Tone) {
  return cn(
    "mt-[0.375rem] border-l-2 pl-[0.5rem] font-mono text-[0.6875rem] leading-relaxed text-slate-400",
    tone === "ok" && "border-emerald-500/50",
    tone === "warn" && "border-amber-500/50",
    tone === "off" && "border-slate-500/50",
    tone === "muted" && "border-slate-600/50",
  );
}

function displayTitle(item: OpsStatusItem): string {
  if (item.id === "agent") return "Agente Remoto";
  if (item.id === "avd") return "Emulador";
  if (item.id === "mode") return "Execução";
  return item.title;
}

function displayBadge(item: OpsStatusItem): string {
  if (item.value === "—" || item.value === "…") {
    return item.tone === "muted" ? "Pendente" : item.value;
  }
  if (item.value === "Offline" || item.value === "Off") return "Desconectado";
  return item.value;
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
        title: "Agente Remoto",
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
      title: "Agente Remoto",
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

/** Cards de status para o menu da UserBar. */
export function OpsStatusPanel({
  items,
  className,
}: {
  items: OpsStatusItem[];
  className?: string;
}) {
  return (
    <div className={cn(className)}>
      <span className="mb-[0.625rem] block text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
        Status do Ambiente
      </span>
      {items.map((item) => (
        <div
          key={item.id}
          className="mb-[0.5rem] rounded-[0.5rem] border border-slate-800/80 bg-slate-800/40 p-[0.625rem] last:mb-0"
        >
          <div className="flex items-center justify-between gap-[0.5rem]">
            <span className="text-[0.8125rem] font-medium text-slate-100">
              {displayTitle(item)}
            </span>
            <span className={badgeClass(item.tone)}>
              <span className={toneDot(item.tone, true)} aria-hidden />
              {displayBadge(item)}
            </span>
          </div>
          <p className={detailBorderClass(item.tone)}>{item.detail}</p>
        </div>
      ))}
    </div>
  );
}
