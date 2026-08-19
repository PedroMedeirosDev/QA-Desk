import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { Info, Menu } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { ProjectSidebar } from "@/components/ProjectSidebar";
import { UserBar } from "@/components/UserBar";
import { MobileNavDrawer } from "@/components/MobileNavDrawer";
import { PremiumTooltip } from "@/components/PremiumTooltip";
import { ProjectLogo } from "@/components/ProjectLogo";
import { CHANNEL_LABELS, defaultChannel } from "@/config/channels";
import { PROJECTS } from "@/config/projects";
import { TestEditorPage } from "@/pages/TestEditorPage";
import { TestListPage } from "@/pages/TestListPage";
import { BugListPage } from "@/pages/BugListPage";
import { HomologationPage } from "@/pages/HomologationPage";
import { HomologationsListPage } from "@/pages/HomologationsListPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { KbCurationPage } from "@/pages/KbCurationPage";
import { ImplantacoesListPage } from "@/pages/ImplantacoesListPage";
import { ImplantacaoPage } from "@/pages/ImplantacaoPage";
import { ApiSuitePage } from "@/pages/ApiSuitePage";
import { LoginPage } from "@/pages/LoginPage";
import { VisitorWelcomePage } from "@/pages/VisitorWelcomePage";
import { VisitorShell } from "@/pages/VisitorShell";
import { ActiveProjectProvider, useActiveProject } from "@/lib/active-project";
import { parseProjectRoute, projectListPath } from "@/lib/project-paths";
import { isVisitorBlockedView, VISITOR_HOME_PATH } from "@/lib/visitor";
import { cn } from "@/lib/utils";
import type { ProjectSlug } from "@/types/test-record";

const KB_CURATION_HELP =
  "Stream SSE na página (atualiza sozinha) + webhook GitHub (GITHUB_WEBHOOK_SECRET). O botão de sync é catch-up. Setup: server/github/README.md.";

