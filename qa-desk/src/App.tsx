import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { Info } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { ProjectSidebar } from "@/components/ProjectSidebar";
import { UserBar } from "@/components/UserBar";
import { AgentStatusBadge } from "@/components/AgentStatusBadge";
import { ProjectLogo } from "@/components/ProjectLogo";
import { CHANNEL_LABELS } from "@/config/channels";
import { PROJECTS } from "@/config/projects";
import { TestEditorPage } from "@/pages/TestEditorPage";
import { TestListPage } from "@/pages/TestListPage";
import { BugListPage } from "@/pages/BugListPage";
import { HomologationPage } from "@/pages/HomologationPage";
import { HomologationsListPage } from "@/pages/HomologationsListPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { KbCurationPage } from "@/pages/KbCurationPage";
import { ApiSuitePage } from "@/pages/ApiSuitePage";
import { LoginPage } from "@/pages/LoginPage";
import { VisitorWelcomePage } from "@/pages/VisitorWelcomePage";
import { ActiveProjectProvider, useActiveProject } from "@/lib/active-project";
import { parseProjectRoute } from "@/lib/project-paths";
import { cn } from "@/lib/utils";
import type { ProjectSlug } from "@/types/test-record";

const KB_CURATION_HELP =
  "Stream SSE na página (atualiza sozinha) + webhook GitHub (GITHUB_WEBHOOK_SECRET). O botão de sync é catch-up. Setup: server/github/README.md.";

function ProjectShell() {
  const { project: slugParam, "*": rest } = useParams();
  const slug = slugParam as ProjectSlug;
  const { theme, project: current } = useActiveProject();
  const { isVisitor } = useAuth();
  const route = parseProjectRoute(slug, rest);

  if (route.redirectTo) {
    return <Navigate to={route.redirectTo} replace />;
  }

  const headerTitle = isVisitor
    ? "Boas-vindas"
    : route.view === "dashboard"
      ? "Dashboard"
      : route.view === "kb-curation"
        ? "Curadoria KB"
        : route.view === "api-suite"
          ? "Suite API"
          : route.view === "homologations-list" || route.view === "homologation"
            ? "Homologações"
            : route.view === "bugs-list"
              ? "Bugs reportados"
              : "Registro de Testes";

  const headerSubtitle = isVisitor
    ? "Perfil visitante"
    : route.view === "dashboard"
      ? "Visão geral QA"
      : route.view === "kb-curation"
        ? "Rastreabilidade da base de conhecimento"
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
    <div className="flex h-dvh overflow-hidden bg-background md:flex-row">
      <ProjectSidebar activeChannel={route.channel} visitorMode={isVisitor} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="animate-fade-in-up-soft animation-delay-80 shrink-0 border-b border-border/60 bg-card opacity-0 dark:border-white/5">
          <div
            className="flex items-center justify-between gap-4 border-l-4 px-6 py-3 transition-colors duration-300"
            style={{ borderLeftColor: theme.highlight }}
          >
            <div className="flex min-w-0 items-center gap-4">
              {current && (
                <ProjectLogo
                  logoFile={current.logoFile}
                  label={current.label}
                  size="lg"
                  className="hidden sm:block"
                />
              )}
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {headerTitle}
                </p>
                <h1 className="flex min-w-0 items-center gap-1.5 text-lg font-semibold">
                  <span className="truncate">
                    {headerSubtitle}
                    {!isVisitor &&
                      route.channel &&
                      (route.view === "list" || route.view === "bugs-list") && (
                        <span className="ml-2 text-red-500">
                          · {CHANNEL_LABELS[route.channel]}
                        </span>
                      )}
                  </span>
                  {!isVisitor && route.view === "kb-curation" && (
                    <span
                      className="inline-flex shrink-0 text-muted-foreground/70 transition-colors hover:text-muted-foreground"
                      title={KB_CURATION_HELP}
                      aria-label={KB_CURATION_HELP}
                    >
                      <Info className="size-3.5" strokeWidth={1.75} />
                    </span>
                  )}
                </h1>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {!isVisitor && <AgentStatusBadge />}
              <UserBar />
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto bg-background px-4 py-4 sm:px-6 sm:py-6">
          <div
            className={cn(
              "main-content-container main-content-glow animate-fade-in-up-soft animation-delay-150 relative min-h-full rounded-xl border border-border/50 border-t-2 bg-card/50 p-4 opacity-0 transition-all duration-300 sm:p-5",
            )}
            style={{
              borderTopColor: theme.accent,
              ["--project-glow" as string]: theme.mainContentGlow,
            }}
          >
            {isVisitor ? (
              <VisitorWelcomePage />
            ) : route.view === "dashboard" ? (
              <DashboardPage project={slug} />
            ) : route.view === "kb-curation" ? (
              <KbCurationPage project={slug} />
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

function ProjectLayout() {
  const { project, "*": rest } = useParams();
  const slug = project as ProjectSlug;
  if (!PROJECTS.some((p) => p.slug === slug)) {
    return <Navigate to="/projects/polygonus/app" replace />;
  }

  const route = parseProjectRoute(slug, rest);
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
        <Route path="/" element={<Navigate to="/projects/polygonus/app" replace />} />
        <Route path="/projects/:project/*" element={<ProjectLayout />} />
      </Route>
    </Routes>
  );
}
