import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { api } from "@/lib/api";
import {
  QA_GESTOR_INBOX_CHANGED,
  type GestorUnreadItem,
} from "@/lib/gestor-replies-stream";
import { projectBugDetailPath } from "@/lib/project-paths";
import { cn } from "@/lib/utils";

function relativeAt(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const diffSec = Math.round((Date.now() - t) / 1000);
  if (diffSec < 60) return "agora";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min`;
  if (diffSec < 86_400) return `${Math.floor(diffSec / 3600)} h`;
  return `${Math.floor(diffSec / 86_400)} d`;
}

/**
 * Sino na userbar: respostas do gestor ainda não abertas.
 * Clique no item abre o bug (marca como lido na ficha).
 */
export function GestorInboxBell({ className }: { className?: string }) {
  const { isAdmin, ready } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<GestorUnreadItem[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const refresh = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const res = await api.listGestorUnread();
      setItems(res.items);
    } catch {
      /* silencioso — sino some se API falhar no boot */
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!ready || !isAdmin) return;
    void refresh();
    const onChange = () => void refresh();
    window.addEventListener(QA_GESTOR_INBOX_CHANGED, onChange);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener(QA_GESTOR_INBOX_CHANGED, onChange);
      window.removeEventListener("focus", onFocus);
    };
  }, [ready, isAdmin, refresh]);

  useEffect(() => {
    if (!open) return;
    void refresh();
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
  }, [open, refresh]);

  if (!isAdmin) return null;

  const count = items.length;
  const badge = count > 9 ? "9+" : String(count);

  function openItem(item: GestorUnreadItem) {
    setOpen(false);
    setItems((prev) => prev.filter((x) => !(x.project === item.project && x.bugId === item.bugId)));
    navigate(projectBugDetailPath(item.project, item.bugId, item.channel));
  }

  return (
    <div ref={rootRef} className={cn("relative shrink-0", className)}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={
          count > 0
            ? `${count} resposta(s) do gestor não lida(s)`
            : "Nenhuma resposta do gestor pendente"
        }
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative flex size-9 items-center justify-center rounded-lg outline-none transition-colors duration-200",
          "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
          "focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
          open && "bg-[var(--accent)] text-[var(--foreground)]",
          count > 0 && "text-amber-300",
        )}
      >
        <Bell className="size-[1.125rem]" strokeWidth={1.75} aria-hidden />
        {count > 0 && (
          <span
            className={cn(
              "absolute -right-0.5 -top-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center",
              "rounded-full bg-amber-500 px-1 text-[0.625rem] font-semibold leading-none text-black",
              "ring-2 ring-[var(--background)]",
            )}
          >
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Respostas do gestor"
          className={cn(
            "absolute right-0 top-full z-50 mt-2 w-[22rem] max-w-[calc(100vw-1.5rem)] origin-top-right",
            "rounded-[0.75rem] border border-[var(--border)] bg-slate-900/95 p-[0.75rem] text-[0.8125rem] text-slate-100 shadow-2xl backdrop-blur-md",
            "dark:bg-zinc-900/95",
            "animate-fade-in-up-soft opacity-0",
          )}
        >
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <p className="text-[0.75rem] font-semibold uppercase tracking-wider text-slate-400">
              Respostas do gestor
            </p>
            <span className="text-[0.7rem] tabular-nums text-slate-500">
              {loading ? "…" : count === 0 ? "nenhuma" : `${count} não lida${count === 1 ? "" : "s"}`}
            </span>
          </div>

          {count === 0 ? (
            <p className="rounded-md border border-white/5 bg-white/5 px-3 py-4 text-center text-[0.8125rem] text-slate-400">
              Nada pendente. Quando o gestor comentar na issue, aparece aqui.
            </p>
          ) : (
            <ul className="max-h-[min(24rem,70vh)] space-y-1 overflow-y-auto scrollbar-thin">
              {items.map((item) => (
                <li key={`${item.project}:${item.bugId}:${item.at}`}>
                  <button
                    type="button"
                    onClick={() => openItem(item)}
                    className={cn(
                      "flex w-full flex-col gap-0.5 rounded-[0.5rem] border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-left",
                      "transition-colors hover:border-amber-400/35 hover:bg-amber-500/15",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-[0.7rem] font-semibold text-amber-200">
                        {item.bugCode}
                      </span>
                      <span className="shrink-0 text-[0.65rem] text-slate-500">
                        {relativeAt(item.at)}
                      </span>
                    </span>
                    <span className="truncate text-[0.8125rem] font-medium text-slate-100">
                      {item.title}
                    </span>
                    <span className="truncate text-[0.75rem] text-amber-200/90">
                      @{item.author}
                      {item.snippet ? ` · ${item.snippet}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
