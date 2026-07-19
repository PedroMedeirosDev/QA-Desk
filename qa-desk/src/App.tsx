import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { ProjectSidebar } from "@/components/ProjectSidebar";
import { Footer } from "@/components/Footer";
import { UserBar } from "@/components/UserBar";
import { ProjectLogo } from "@/components/ProjectLogo";
import { CHANNEL_LABELS } from "@/config/channels";
import { getProject, PROJECTS } from "@/config/projects";
import { TestEditorPage } from "@/pages/TestEditorPage";
import { TestListPage } from "@/pages/TestListPage";
import { BugListPage } from "@/pages/BugListPage";
import { HomologationPage } from "@/pages/HomologationPage";
import { HomologationsListPage } from "@/pages/HomologationsListPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { LoginPage } from "@/pages/LoginPage";
import { parseProjectRoute } from "@/lib/project-paths";
import type { ProjectSlug } from "@/types/test-record";

function ProjectLayout() {
  const { project, "*": rest } = useParams();
  const slug = project as ProjectSlug;
  const current = getProject(slug);
  const route = parseProjectRoute(slug, rest);
  if (!PROJECTS.some((p) => p.slug === slug)) {
    return <Navigate to="/projects/polygonus/app" replace />;
  }

  if (route.redirectTo) {
    return <Navigate to={route.redirectTo} replace />;
  }

  return (
    <div
      data-theme={current?.themeId ?? "default"}
      className="flex h-dvh overflow-hidden bg-background md:flex-row"
    >
      <ProjectSidebar activeSlug={slug} activeChannel={route.channel} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-border bg-card">
          <div className="flex items-center justify-between gap-4 border-l-4 border-primary px-6 py-3">
            <div className="flex min-w-0 items-center gap-4">
              {current && (
                <ProjectLogo logoFile={current.logoFile} label={current.label} size="lg" className="hidden sm:block" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {route.view === "dashboard"
                    ? "Dashboard"
                    : route.view === "homologations-list" || route.view === "homologation"
                      ? "Homologações"
                      : route.view === "bugs-list"
                        ? "Bugs reportados"
                        : "Registro de Testes"}
                </p>
                <h1 className="truncate text-lg font-semibold">
                  {route.view === "dashboard"
                    ? "Visão geral QA"
                    : route.view === "homologations-list"
                      ? "Todas as seções"
                      : route.view === "homologation"
                        ? "Detalhe da campanha"
                        : route.view === "bugs-list"
                          ? (current?.label ?? slug)
                          : (current?.label ?? slug)}
                  {route.channel &&
                    (route.view === "list" || route.view === "bugs-list") && (
                    <span className="ml-2 text-primary">· {CHANNEL_LABELS[route.channel]}</span>
                  )}
                </h1>
              </div>
            </div>
            <UserBar />
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto bg-background px-6 py-6">
          {route.view === "dashboard" ? (
            <DashboardPage project={slug} />
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
        </main>

        <Footer />
      </div>
    </div>
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
