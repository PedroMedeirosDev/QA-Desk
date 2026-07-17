import type { Prisma } from "@prisma/client";
import { PROJECTS, type Homologation, type HomologationCatalog, type ProjectSlug } from "../types.js";
import { getPrisma } from "./prisma.js";

async function ensureProject(project: ProjectSlug) {
  const prisma = getPrisma();
  const label = PROJECTS.find((p) => p.slug === project)?.label ?? project;
  await prisma.project.upsert({
    where: { slug: project },
    create: { slug: project, label, metaVersion: "1.0.0" },
    update: { label },
  });
}

function rowToHomologation(payload: unknown): Homologation {
  return payload as Homologation;
}

function homologationToRow(h: Homologation, project: ProjectSlug) {
  return {
    id: h.id,
    projectSlug: project,
    slug: h.slug,
    title: h.title,
    status: h.status,
    payload: h as unknown as Prisma.InputJsonValue,
  };
}

export async function readHomologationCatalogFromDb(
  project: ProjectSlug,
): Promise<HomologationCatalog> {
  const prisma = getPrisma();
  await ensureProject(project);

  const [proj, rows] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { slug: project } }),
    prisma.homologation.findMany({ where: { projectSlug: project } }),
  ]);

  const homologations = rows
    .map((r) => rowToHomologation(r.payload))
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));

  return {
    meta: {
      version: proj.metaVersion,
      updatedAt: proj.updatedAt.toISOString().slice(0, 10),
      project,
    },
    homologations,
  };
}

export async function writeHomologationCatalogToDb(
  project: ProjectSlug,
  catalog: HomologationCatalog,
): Promise<void> {
  const prisma = getPrisma();
  await ensureProject(project);

  const ids = catalog.homologations.map((h) => h.id);

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { slug: project },
      data: {
        metaVersion: catalog.meta.version || "1.0.0",
        updatedAt: new Date(),
      },
    });

    if (ids.length === 0) {
      await tx.homologation.deleteMany({ where: { projectSlug: project } });
      return;
    }

    await tx.homologation.deleteMany({
      where: { projectSlug: project, id: { notIn: ids } },
    });

    for (const h of catalog.homologations) {
      const data = homologationToRow(h, project);
      await tx.homologation.upsert({
        where: { id: h.id },
        create: data,
        update: data,
      });
    }
  });
}
