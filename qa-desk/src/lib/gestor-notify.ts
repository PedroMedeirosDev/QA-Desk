const STORAGE_KEY = "qa-desk-gestor-notify";

export type GestorNotifyPref = "on" | "off";

export function readGestorNotifyPref(): GestorNotifyPref {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "on" || raw === "off") return raw;
  } catch {
    /* ignore */
  }
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    return "on";
  }
  return "off";
}

export function writeGestorNotifyPref(value: GestorNotifyPref) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
}

export async function ensureGestorNotifyPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    return (await Notification.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

function playGestorChime() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 660;
    gain.gain.value = 0.09;
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.value = 880;
    gain2.gain.value = 0.09;
    osc2.start(ctx.currentTime + 0.14);
    osc2.stop(ctx.currentTime + 0.28);
    void ctx.close();
  } catch {
    /* ignore */
  }
}

function flashDocumentTitle(label: string) {
  const original = document.title;
  document.title = `[GESTOR] ${label}`;
  window.setTimeout(() => {
    document.title = original;
  }, 10_000);
}

export function notifyGestorReply(opts: {
  bugCode: string;
  title: string;
  author: string;
  snippet: string;
  onClick?: () => void;
}) {
  const headline = `${opts.bugCode} · @${opts.author}`;
  playGestorChime();
  flashDocumentTitle(opts.bugCode);

  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (readGestorNotifyPref() !== "on") return;

  try {
    const notification = new Notification("Gestor respondeu", {
      body: `${headline}\n${opts.snippet || opts.title}`,
      tag: `gestor-reply-${opts.bugCode}`,
      requireInteraction: true,
    });
    notification.onclick = () => {
      window.focus();
      opts.onClick?.();
      notification.close();
    };
  } catch {
    /* ignore */
  }
}
