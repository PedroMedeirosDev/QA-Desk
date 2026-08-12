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
import { actionBtn, actionBtnBase } from "@/lib/button-styles";
import { cn } from "@/lib/utils";

export type ConfirmInputOptions = {
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  rows?: number;
};

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Estilo do botão principal */
  tone?: "run" | "danger" | "default";
  /** Textarea opcional; se presente, resolve com string | null (null = cancelou). */
  input?: ConfirmInputOptions;
};

type ConfirmFn = {
  (opts: ConfirmOptions & { input: ConfirmInputOptions }): Promise<string | null>;
  (opts: ConfirmOptions): Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [inputValue, setInputValue] = useState("");
  const resolver = useRef<((value: boolean | string | null) => void) | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const close = useCallback((value: boolean | string | null) => {
    setOpen(false);
    const resolve = resolver.current;
    resolver.current = null;
    resolve?.(value);
  }, []);

  const confirm = useCallback((next: ConfirmOptions) => {
    if (resolver.current) {
      resolver.current(next.input ? null : false);
      resolver.current = null;
    }
    setOpts(next);
    setInputValue(next.input?.defaultValue ?? "");
    setOpen(true);
    return new Promise<boolean | string | null>((resolve) => {
      resolver.current = resolve;
    });
  }, []) as ConfirmFn;

  const value = useMemo(() => confirm, [confirm]);

  useEffect(() => {
    if (!open || !opts?.input) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open, opts?.input]);

  const tone = opts?.tone ?? "run";
  const confirmClass =
    tone === "danger"
      ? actionBtn.danger
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
            className="animate-fade-in absolute inset-0 bg-black/60 opacity-0 backdrop-blur-[2px]"
            aria-label="Fechar"
            onClick={() => close(opts.input ? null : false)}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="qa-confirm-title"
            aria-describedby={opts.description ? "qa-confirm-desc" : undefined}
            className="animate-fade-in-up relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-5 opacity-0 shadow-2xl"
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
            {opts.input && (
              <label className="mt-4 block text-left">
                <span className="text-xs font-medium text-muted-foreground">
                  {opts.input.label ?? "Comentário"}
                </span>
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  rows={opts.input.rows ?? 4}
                  placeholder={opts.input.placeholder}
                  className="mt-1.5 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className={cn(actionBtnBase, actionBtn.back)}
                onClick={() => close(opts.input ? null : false)}
              >
                {opts.cancelLabel ?? "Cancelar"}
              </button>
              <button
                type="button"
                className={cn(actionBtnBase, confirmClass)}
                autoFocus={!opts.input}
                onClick={() => close(opts.input ? inputValue : true)}
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
