import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { Info } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { ProjectSidebar } from "@/components/ProjectSidebar";
import { UserBar } from "@/components/UserBar";
import { PremiumTooltip } from "@/components/PremiumTooltip";
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
import { ImplantacoesListPage } from "@/pages/ImplantacoesListPage";
import { ImplantacaoPage } from "@/pages/ImplantacaoPage";
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
    ? "Perfil visitante"
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
    <div className="flex h-screen w-full overflow-hidden bg-[var(--background)]">
      <ProjectSidebar activeChannel={route.channel} visitorMode={isVisitor} />

      <div className="relative flex h-full min-w-0 flex-1 flex-col">
        <header className="flex h-[4rem] w-full shrink-0 items-center border-b border-[var(--border)] bg-[var(--background)] px-[1.5rem]">
          <div
            className="flex w-full items-center justify-between gap-[1rem] border-l-4 pl-[1rem] transition-colors duration-300"
            style={{ borderLeftColor: "var(--project-highlight-border, var(--project-accent))" }}
          >
            <div className="flex min-w-0 items-center gap-[1rem]">
              {current && (
                <ProjectLogo
                  logoFile={current.logoFile}
                  label={current.label}
                  size="lg"
                  className="hidden sm:block"
                />
              )}
              <div className="min-w-0">
                <p className="text-[0.75rem] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  {headerTitle}
                </p>
                <h1 className="flex min-w-0 items-center gap-[0.375rem] text-[1.125rem] font-semibold text-[var(--foreground)]">
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

        <main className="flex-1 overflow-y-auto bg-[var(--muted)] p-[1.5rem]">
          <div
            className={cn(
              "main-content-container main-content-glow relative min-h-full rounded-[0.75rem] border border-[var(--border)] border-t-2 bg-[var(--card)] p-[1.25rem] transition-all duration-300",
            )}
            style={{
              borderTopColor: "var(--project-accent)",
              ["--project-glow" as string]: theme.mainContentGlow,
            }}
          >
            {isVisitor ? (
              <VisitorWelcomePage />
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
