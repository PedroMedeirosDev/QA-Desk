import { useEffect, useState } from "react";
import { PremiumTooltip } from "@/components/PremiumTooltip";
import { useActiveProject } from "@/lib/active-project";
import { api, type AndroidDeviceStatus, type HealthStatus } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ProjectSlug } from "@/types/test-record";

type Tone = "ok" | "warn" | "off" | "muted";

function toneDot(tone: Tone) {
  return cn(
    "size-1.5 shrink-0 rounded-full",
    tone === "ok" && "bg-emerald-500",
    tone === "warn" && "bg-amber-500",
    tone === "off" && "bg-muted-foreground/45",
    tone === "muted" && "bg-muted-foreground/30",
  );
}

function StatusChip({
  label,
  short,
  tone,
  tip,
}: {
  label: string;
  short: string;
  tone: Tone;
  tip: string;
}) {
  return (
    <PremiumTooltip label={tip} side="bottom" align="end" wide>
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-md border px-2 py-1 text-[0.6875rem] font-medium tabular-nums",
          tone === "ok" &&
            "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
          tone === "warn" &&
            "border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-300",
          (tone === "off" || tone === "muted") &&
            "border-border bg-muted/40 text-muted-foreground",
        )}
        aria-label={tip}
      >
        <span className={toneDot(tone)} aria-hidden />
        <span className="hidden lg:inline">{label}</span>
        <span className="lg:hidden">{short}</span>
      </div>
    </PremiumTooltip>
  );
}

/** Status permanente do agente remoto e do emulador Android (projeto ativo). */
export function OpsStatusCluster() {
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
    // Sem agente configurado e sem Maestro local: device API só ecoa “offline”
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

  if (!health) return null;

  // Local com Maestro in-process: agente irrelevante
  if (health.automationRun) {
    const ready = Boolean(device?.ready);
    const booting = Boolean(device?.booting);
    const emuTone: Tone = ready ? "ok" : booting ? "warn" : "off";
    const emuLabel = ready ? "pronto" : booting ? "ligando" : "offline";
    return (
      <div className="hidden items-center gap-1.5 sm:flex">
        <StatusChip
          label="Local"
          short="Local"
          tone="ok"
          tip="Maestro local (QA_AUTOMATION_RUN) — sem agente remoto"
        />
        <StatusChip
          label={`AVD: ${emuLabel}`}
          short={`AVD ${emuLabel}`}
          tone={emuTone}
          tip={
            device?.message ??
            (ready
              ? `Emulador pronto${device?.primarySerial ? ` · ${device.primarySerial}` : ""}`
              : "Consultando emulador…")
          }
        />
      </div>
    );
  }

  if (health.agentConfigured === false) return null;

  const online = Boolean(health.agentOnline);
  const host = health.agentHostname;
  const agentTip = online
    ? `Agente online${host ? ` · ${host}` : ""} — Executar e emulador via PC`
    : "Agente offline — no PC: npm run agent";

  let emuTone: Tone = "muted";
  let emuShort = "—";
  let emuLabel = "AVD: —";
  let emuTip = "Emulador depende do agente online";

  if (!online) {
    emuTone = "off";
    emuShort = "off";
    emuLabel = "AVD: off";
    emuTip = "Agente offline — emulador indisponível até npm run agent";
  } else if (device) {
    if (device.ready) {
      emuTone = "ok";
      emuShort = "ok";
      emuLabel = "AVD: pronto";
      emuTip = `Emulador pronto${device.primarySerial ? ` · ${device.primarySerial}` : ""}${
        device.avdName ? ` (${device.avdName})` : ""
      }`;
    } else if (device.booting) {
      emuTone = "warn";
      emuShort = "…";
      emuLabel = "AVD: ligando";
      emuTip = device.message || `Ligando ${device.avdName || "emulador"}…`;
    } else {
      emuTone = "off";
      emuShort = "off";
      emuLabel = "AVD: off";
      emuTip = device.message || `Emulador offline (${device.avdName || "AVD"})`;
    }
  }

  return (
    <div className="hidden items-center gap-1.5 sm:flex">
      <StatusChip
        label={online ? "Agente: on" : "Agente: off"}
        short={online ? "Agente" : "Off"}
        tone={online ? "ok" : "off"}
        tip={agentTip}
      />
      {activeProject && activeProject !== "desk" ? (
        <StatusChip label={emuLabel} short={`AVD ${emuShort}`} tone={emuTone} tip={emuTip} />
      ) : null}
    </div>
  );
}
