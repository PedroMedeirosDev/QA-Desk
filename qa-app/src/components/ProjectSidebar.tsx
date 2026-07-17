import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bug, ChevronLeft, ChevronRight, ClipboardList, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CHANNEL_LABELS,
  defaultChannel,
  getProjectChannels,
  type ProductChannel,
} from "@/config/channels";
import { getProject, PROJECTS } from "@/config/projects";
import { ProjectLogo } from "@/components/ProjectLogo";
import { projectBugsListPath, projectHomologationsListPath, projectListPath, isHomologationPath } from "@/lib/project-paths";
import type { ProjectSlug } from "@/types/test-record";

const STORAGE_KEY = "qa-sidebar-collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function CollapsedTooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="group/tooltip relative">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-full top-1/2 z-[100] ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground opacity-0 shadow-lg transition-opacity group-hover/tooltip:opacity-100 md:block"
      >
        {label}
      </span>
    </div>
  );
}

function subLinkClass(
  themeSub: (typeof PROJECTS)[0]["accent"]["subNav"],
  state: "idle" | "active" | "activeNested",
) {
  if (state === "active") return themeSub.active;
  if (state === "activeNested") return themeSub.activeNested;
  return cn(themeSub.idle, themeSub.hover);
}

function homologationsLinkClass(
  themeSub: (typeof PROJECTS)[0]["accent"]["subNav"],
  active: boolean,
) {
  return cn(
    themeSub.homologationsIdle,
    !active && themeSub.homologationsHover,
    active && themeSub.homologationsActive,
  );
}

