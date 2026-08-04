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
  action?: { label: string; onClick: () => void };
};

type ToastInput = {
  variant: ToastVariant;
  title?: string;
  message: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
};

const DEFAULT_DURATION: Record<ToastVariant, number> = {
  error: 9000,
  success: 4500,
  info: 5000,
};

type ToastContextValue = {
  toasts: Toast[];
  push: (input: ToastInput) => void;
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

  const push = useCallback(
    (input: ToastInput) => {
      const id = `toast-${++idCounter}`;
      const toast: Toast = {
        id,
        variant: input.variant,
        title: input.title,
        message: input.message,
        action: input.action,
      };

      setToasts((prev) => [...prev, toast].slice(-5));

      const duration = input.duration ?? DEFAULT_DURATION[input.variant];
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      );
    },
    [dismiss],
  );

  useEffect(
    () => () => {
      timers.current.forEach((timer) => clearTimeout(timer));
      timers.current.clear();
    },
    [],
  );

  const value = useMemo(
    () => ({ toasts, push, dismiss }),
    [toasts, push, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");

  const { push, dismiss } = ctx;

  // Estável enquanto push/dismiss forem estáveis — NÃO depender de `toasts`
  // (senão useEffect([toast]) no Dashboard/Homologação re-fetcha e pisca).
  return useMemo(
    () => ({
      error: (
        message: string,
        opts?: {
          title?: string;
          duration?: number;
          action?: { label: string; onClick: () => void };
        },
      ) =>
        push({
          variant: "error",
          message,
          title: opts?.title ?? "Erro",
          duration: opts?.duration,
          action: opts?.action,
        }),
      success: (
        message: string,
        opts?: {
          title?: string;
          duration?: number;
          action?: { label: string; onClick: () => void };
        },
      ) =>
        push({
          variant: "success",
          message,
          title: opts?.title ?? "Sucesso",
          duration: opts?.duration,
          action: opts?.action,
        }),
      info: (
        message: string,
        opts?: {
          title?: string;
          duration?: number;
          action?: { label: string; onClick: () => void };
        },
      ) =>
        push({
          variant: "info",
          message,
          title: opts?.title,
          duration: opts?.duration,
          action: opts?.action,
        }),
      dismiss,
    }),
    [push, dismiss],
  );
}

export function useToasts() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToasts must be used within ToastProvider");
  return ctx;
}
