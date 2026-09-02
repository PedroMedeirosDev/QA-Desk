import { Link } from "react-router-dom";
import {
  ArrowRight,
  Eye,
  FolderOpen,
  Lock,
  MousePointerClick,
  ShieldCheck,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { ProjectLogo } from "@/components/ProjectLogo";
import { PROJECTS } from "@/config/projects";
import { defaultChannel } from "@/config/channels";
import { projectListPath } from "@/lib/project-paths";
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
    body: "Clique num teste ou bug liberado para ver passos e resultado esperado. Prints, chamado, logs e PII não entram nesta vista.",
  },
  {
    icon: ShieldCheck,
    title: "O que fica de fora",
    body: "Curadoria KB, implantações, suite API e automação. Homologações só aparecem se o QA marcar a campanha no portfólio.",
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
          <span className="hidden md:inline">
            Este é um recorte público da bancada. Escolha um projeto no menu à
            esquerda para ver os cases publicados daquele produto.
          </span>
          <span className="md:hidden">
            Este é um recorte público da bancada. Abra o menu e escolha um
            projeto para ver os cases publicados daquele produto.
          </span>
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

      <div className="grid gap-3 md:hidden">
        {SHOWCASE.map((slug) => {
          const project = PROJECTS.find((p) => p.slug === slug);
          if (!project) return null;
          return (
            <Link
              key={slug}
              to={projectListPath(slug, defaultChannel(slug))}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
            >
              <ProjectLogo
                logoFile={project.logoFile}
                label={project.label}
                size="sm"
                className="size-8 shrink-0"
              />
              <span className="min-w-0 flex-1 font-medium">{project.label}</span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
