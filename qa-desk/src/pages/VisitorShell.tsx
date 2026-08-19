import { Component, useEffect, useState, type ReactNode } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { VisitorSidebar } from "@/components/VisitorSidebar";
import { UserBar } from "@/components/UserBar";
import { MobileNavDrawer } from "@/components/MobileNavDrawer";

class VisitorErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="flex min-h-[12rem] items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Não foi possível carregar esta tela. Volte e abra de novo, ou recarregue a página.
        </div>
      );
    }
    return this.props.children;
  }
}

/** Shell neutro (sem cor de projeto) para a home do visitante. */
export function VisitorShell() {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <VisitorSidebar className="hidden md:flex" />
      <MobileNavDrawer open={menuOpen} onClose={() => setMenuOpen(false)}>
        <VisitorSidebar />
      </MobileNavDrawer>

      <div className="relative flex h-full min-w-0 flex-1 flex-col">
        <header className="flex h-14 w-full shrink-0 items-center gap-3 border-b border-border bg-background px-3 sm:h-16 sm:px-6">
          <button
            type="button"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border text-foreground md:hidden"
            aria-label="Abrir menu"
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="size-4" />
          </button>
          <div className="flex min-w-0 flex-1 items-center justify-between gap-3 border-l-4 border-l-primary pl-3 sm:pl-4">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
                QA Desk
              </p>
              <h1 className="truncate text-sm font-semibold text-foreground sm:text-lg">
                <span className="sm:hidden">Somente leitura</span>
                <span className="hidden sm:inline">Modo visitante · somente leitura</span>
              </h1>
            </div>
            <UserBar />
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-muted p-4 sm:p-6">
          <div className="relative min-h-full min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5">
            <VisitorErrorBoundary>
              <Outlet />
            </VisitorErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
