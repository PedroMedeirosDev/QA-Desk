import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Bug,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FlaskConical,
  GitPullRequest,
  Globe,
  Home,
  LayoutDashboard,
  ListChecks,
  Lock,
  MessageSquare,
  Rocket,
  Smartphone,
  PanelTop,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CHANNEL_LABELS,
  defaultChannel,
  getProjectChannels,
  type ProductChannel,
} from "@/config/channels";
import { resolveProjectTheme } from "@/config/project-themes";
import { getProject, PROJECTS } from "@/config/projects";
import { BrandLogo } from "@/components/BrandLogo";
import { Footer } from "@/components/Footer";
import { PremiumTooltip } from "@/components/PremiumTooltip";
import { ProjectLogo } from "@/components/ProjectLogo";
import { useActiveProject } from "@/lib/active-project";
import { api } from "@/lib/api";
import {
  isApiSuitePath,
  isDashboardPath,
  isGestorCasesPath,
  isHomologationPath,
  isImplantacoesPath,
  isKbCurationPath,
  projectApiSuitePath,
  projectBugsListPath,
  projectDashboardPath,
  projectGestorCasesPath,
  projectHomologationsListPath,
  projectImplantacoesListPath,
  projectKbCurationPath,
  projectListPath,
} from "@/lib/project-paths";
import { VISITOR_HOME_PATH } from "@/lib/visitor";

const STORAGE_KEY = "qa-sidebar-collapsed";