export function ProjectSidebar({
  activeSlug,
  activeChannel,
}: {
  activeSlug: ProjectSlug;
  activeChannel?: ProductChannel;
}) {
  const channels = getProjectChannels(activeSlug);
  const activeProject = getProject(activeSlug);
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const sub = activeProject?.accent.subNav;

  return (
    <aside
      className={cn(
        "sidebar-nav relative flex shrink-0 border-b border-border bg-card transition-[width,height] duration-200 ease-in-out md:h-full md:flex-col md:border-b-0 md:border-r",
        collapsed
          ? "h-14 w-full flex-row overflow-visible md:h-full md:w-[4.25rem] md:flex-col"
          : "w-full flex-col overflow-hidden md:w-60",
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center border-border",
          collapsed
            ? "h-14 justify-center border-b-0 px-2 md:h-auto md:border-b md:py-3"
            : "justify-between border-b px-4 py-4",
        )}
      >
        {!collapsed && (
          <div className="min-w-0">
            <p className="sidebar-kicker text-muted-foreground">QA Automate</p>
            <p className="sidebar-heading mt-0.5 truncate">Projetos</p>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          aria-expanded={!collapsed}
          className="rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>
      </div>

      <nav
        className={cn(
          "flex flex-1 gap-1 p-2",
          collapsed
            ? "flex-row items-center overflow-visible md:flex-col md:overflow-y-auto"
            : "flex-col overflow-y-auto overflow-x-hidden",
        )}
        aria-label="Selecionar projeto"
      >
        {PROJECTS.map((project) => {
          const active = project.slug === activeSlug;
          const projectHref =
            project.slug === "polygonus"
              ? projectListPath(project.slug, defaultChannel(project.slug))
              : projectListPath(project.slug);
          const showChannels = !collapsed && active && channels.length > 0;
          const themeSub = project.accent.subNav;
          const homPath = projectHomologationsListPath(project.slug);
          const onHomologations = isHomologationPath(project.slug, location.pathname);

          const projectLink = (
            <Link
              to={projectHref}
              className={cn(
                "flex items-center rounded-lg border transition-colors",
                collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                active
                  ? cn(
                      project.accent.bgActive,
                      project.accent.border,
                      "shadow-sm hover:brightness-110",
                    )
                  : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground",
                active && project.themeId !== "default" && "text-white",
              )}
              aria-current={active && !activeChannel ? "page" : undefined}
            >
              <ProjectLogo logoFile={project.logoFile} label={project.label} size="sm" />
              {!collapsed && (
                <span className="min-w-0 flex-1">
                  <span className="block truncate sidebar-project-name">{project.label}</span>
                  {project.description && (
                    <span
                      className={cn(
                        "sidebar-project-desc block truncate opacity-80",
                        active && project.themeId !== "default" && "text-white/80",
                      )}
                    >
                      {project.description}
                    </span>
                  )}
                </span>
              )}
            </Link>
          );

          return (
            <div key={project.slug} className={cn("space-y-1", collapsed && "shrink-0")}>
              {collapsed ? (
                <CollapsedTooltip label={project.label}>{projectLink}</CollapsedTooltip>
              ) : (
                projectLink
              )}

              {showChannels && sub && (
                <div className={cn("ml-3 space-y-3 border-l pl-2", sub.rail)}>
                  {channels.map((ch) => {
                    const testsPath = projectListPath(project.slug, ch.id);
                    const bugsPath = projectBugsListPath(project.slug, ch.id);
                    const onBugs = location.pathname.startsWith(bugsPath);
                    const onTests =
                      activeChannel === ch.id &&
                      !onHomologations &&
                      !onBugs &&
                      !location.pathname.startsWith(bugsPath) &&
                      (location.pathname === testsPath ||
                        location.pathname.startsWith(`${testsPath}/`));

                    return (
                      <div key={ch.id} className="space-y-1">
                        <p className="sidebar-subitem px-2.5 text-[0.65rem] font-semibold uppercase tracking-wider opacity-60">
                          {CHANNEL_LABELS[ch.id]}
                        </p>
                        <ul className="space-y-0.5">
                          <li>
                            <Link
                              to={testsPath}
                              className={cn(
                                "sidebar-subitem flex items-center gap-2 rounded-md px-2.5 py-1.5 transition-colors",
                                subLinkClass(themeSub, onTests ? "active" : "idle"),
                              )}
                              aria-current={onTests ? "page" : undefined}
                            >
                              <ClipboardList className="size-3.5 shrink-0 opacity-80" />
                              Testes
                            </Link>
                          </li>
                          <li>
                            <Link
                              to={bugsPath}
                              className={cn(
                                "sidebar-subitem flex items-center gap-2 rounded-md px-2.5 py-1.5 transition-colors",
                                subLinkClass(themeSub, onBugs ? "active" : "idle"),
                              )}
                              aria-current={onBugs ? "page" : undefined}
                            >
                              <Bug className="size-3.5 shrink-0 opacity-80" />
                              Bugs
                            </Link>
                          </li>
                        </ul>
                      </div>
                    );
                  })}
                  <div className={cn("border-t pt-2", sub.rail)}>
                    <Link
                      to={homPath}
                      className={cn(
                        "sidebar-subitem flex items-center gap-2 rounded-md px-2.5 py-1.5 transition-colors",
                        homologationsLinkClass(themeSub, onHomologations),
                      )}
                      aria-current={onHomologations ? "page" : undefined}
                    >
                      <ListChecks className="size-3.5 shrink-0 opacity-90" />
                      Homologações
                    </Link>
                  </div>
                </div>
              )}

              {collapsed && active && sub && (
                <CollapsedTooltip label="Homologações">
                  <Link
                    to={homPath}
                    className={cn(
                      "flex justify-center rounded-lg border px-2 py-2 transition-colors",
                      onHomologations
                        ? cn(project.accent.subNav.homologationsActive)
                        : cn(
                            "border-transparent text-muted-foreground",
                            project.accent.subNav.homologationsHover,
                          ),
                    )}
                    aria-current={onHomologations ? "page" : undefined}
                  >
                    <ListChecks className="size-4" />
                  </Link>
                </CollapsedTooltip>
              )}
            </div>
          );
        })}
      </nav>

      {!collapsed && (
        <p className="sidebar-footer shrink-0 border-t border-border px-4 py-3 text-muted-foreground">
          {PROJECTS.length} projeto(s)
        </p>
      )}
    </aside>
  );
}
