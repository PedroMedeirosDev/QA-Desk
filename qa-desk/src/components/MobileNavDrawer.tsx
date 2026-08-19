import { useEffect, type ReactNode } from "react";

/** Drawer de navegação só no viewport estreito (`md` esconde). */
export function MobileNavDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Fechar menu"
        onClick={onClose}
      />
      <div className="relative flex h-full w-64 max-w-[85vw] flex-col bg-background shadow-2xl">
        {children}
      </div>
    </div>
  );
}
