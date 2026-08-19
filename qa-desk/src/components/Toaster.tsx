import { AlertCircle, CheckCircle2, Info, Loader2, X } from "lucide-react";
import { useToasts, type Toast, type ToastVariant } from "@/lib/toast";
import { cn } from "@/lib/utils";

const VARIANT_STYLES: Record<
  ToastVariant,
  { container: string; icon: string; title: string }
> = {
  error: {
    container:
      "border-red-500/50 bg-red-950/95 text-red-50 shadow-lg shadow-red-950/40 dark:bg-red-950/90",
    icon: "text-red-400",
    title: "text-red-100",
  },
  success: {
    container:
      "border-emerald-500/40 bg-emerald-950/95 text-emerald-50 shadow-lg shadow-emerald-950/30 dark:bg-emerald-950/90",
    icon: "text-emerald-400",
    title: "text-emerald-100",
  },
  info: {
    container:
      "border-border bg-card text-foreground shadow-lg shadow-black/10",
    icon: "text-primary",
    title: "text-foreground",
  },
};

function ToastIcon({ toast }: { toast: Toast }) {
  const className = cn("size-5 shrink-0", VARIANT_STYLES[toast.variant].icon);
  const inProgress =
    toast.progress != null && toast.progress < 100 && toast.variant === "info";
  if (inProgress) return <Loader2 className={cn(className, "animate-spin")} strokeWidth={2} />;
  if (toast.variant === "success") return <CheckCircle2 className={className} strokeWidth={2} />;
  if (toast.variant === "info") return <Info className={className} strokeWidth={2} />;
  return <AlertCircle className={className} strokeWidth={2} />;
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const styles = VARIANT_STYLES[toast.variant];

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "pointer-events-auto flex w-full max-w-md gap-3 rounded-lg border px-4 py-3 backdrop-blur-sm",
        "animate-fade-in-up-soft opacity-0",
        styles.container,
      )}
    >
      <ToastIcon toast={toast} />

      <div className="min-w-0 flex-1">
        {toast.title && (
          <p className={cn("text-sm font-semibold", styles.title)}>{toast.title}</p>
        )}
        <p
          className={cn(
            "break-words text-sm leading-snug",
            toast.title ? "mt-0.5 opacity-90" : "font-medium",
          )}
        >
          {toast.message}
        </p>
        {toast.progress != null && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/30">
            <div
              className="h-full rounded-full bg-current transition-[width] duration-200 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, toast.progress))}%` }}
            />
          </div>
        )}
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              onDismiss(toast.id);
            }}
            className="mt-2 text-sm font-medium underline underline-offset-2 opacity-95 hover:opacity-100"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Fechar notificação"
        className="shrink-0 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export function Toaster() {
  const { toasts, dismiss } = useToasts();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notificações"
      className="pointer-events-none fixed right-4 top-4 z-[200] flex w-[min(100vw-2rem,28rem)] flex-col gap-2"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>
  );
}
