import { Link, useLocation } from "react-router-dom";
import { Home, Lock } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { Footer } from "@/components/Footer";
import { ProjectLogo } from "@/components/ProjectLogo";
import { PROJECTS } from "@/config/projects";
import { defaultChannel } from "@/config/channels";
import { VISITOR_HOME_PATH } from "@/lib/visitor";
import { projectListPath } from "@/lib/project-paths";
import { cn } from "@/lib/utils";
import type { ProjectSlug } from "@/types/test-record";

const SHOWCASE: ProjectSlug[] = ["polygonus", "anihype"];

export function VisitorSidebar({ className }: { className?: string }) {
  const { pathname } = useLocation();
  const onHome = pathname === VISITOR_HOME_PATH || pathname === "/";

  return (
    <aside
      className={cn(
        "relative flex h-full w-64 shrink-0 flex-col border-r border-border bg-[var(--sidebar)]",
        className,
      )}
    >
      <header className="flex h-[4rem] shrink-0 items-center border-b border-[var(--border)] px-[0.75rem]">
        <BrandLogo size="sidebar" />
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Lock className="size-3.5" strokeWidth={2} />
            Somente leitura
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Só o que estiver marcado no portfólio. Nada é alterado.
          </p>
        </div>

        <nav className="flex flex-col gap-1" aria-label="Visitante">
          <Link
            to={VISITOR_HOME_PATH}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
              onHome
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
            aria-current={onHome ? "page" : undefined}
          >
            <Home className="size-4 shrink-0" />
            Início
          </Link>

          <p className="mt-3 px-2.5 text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">
            Projetos
          </p>
          {SHOWCASE.map((slug) => {
            const project = PROJECTS.find((p) => p.slug === slug);
            if (!project) return null;
            const href = projectListPath(slug, defaultChannel(slug));
            const active = pathname.startsWith(`/projects/${slug}`);
            return (
              <Link
                key={slug}
                to={href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
                  active
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <ProjectLogo
                  logoFile={project.logoFile}
                  label={project.label}
                  size="sm"
                  className="size-6"
                />
                <span className="truncate">{project.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <Footer variant="sidebar" />
    </aside>
  );
}