function ProjectShell() {
  const { project: slugParam, "*": rest } = useParams();
  const slug = slugParam as ProjectSlug;
  const { pathname } = useLocation();
  const { theme, project: current } = useActiveProject();
  const { isVisitor } = useAuth();
  const route = parseProjectRoute(slug, rest);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  if (route.redirectTo) {
    return <Navigate to={route.redirectTo} replace />;
  }

  const headerTitle = isVisitor
    ? "Modo visitante"
    : route.view === "dashboard"
      ? "Dashboard"
      : route.view === "kb-curation"
        ? "Curadoria KB"
        : route.view === "implantacoes-list" || route.view === "implantacao"
          ? "Implantações"
          : route.view === "api-suite"
            ? "Suite API"
            : route.view === "homologations-list" || route.view === "homologation"
              ? "Homologações"
              : route.view === "bugs-list"
                ? "Bugs reportados"
                : "Registro de Testes";

  const headerSubtitle = isVisitor
    ? "Somente leitura"
    : route.view === "dashboard"
      ? "Visão geral QA"
      : route.view === "kb-curation"
        ? "Rastreabilidade da base de conhecimento"
        : route.view === "implantacoes-list"
          ? "Tipos e requisitos operacionais"
          : route.view === "implantacao"
            ? "Checklist do tipo"
            : route.view === "api-suite"
              ? "Newman / Postman"
              : route.view === "homologations-list"
                ? "Todas as seções"
                : route.view === "homologation"
                  ? "Detalhe da campanha"
                  : route.view === "bugs-list"
                    ? (current?.label ?? slug)
                    : (current?.label ?? slug);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[var(--background)]">
      <ProjectSidebar
        activeChannel={route.channel}
        visitorMode={isVisitor}
        className="hidden md:flex"
      />
      <MobileNavDrawer open={menuOpen} onClose={() => setMenuOpen(false)}>
        <ProjectSidebar
          activeChannel={route.channel}
          visitorMode={isVisitor}
          forceExpanded
        />
      </MobileNavDrawer>

      <div className="relative flex h-full min-w-0 flex-1 flex-col">
        <header className="flex h-14 w-full shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--background)] px-3 sm:h-16 sm:px-6">
          <button
            type="button"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border text-foreground md:hidden"
            aria-label="Abrir menu"
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="size-4" />
          </button>
          <div
            className="flex min-w-0 flex-1 items-center justify-between gap-3 border-l-4 pl-3 transition-colors duration-300 sm:gap-4 sm:pl-4"
            style={{ borderLeftColor: "var(--project-highlight-border, var(--project-accent))" }}
          >
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              {current && (
                <>
                  <ProjectLogo
                    logoFile={current.logoFile}
                    label={current.label}
                    size="sm"
                    className="size-8 shrink-0 sm:hidden"
                  />
                  <ProjectLogo
                    logoFile={current.logoFile}
                    label={current.label}
                    size="lg"
                    className="hidden sm:block"
                  />
                </>
              )}
              <div className="min-w-0">
                <p className="text-[0.75rem] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  {headerTitle}
                </p>
                <h1 className="flex min-w-0 items-center gap-[0.375rem] text-sm font-semibold text-[var(--foreground)] sm:text-[1.125rem]">
                  <span className="truncate">
                    {headerSubtitle}
                    {!isVisitor &&
                      route.channel &&
                      (route.view === "list" || route.view === "bugs-list") && (
                        <span className="ml-[0.5rem] text-[var(--primary)]">
                          · {CHANNEL_LABELS[route.channel]}
                        </span>
                      )}
                  </span>
                  {!isVisitor && route.view === "kb-curation" && (
                    <PremiumTooltip label={KB_CURATION_HELP} side="bottom" wide>
                      <span
                        className="inline-flex shrink-0 text-[var(--muted-foreground)]/70 transition-colors hover:text-[var(--muted-foreground)]"
                        aria-label={KB_CURATION_HELP}
                      >
                        <Info className="size-[0.875rem]" strokeWidth={1.75} />
                      </span>
                    </PremiumTooltip>
                  )}
                </h1>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-[0.75rem]">
              <UserBar />
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-[var(--muted)] p-3 sm:p-6">
          <div
            className={cn(
              "main-content-container main-content-glow relative min-h-full min-w-0 rounded-[0.75rem] border border-[var(--border)] border-t-2 bg-[var(--card)] p-3 sm:p-5",
            )}
            style={{
              borderTopColor: "var(--project-accent)",
              ["--project-glow" as string]: theme.mainContentGlow,
            }}
          >
            {isVisitor &&
            (route.isNew ||
              route.view === "kb-curation" ||
              route.view === "api-suite" ||
              route.view === "implantacoes-list" ||
              route.view === "implantacao" ||
              route.view === "dashboard" ||
              route.view === "homologations-list" ||
              route.view === "homologation") ? (
              <Navigate
                to={
                  slug === "desk"
                    ? VISITOR_HOME_PATH
                    : `/projects/${slug}/${route.channel ?? "app"}`
                }
                replace
              />
            ) : route.view === "dashboard" ? (
              <DashboardPage project={slug} />
            ) : route.view === "kb-curation" ? (
              <KbCurationPage project={slug} />
            ) : route.view === "implantacoes-list" ? (
              <ImplantacoesListPage project={slug} />
            ) : route.view === "implantacao" && route.impSlug ? (
              <ImplantacaoPage project={slug} impSlug={route.impSlug} />
            ) : route.view === "api-suite" ? (
              <ApiSuitePage project={slug} />
            ) : route.view === "list" ? (
              <TestListPage project={slug} channel={route.channel} />
            ) : route.view === "bugs-list" ? (
              <BugListPage project={slug} channel={route.channel} />
            ) : route.view === "homologations-list" ? (
              <HomologationsListPage project={slug} />
            ) : route.view === "homologation" && route.homSlug ? (
              <HomologationPage project={slug} homSlug={route.homSlug} />
            ) : (
              <TestEditorPage
                project={slug}
                channel={route.channel}
                id={route.isNew ? undefined : route.id}
                isNew={route.isNew}
                editorKind={route.editorKind}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function HomeRedirect() {
  const { isVisitor, ready, profile } = useAuth();
  if (!ready || !profile) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }
  return (
    <Navigate
      to={isVisitor ? VISITOR_HOME_PATH : "/projects/polygonus/app"}
      replace
    />
  );
}

function ProjectLayout() {
  const { isVisitor } = useAuth();
  const { project, "*": rest } = useParams();
  const slug = project as ProjectSlug;
  if (!PROJECTS.some((p) => p.slug === slug)) {
    return <Navigate to="/projects/polygonus/app" replace />;
  }

  if (isVisitor && slug === "desk") {
    return <Navigate to={VISITOR_HOME_PATH} replace />;
  }

  const route = parseProjectRoute(slug, rest);
  if (isVisitor && isVisitorBlockedView(route.view, route.isNew)) {
    return (
      <Navigate
        to={projectListPath(slug, route.channel ?? defaultChannel(slug))}
        replace
      />
    );
  }
  if (route.redirectTo) {
    return <Navigate to={route.redirectTo} replace />;
  }

  return (
    <ActiveProjectProvider project={slug}>
      <ProjectShell />
    </ActiveProjectProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/welcome" element={<VisitorShell />}>
          <Route index element={<VisitorWelcomePage />} />
        </Route>
        <Route path="/projects/:project/*" element={<ProjectLayout />} />
      </Route>
    </Routes>
  );
}
