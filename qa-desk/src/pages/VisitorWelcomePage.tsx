import { Link } from "react-router-dom";
import {
  BookOpen,
  Eye,
  FolderOpen,
  Lock,
  MousePointerClick,
  ShieldCheck,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { PROJECTS } from "@/config/projects";
import { defaultChannel } from "@/config/channels";
import { actionBtn, actionBtnBase } from "@/lib/button-styles";
import { projectListPath } from "@/lib/project-paths";
import { cn } from "@/lib/utils";
import type { ProjectSlug } from "@/types/test-record";

const TIPS = [
  {
    icon: Eye,
    title: "Somente leitura",
    body: "Nada é gravado, executado ou apagado. Botões de criar, salvar e rodar suíte não aparecem neste modo.",
  },
  {
    icon: FolderOpen,
    title: "Só o que estiver marcado",
    body: "Você não vê o catálogo inteiro. Só testes e bugs com «Mostrar no portfólio». O resto continua privado no perfil de QA.",
  },
  {
    icon: MousePointerClick,
    title: "Abra um case publicado",
    body: "Clique num teste ou bug liberado para ver passos, resultado esperado e evidências. Chamado, logs e PII não entram nesta vista.",
  },
  {
    icon: ShieldCheck,
    title: "O que fica de fora",
    body: "Homologações internas, curadoria KB, implantações, suite API e automação. Visitante vê o recorte público, não o painel operacional.",
  },
] as const;

const SHOWCASE: ProjectSlug[] = ["polygonus", "anihype"];

export function VisitorWelcomePage() {
  return (
    <div className="mx-auto min-w-0 max-w-3xl space-y-8">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <BrandLogo size="md" className="text-foreground" />
          <div className="inline-flex h-8 items-center gap-2 rounded-full border border-border bg-muted/40 px-3 text-xs font-medium leading-none text-muted-foreground">
            <Lock className="size-3.5 shrink-0" strokeWidth={2} />
            Somente leitura
          </div>
        </div>
        <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Bem-vindo ao QA Desk
        </h2>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
          Este é um recorte público da bancada de QA. Mesmo em leitura, só entram
          cases que o QA marcou para o portfólio — o restante não aparece.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {TIPS.map(({ icon: Icon, title, body }) => (
          <li
            key={title}
            className="rounded-xl border border-border bg-card/60 p-4"
          >
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Icon className="size-4 shrink-0 text-primary" strokeWidth={2} />
              {title}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {body}
            </p>
          </li>
        ))}
      </ul>

      <div className="space-y-3">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <BookOpen className="size-4 text-primary" />
          Começar por um projeto
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {SHOWCASE.map((slug) => {
            const project = PROJECTS.find((p) => p.slug === slug);
            if (!project) return null;
            const href = projectListPath(slug, defaultChannel(slug));
            return (
              <Link
                key={slug}
                to={href}
                className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/30"
              >
                <p className="text-sm font-semibold text-foreground group-hover:text-primary">
                  {project.label}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {project.description}
                </p>
                <span
                  className={cn(
                    actionBtnBase,
                    actionBtn.ghost,
                    "mt-3 h-8 px-3 text-xs",
                  )}
                >
                  Abrir em leitura
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
