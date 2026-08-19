import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastVariant = "error" | "success" | "info";

export type Toast = {
  id: string;
  variant: ToastVariant;
  title?: string;
  message: string;
  /** 0–100; se definido, o toast mostra barra de progresso. */
  progress?: number;
  action?: { label: string; onClick: () => void };
};

export type ToastInput = {
  variant: ToastVariant;
  title?: string;
  message: string;
  /** 0 = fica até dismiss/update; omitido = default da variante. */
  duration?: number;
  progress?: number;
  action?: { label: string; onClick: () => void };
};

export type ToastOpts = {
  title?: string;
  duration?: number;
  progress?: number;
  action?: { label: string; onClick: () => void };
};

const DEFAULT_DURATION: Record<ToastVariant, number> = {
  error: 9000,
  success: 4500,
  info: 5000,
};

type ToastContextValue = {
  toasts: Toast[];
  push: (input: ToastInput) => string;
  update: (id: string, patch: Partial<ToastInput>) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let idCounter = 0;

export function toastErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const armTimer = useCallback(
    (id: string, duration: number) => {
      const prev = timers.current.get(id);
      if (prev) clearTimeout(prev);
      if (duration <= 0) {
        timers.current.delete(id);
        return;
      }
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      );
    },
    [dismiss],
  );

  const push = useCallback(
    (input: ToastInput) => {
      const id = `toast-${++idCounter}`;
      const toast: Toast = {
        id,
        variant: input.variant,
        title: input.title,
        message: input.message,
        progress: input.progress,
        action: input.action,
      };

      setToasts((prev) => [...prev, toast].slice(-5));
      const duration = input.duration ?? DEFAULT_DURATION[input.variant];
      armTimer(id, duration);
      return id;
    },
    [armTimer],
  );

  const update = useCallback(
    (id: string, patch: Partial<ToastInput>) => {
      setToasts((prev) =>
        prev.map((toast) =>
          toast.id === id
            ? {
                ...toast,
                ...(patch.variant ? { variant: patch.variant } : {}),
                ...(patch.title !== undefined ? { title: patch.title } : {}),
                ...(patch.message !== undefined ? { message: patch.message } : {}),
                ...(patch.progress !== undefined ? { progress: patch.progress } : {}),
                ...(patch.action !== undefined ? { action: patch.action } : {}),
              }
            : toast,
        ),
      );
      if (patch.duration !== undefined) {
        armTimer(id, patch.duration);
      } else if (patch.variant) {
        armTimer(id, DEFAULT_DURATION[patch.variant]);
      }
    },
    [armTimer],
  );

  useEffect(
    () => () => {
      timers.current.forEach((timer) => clearTimeout(timer));
      timers.current.clear();
    },
    [],
  );

  const value = useMemo(
    () => ({ toasts, push, update, dismiss }),
    [toasts, push, update, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");

  const { push, update, dismiss } = ctx;

  // Estável enquanto push/dismiss forem estáveis — NÃO depender de `toasts`
  // (senão useEffect([toast]) no Dashboard/Homologação re-fetcha e pisca).
  return useMemo(
    () => ({
      error: (message: string, opts?: ToastOpts) =>
        push({
          variant: "error",
          message,
          title: opts?.title ?? "Erro",
          duration: opts?.duration,
          progress: opts?.progress,
          action: opts?.action,
        }),
      success: (message: string, opts?: ToastOpts) =>
        push({
          variant: "success",
          message,
          title: opts?.title ?? "Sucesso",
          duration: opts?.duration,
          progress: opts?.progress,
          action: opts?.action,
        }),
      info: (message: string, opts?: ToastOpts) =>
        push({
          variant: "info",
          message,
          title: opts?.title,
          duration: opts?.duration,
          progress: opts?.progress,
          action: opts?.action,
        }),
      update,
      dismiss,
    }),
    [push, update, dismiss],
  );
}

export function useToasts() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToasts must be used within ToastProvider");
  return ctx;
}
