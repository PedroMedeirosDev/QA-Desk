import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, LogOut, Moon, Sun, Bell, BellOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { OpsStatusPanel, useOpsStatus } from "@/components/OpsStatusCluster";
import { GestorInboxBell } from "@/components/GestorInboxBell";
import { UserAvatar } from "@/components/UserAvatar";
import { api } from "@/lib/api";
import { useColorScheme } from "@/lib/color-scheme";
import { cn } from "@/lib/utils";
import {
  ensureGestorNotifyPermission,
  readGestorNotifyPref,
  writeGestorNotifyPref,
  type GestorNotifyPref,
} from "@/lib/gestor-notify";
import { useToast } from "@/lib/toast";

const menuActionClass =
  "flex w-full cursor-pointer items-center gap-[0.625rem] rounded-[0.375rem] px-[0.625rem] py-[0.5rem] text-[0.8125rem] font-medium text-slate-100 transition-colors duration-150 hover:bg-white/10";

function summaryDotClass(tone: string) {
  return cn(
    "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-[var(--background)]",
    tone === "ok" && "bg-emerald-500",
    tone === "warn" && "bg-amber-500",
    tone === "off" && "bg-muted-foreground/55",
    tone === "muted" && "bg-muted-foreground/40",
  );
}

export function UserBar({ className }: { className?: string }) {
  const { profile, isAdmin, isBot, authEnabled, signOut, applyAvatar } = useAuth();
  const { scheme, toggleScheme } = useColorScheme();
  const navigate = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [gestorNotify, setGestorNotify] = useState<GestorNotifyPref>("off");
  const [gestorNotifyBlocked, setGestorNotifyBlocked] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuId = useId();
  const { items, summaryTone } = useOpsStatus();

  useEffect(() => {
    setGestorNotify(readGestorNotifyPref());
    setGestorNotifyBlocked(
      typeof Notification !== "undefined" && Notification.permission === "denied",
    );
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleLogout() {
    setOpen(false);
    await signOut();
    if (authEnabled) navigate("/login", { replace: true });
  }

  function openAvatarPicker() {
    setAvatarError(null);
    fileInputRef.current?.click();
  }

  async function onAvatarSelected(file: File | undefined) {
    if (!file || !isAdmin) return;
    setUploadingAvatar(true);
    setAvatarError(null);
    try {
      const result = await api.uploadAvatar(file);
      applyAvatar(result.avatarPath, result.avatarUrl);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Falha ao enviar foto");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function toggleGestorNotify() {
    if (gestorNotify === "on") {
      writeGestorNotifyPref("off");
      setGestorNotify("off");
      return;
    }
    const granted = await ensureGestorNotifyPermission();
    if (!granted) {
      setGestorNotifyBlocked(typeof Notification !== "undefined" && Notification.permission === "denied");
      toast.info(
        Notification.permission === "denied"
          ? "O Chrome bloqueou avisos deste site. Libere em Configurações → Privacidade → Notificações."
          : "Sem permissão do navegador, o aviso fica só no toast do Desk.",
        { title: "Notificação do gestor" },
      );
      return;
    }
    writeGestorNotifyPref("on");
    setGestorNotify("on");
    setGestorNotifyBlocked(false);
  }

  const name = profile?.displayName ?? "Usuário";
  const roleLabel = isAdmin
    ? "QA · Admin"
    : isBot
      ? "Grok · Repasse"
      : "Visitante · Portfólio";
  const isDark = scheme === "dark";

  return (
    <div ref={rootRef} className={cn("relative flex shrink-0 items-center gap-1", className)}>
      {isAdmin && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => void onAvatarSelected(e.target.files?.[0])}
        />
      )}

      <GestorInboxBell />

      {isAdmin ? (
        <span className="relative shrink-0">
          <UserAvatar
            className="ring-1 ring-black/5 dark:ring-white/10"
            editable
            uploading={uploadingAvatar}
            onPickFile={openAvatarPicker}
          />
          <span className={summaryDotClass(summaryTone)} aria-hidden />
        </span>
      ) : null}

      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-[0.625rem] rounded-lg px-[0.375rem] py-[0.25rem] text-left outline-none transition-colors duration-200",
          "hover:bg-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
          open && "bg-[var(--accent)]",
        )}
      >
        {!isAdmin && (
          <span className="relative shrink-0">
            <UserAvatar className="ring-1 ring-black/5 dark:ring-white/10" />
          </span>
        )}
        <span className="hidden min-w-0 flex-col items-start sm:flex">
          <span className="truncate text-[0.875rem] font-semibold leading-none text-[var(--foreground)]">
            {name}
          </span>
          <span className="mt-[0.25rem] text-[0.75rem] font-medium text-[var(--muted-foreground)]">
            {roleLabel}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "hidden size-4 shrink-0 text-[var(--muted-foreground)] transition-transform duration-200 sm:block",
            open && "rotate-180",
          )}
          strokeWidth={1.75}
          aria-hidden
        />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className={cn(
            "absolute right-0 top-full z-50 mt-2 w-[20rem] origin-top-right",
            "rounded-[0.75rem] border border-[var(--border)] bg-slate-900/95 p-[0.875rem] text-[0.8125rem] text-slate-100 shadow-2xl backdrop-blur-md",
            "dark:bg-zinc-900/95",
            "animate-fade-in-up-soft opacity-0",
          )}
        >
          <div className="mb-[0.75rem] sm:hidden">
            <p className="truncate text-[0.875rem] font-semibold text-slate-100">{name}</p>
            <p className="text-[0.75rem] text-slate-400">{roleLabel}</p>
          </div>

          {isAdmin && (
            <button
              type="button"
              role="menuitem"
              onClick={openAvatarPicker}
              disabled={uploadingAvatar}
              className={cn(menuActionClass, "mb-[0.5rem]")}
            >
              <UserAvatar className="size-7" uploading={uploadingAvatar} />
              <span className="min-w-0 flex-1 text-left">
                {uploadingAvatar ? "Enviando foto…" : "Alterar foto de perfil"}
              </span>
            </button>
          )}
          {avatarError && (
            <p className="mb-[0.5rem] px-[0.625rem] text-[0.75rem] text-red-400">{avatarError}</p>
          )}

          {isAdmin && <OpsStatusPanel items={items} />}

          <div className="my-[0.75rem] border-t border-[var(--border)] opacity-60" />

          <div className="flex flex-col gap-[0.125rem]">
            {isAdmin && (
              <button
                type="button"
                role="menuitem"
                onClick={() => void toggleGestorNotify()}
                className={menuActionClass}
              >
                {gestorNotify === "on" ? (
                  <Bell className="size-[1rem] text-amber-300" strokeWidth={1.75} />
                ) : (
                  <BellOff className="size-[1rem] text-slate-400" strokeWidth={1.75} />
                )}
                <span className="min-w-0 flex-1 text-left">
                  {gestorNotifyBlocked
                    ? "Avisos bloqueados no Chrome"
                    : gestorNotify === "on"
                      ? "Avisos do gestor ligados"
                      : "Avisar respostas do gestor"}
                </span>
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => toggleScheme()}
              className={menuActionClass}
            >
              {isDark ? (
                <Sun className="size-[1rem] text-slate-400" strokeWidth={1.75} />
              ) : (
                <Moon className="size-[1rem] text-slate-400" strokeWidth={1.75} />
              )}
              {isDark ? "Tema claro" : "Tema escuro"}
            </button>
            {authEnabled && (
              <button
                type="button"
                role="menuitem"
                onClick={() => void handleLogout()}
                className={cn(
                  menuActionClass,
                  "hover:bg-red-500/10 hover:text-red-400",
                )}
              >
                <LogOut className="size-[1rem] text-slate-400" strokeWidth={1.75} />
                Sair
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