const CHANNEL_ICON: Record<ProductChannel, typeof Smartphone> = {
  app: Smartphone,
  web: Globe,
  portal: PanelTop,
};

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Tooltip à direita — sidebar recolhida (seta aponta para o ícone). */
function CollapsedTooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <PremiumTooltip label={label} side="right" className="flex w-full justify-center">
      {children}
    </PremiumTooltip>
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
  activeChannel,
  visitorMode = false,
  botMode = false,
  className,
  forceExpanded = false,
}: {
  activeChannel?: ProductChannel;
  /** Visitante: só marca + aviso — sem navegação operacional. */
  visitorMode?: boolean;
  /** Bot Grok: só Polygonus → Repasse. */
  botMode?: boolean;
  className?: string;
  /** Menu em overlay (mobile): sempre expandido. */
  forceExpanded?: boolean;
}) {
  const { activeProject: activeSlug, brandTheme } = useActiveProject();
  const channels = getProjectChannels(activeSlug!);
  const activeProjectCfg = getProject(activeSlug!);
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() =>
    visitorMode || botMode || forceExpanded ? false : readCollapsed,
  );
  const isCollapsed = forceExpanded ? false : collapsed;
  const [kbRereviewCount, setKbRereviewCount] = useState(0);
  /** Submenu do projeto: expandido no ativo; clicar de novo no card recolhe. */
  const [menuExpandedSlug, setMenuExpandedSlug] = useState<string | null>(
    activeSlug ?? null,
  );

  useEffect(() => {
    if (visitorMode || botMode) setCollapsed(false);
  }, [visitorMode, botMode]);

  useEffect(() => {
    setMenuExpandedSlug(activeSlug ?? null);
  }, [activeSlug]);

  useEffect(() => {
    if (forceExpanded) return;
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed, forceExpanded]);

  useEffect(() => {
    if (visitorMode || botMode || activeSlug !== "polygonus") {
      setKbRereviewCount(0);
      return;
    }
    let cancelled = false;
    api
      .listKbCuration("polygonus")
      .then((response) => {
        if (!cancelled) setKbRereviewCount(response.metrics.awaitingRereview ?? 0);
      })
      .catch(() => {
        if (!cancelled) setKbRereviewCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSlug, location.pathname, visitorMode, botMode]);

  const sub = activeProjectCfg?.accent.subNav;

  return (
    <aside
      className={cn(
        "sidebar-nav relative flex h-full shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar)] transition-[width] duration-200 ease-in-out",
        isCollapsed ? "w-[4.5rem]" : "w-64",
        className,
      )}
    >
      {/* Cabeçalho — logo horizontal (arte já inclui “QA DESK”) */}
      <header
        className={cn(
          "relative flex h-[4rem] shrink-0 items-center border-b border-[var(--border)]",
          isCollapsed ? "justify-center gap-[0.25rem] px-[0.5rem]" : "gap-[0.5rem] px-[0.75rem]",
        )}
      >
        {isCollapsed ? (
          <CollapsedTooltip label="QA Desk">
            <BrandLogo size="icon" />
          </CollapsedTooltip>
        ) : (
          <div className="flex min-h-14 min-w-0 flex-1 items-center">
            <BrandLogo size="sidebar" />
          </div>
        )}
      </header>

      {!visitorMode && !botMode && (
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
          aria-expanded={!isCollapsed}
          className="group absolute -right-[0.75rem] top-[4rem] z-50 hidden h-[1.5rem] w-[1.5rem] -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] shadow-sm transition-all duration-200 hover:bg-[var(--accent)] hover:text-[var(--foreground)] md:flex"
        >
          {isCollapsed ? (
            <ChevronRight className="size-3.5" strokeWidth={2} />
          ) : (
            <ChevronLeft className="size-3.5" strokeWidth={2} />
          )}
          {/* Tooltip renderizando para a DIREITA do botão */}
          <div
            role="tooltip"
            className="pointer-events-none absolute top-1/2 left-full z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-md transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 dark:bg-slate-100 dark:text-slate-900"
          >
            {isCollapsed ? "Expandir menu" : "Recolher menu"}
            {/* Setinha apontando para a esquerda */}
            <div
              aria-hidden
              className="absolute top-1/2 right-full -translate-y-1/2 border-[5px] border-transparent border-r-slate-800 dark:border-r-slate-100"
            />
          </div>
        </button>
      )}

      {visitorMode && !isCollapsed && (
        <div className="space-y-2 px-3 pt-3">
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
            <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Lock className="size-3.5" strokeWidth={2} />
              Somente leitura
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Você consulta. Nada é gravado nem executado.
            </p>
          </div>
          <Link
            to={VISITOR_HOME_PATH}
            className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <Home className="size-4 shrink-0" />
            Início
          </Link>
        </div>
      )}
      <nav
        className="sidebar-scroll flex min-h-0 flex-1 flex-col gap-[0.5rem] overflow-x-hidden overflow-y-auto p-[0.625rem]"
        aria-label="Selecionar projeto"
      >
        {PROJECTS.map((project) => {
          if (botMode && project.slug !== "polygonus") return null;
          if (visitorMode && project.slug === "desk") return null;
          const isSelected = project.slug === activeSlug;
          const itemTheme = isSelected
            ? resolveProjectTheme(project.slug)
            : brandTheme;
          const isDesk = project.slug === "desk";
          const projectHref = botMode
            ? projectGestorCasesPath(project.slug)
            : isDesk
              ? projectApiSuitePath(project.slug)
              : project.slug === "polygonus"
                ? projectListPath(project.slug, defaultChannel(project.slug))
                : projectListPath(project.slug);
          const menuOpen = isSelected && menuExpandedSlug === project.slug;
          const showChannels =
            !botMode && !isCollapsed && menuOpen && channels.length > 0 && !isDesk;
          const showDeskSuiteOnly = !isCollapsed && menuOpen && isDesk && !visitorMode;
          const themeSub = project.accent.subNav;
          const homPath = projectHomologationsListPath(project.slug);
          const dashPath = projectDashboardPath(project.slug);
          const kbCurationPath = projectKbCurationPath(project.slug);
          const implantacoesPath = projectImplantacoesListPath(project.slug);
          const repassePath = projectGestorCasesPath(project.slug);
          const apiSuitePath = projectApiSuitePath(project.slug);
          const onHomologations = isHomologationPath(project.slug, location.pathname);
          const onDashboard = isDashboardPath(project.slug, location.pathname);
          const onKbCuration = isKbCurationPath(project.slug, location.pathname);
          const onImplantacoes = isImplantacoesPath(project.slug, location.pathname);
          const onRepasse = isGestorCasesPath(project.slug, location.pathname);
          const onApiSuite = isApiSuitePath(project.slug, location.pathname);

          const projectCard = (
            <Link
              to={projectHref}
              onClick={(e) => {
                if (!isSelected) return;
                // Já no projeto: só abre/fecha o submenu (não força nova navegação)
                e.preventDefault();
                setMenuExpandedSlug((prev) =>
                  prev === project.slug ? null : project.slug,
                );
              }}
              className={cn(
                "flex items-center rounded-xl border transition-all duration-300",
                isCollapsed ? "justify-center p-2" : "gap-3 px-3 py-3",
                itemTheme.sidebarCardBg,
                isSelected
                  ? cn(itemTheme.sidebarBorder, "border-2")
                  : "border-border hover:border-slate-300 hover:bg-white dark:border-zinc-800/80 dark:hover:border-zinc-600 dark:hover:bg-zinc-900/80",
              )}
              style={
                isSelected
                  ? {
                      boxShadow: itemTheme.cardShadow,
                      borderColor: itemTheme.highlight,
                    }
                  : undefined
              }
              aria-current={isSelected && !activeChannel ? "page" : undefined}
              aria-expanded={isSelected ? menuOpen : undefined}
            >
              <ProjectLogo
                logoFile={project.logoFile}
                label={project.label}
                size="sm"
                className={cn(
                  isSelected && cn("ring-1 ring-offset-1", itemTheme.logoRingOffset),
                )}
                style={
                  isSelected
                    ? ({
                        ["--tw-ring-color" as string]: itemTheme.highlight,
                        filter: `drop-shadow(0 0 6px ${itemTheme.highlight}88)`,
                      } as CSSProperties)
                    : undefined
                }
              />
              {!isCollapsed && (
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate sidebar-project-name",
                      isSelected ? itemTheme.sidebarText : "text-slate-600 dark:text-zinc-400",
                    )}
                  >
                    {project.label}
                  </span>
                  {project.description && (
                    <span
                      className={cn(
                        "sidebar-project-desc mt-0.5 block truncate",
                        isSelected
                          ? "text-slate-500 dark:text-zinc-400"
                          : "text-slate-400 dark:text-zinc-600",
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
            <div key={project.slug} className={cn("space-y-2", isCollapsed && "shrink-0")}>
              {isCollapsed ? (
                <CollapsedTooltip label={project.label}>{projectCard}</CollapsedTooltip>
              ) : (
                projectCard
              )}

              {showDeskSuiteOnly && (
                <div className="ml-1 space-y-1 border-l border-border pl-3 pt-1 dark:border-zinc-800">
                  <Link
                    to={apiSuitePath}
                    className={cn(
                      "sidebar-subitem flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors",
                      homologationsLinkClass(themeSub, onApiSuite),
                    )}
                    aria-current={onApiSuite ? "page" : undefined}
                  >
                    <FlaskConical className="size-3.5 shrink-0 opacity-90" />
                    Suite API
                  </Link>
                </div>
              )}

              {showChannels && sub && (
                <div className="ml-1 space-y-0 border-l border-border pl-3 pt-1 dark:border-zinc-800">
                  {channels.map((ch) => {
                    const ChannelIcon = CHANNEL_ICON[ch.id];
                    const testsPath = projectListPath(project.slug, ch.id);
                    const bugsPath = projectBugsListPath(project.slug, ch.id);
                    const onBugs = location.pathname.startsWith(bugsPath);
                    const onTests =
                      activeChannel === ch.id &&
                      !onHomologations &&
                      !onDashboard &&
                      !onKbCuration &&
                      !onImplantacoes &&
                      !onRepasse &&
                      !onApiSuite &&
                      !onBugs &&
                      !location.pathname.startsWith(bugsPath) &&
                      (location.pathname === testsPath ||
                        location.pathname.startsWith(`${testsPath}/`));

                    return (
                      <div
                        key={ch.id}
                        className="mt-6 space-y-1.5 first:mt-2"
                      >
                        <p className="flex items-center gap-1.5 px-2 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">
                          <ChannelIcon className="size-3.5 shrink-0 text-slate-500 dark:text-zinc-500" />
                          {CHANNEL_LABELS[ch.id]}
                        </p>
                        <ul className="space-y-1">
                          <li>
                            <Link
                              to={testsPath}
                              className={cn(
                                "sidebar-subitem flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors",
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
                                "sidebar-subitem flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors",
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
                  <div className="mt-6 space-y-1 border-t border-border pt-3 dark:border-zinc-800">
                    {!visitorMode && !botMode && (
                    <Link
                      to={dashPath}
                      className={cn(
                        "sidebar-subitem flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors",
                        homologationsLinkClass(themeSub, onDashboard),
                      )}
                      aria-current={onDashboard ? "page" : undefined}
                    >
                      <LayoutDashboard className="size-3.5 shrink-0 opacity-90" />
                      Dashboard
                    </Link>
                    )}
                    {!botMode && (
                    <Link
                      to={homPath}
                      className={cn(
                        "sidebar-subitem flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors",
                        homologationsLinkClass(themeSub, onHomologations),
                      )}
                      aria-current={onHomologations ? "page" : undefined}
                    >
                      <ListChecks className="size-3.5 shrink-0 opacity-90" />
                      Homologações
                    </Link>
                    )}
                    {!visitorMode && !botMode && project.slug === "polygonus" && (
                      <Link
                        to={kbCurationPath}
                        className={cn(
                          "sidebar-subitem flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors",
                          homologationsLinkClass(themeSub, onKbCuration),
                        )}
                        aria-current={onKbCuration ? "page" : undefined}
                      >
                        <GitPullRequest className="size-3.5 shrink-0 opacity-90" />
                        <span className="min-w-0 flex-1">Curadoria KB</span>
                        {kbRereviewCount > 0 && (
                          <PremiumTooltip
                            label={`${kbRereviewCount} PR(s) para re-revisar`}
                            side="right"
                          >
                            <span
                              className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[0.625rem] font-semibold tabular-nums text-zinc-950"
                              aria-label={`${kbRereviewCount} PR(s) para re-revisar`}
                            >
                              {kbRereviewCount}
                            </span>
                          </PremiumTooltip>
                        )}
                      </Link>
                    )}
                    {!visitorMode && project.slug === "polygonus" && (
                      <Link
                        to={repassePath}
                        className={cn(
                          "sidebar-subitem flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors",
                          homologationsLinkClass(themeSub, onRepasse),
                        )}
                        aria-current={onRepasse ? "page" : undefined}
                      >
                        <MessageSquare className="size-3.5 shrink-0 opacity-90" />
                        Repasse
                      </Link>
                    )}
                    {!visitorMode && !botMode && project.slug === "polygonus" && (
                      <Link
                        to={implantacoesPath}
                        className={cn(
                          "sidebar-subitem flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors",
                          homologationsLinkClass(themeSub, onImplantacoes),
                        )}
                        aria-current={onImplantacoes ? "page" : undefined}
                      >
                        <Rocket className="size-3.5 shrink-0 opacity-90" />
                        Implantações
                      </Link>
                    )}
                    {!visitorMode && !botMode && (
                    <Link
                      to={apiSuitePath}
                      className={cn(
                        "sidebar-subitem flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors",
                        homologationsLinkClass(themeSub, onApiSuite),
                      )}
                      aria-current={onApiSuite ? "page" : undefined}
                    >
                      <FlaskConical className="size-3.5 shrink-0 opacity-90" />
                      Suite API
                    </Link>
                    )}
                  </div>
                </div>
              )}

              {isCollapsed && isSelected && isDesk && menuOpen && (
                <CollapsedTooltip label="Suite API">
                  <Link
                    to={apiSuitePath}
                    className={cn(
                      "flex justify-center rounded-xl border px-2 py-2 transition-colors",
                      onApiSuite
                        ? cn(project.accent.subNav.homologationsActive)
                        : cn(
                            "border-transparent text-muted-foreground",
                            project.accent.subNav.homologationsHover,
                          ),
                    )}
                    aria-current={onApiSuite ? "page" : undefined}
                  >
                    <FlaskConical className="size-4" />
                  </Link>
                </CollapsedTooltip>
              )}

              {isCollapsed && isSelected && sub && !isDesk && menuOpen && (
                <>
                  <CollapsedTooltip label="Dashboard">
                    <Link
                      to={dashPath}
                      className={cn(
                        "flex justify-center rounded-xl border px-2 py-2 transition-colors",
                        onDashboard
                          ? cn(project.accent.subNav.homologationsActive)
                          : cn(
                              "border-transparent text-muted-foreground",
                              project.accent.subNav.homologationsHover,
                            ),
                      )}
                      aria-current={onDashboard ? "page" : undefined}
                    >
                      <LayoutDashboard className="size-4" />
                    </Link>
                  </CollapsedTooltip>
                  <CollapsedTooltip label="Homologações">
                    <Link
                      to={homPath}
                      className={cn(
                        "flex justify-center rounded-xl border px-2 py-2 transition-colors",
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
                  {project.slug === "polygonus" && (
                    <CollapsedTooltip
                      label={
                        kbRereviewCount > 0
                          ? `Curadoria KB · ${kbRereviewCount} para re-revisar`
                          : "Curadoria KB"
                      }
                    >
                      <Link
                        to={kbCurationPath}
                        className={cn(
                          "relative flex justify-center rounded-xl border px-2 py-2 transition-colors",
                          onKbCuration
                            ? cn(project.accent.subNav.homologationsActive)
                            : cn(
                                "border-transparent text-muted-foreground",
                                project.accent.subNav.homologationsHover,
                              ),
                        )}
                        aria-current={onKbCuration ? "page" : undefined}
                      >
                        <GitPullRequest className="size-4" />
                        {kbRereviewCount > 0 && (
                          <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-orange-500" />
                        )}
                      </Link>
                    </CollapsedTooltip>
                  )}
                  {project.slug === "polygonus" && (
                    <CollapsedTooltip label="Implantações">
                      <Link
                        to={implantacoesPath}
                        className={cn(
                          "flex justify-center rounded-xl border px-2 py-2 transition-colors",
                          onImplantacoes
                            ? cn(project.accent.subNav.homologationsActive)
                            : cn(
                                "border-transparent text-muted-foreground",
                                project.accent.subNav.homologationsHover,
                              ),
                        )}
                        aria-current={onImplantacoes ? "page" : undefined}
                      >
                        <Rocket className="size-4" />
                      </Link>
                    </CollapsedTooltip>
                  )}
                </>
              )}
            </div>
          );
        })}
      </nav>

      {!isCollapsed && <Footer variant="sidebar" />}
    </aside>
  );
}
