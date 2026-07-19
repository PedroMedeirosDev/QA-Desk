import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { actionBtn, actionBtnBase } from "@/lib/button-styles";
import { cn } from "@/lib/utils";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Estilo do botão principal */
  tone?: "run" | "danger" | "default";
};

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const close = useCallback((value: boolean) => {
    setOpen(false);
    const resolve = resolver.current;
    resolver.current = null;
    resolve?.(value);
  }, []);

  const confirm = useCallback<ConfirmFn>((next) => {
    if (resolver.current) {
      resolver.current(false);
      resolver.current = null;
    }
    setOpts(next);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const value = useMemo(() => confirm, [confirm]);

  const tone = opts?.tone ?? "run";
  const confirmClass =
    tone === "danger"
      ? "border border-red-500/40 bg-red-600 text-white hover:bg-red-500"
      : tone === "default"
        ? actionBtn.save
        : actionBtn.create;

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {open && opts && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            aria-label="Fechar"
            onClick={() => close(false)}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="qa-confirm-title"
            aria-describedby={opts.description ? "qa-confirm-desc" : undefined}
            className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl"
          >
            <h2 id="qa-confirm-title" className="text-base font-semibold text-foreground">
              {opts.title}
            </h2>
            {opts.description && (
              <p
                id="qa-confirm-desc"
                className="mt-2 whitespace-pre-line text-sm text-muted-foreground"
              >
                {opts.description}
              </p>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className={cn(actionBtnBase, actionBtn.back)}
                onClick={() => close(false)}
              >
                {opts.cancelLabel ?? "Cancelar"}
              </button>
              <button
                type="button"
                className={cn(actionBtnBase, confirmClass)}
                autoFocus
                onClick={() => close(true)}
              >
                {opts.confirmLabel ?? "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
