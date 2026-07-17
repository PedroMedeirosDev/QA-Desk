import type { Prisma } from "@prisma/client";
import { PROJECTS, type ProjectSlug, type TestCatalog, type TestRecord } from "../types.js";
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

function rowToRecord(payload: unknown): TestRecord {
  return payload as TestRecord;
}

function recordToRow(report: TestRecord, project: ProjectSlug) {
  return {
    id: report.id,
    projectSlug: project,
    testKey: report.testKey ?? null,
    recordType: report.recordType ?? "teste",
    title: report.title,
    status: report.status,
    homologationStatus: report.homologationStatus ?? null,
    homologationId: report.homologationId ?? null,
    campaign: report.campaign ?? null,
    payload: report as unknown as Prisma.InputJsonValue,
  };
}

export async function readCatalogFromDb(project: ProjectSlug): Promise<TestCatalog> {
  const prisma = getPrisma();
  await ensureProject(project);

  const [proj, rows] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { slug: project } }),
    prisma.test.findMany({
      where: { projectSlug: project },
      orderBy: { id: "asc" },
    }),
  ]);

  return {
    meta: {
      version: proj.metaVersion,
      updatedAt: proj.updatedAt.toISOString().slice(0, 10),
      project,
    },
    reports: rows.map((r) => rowToRecord(r.payload)),
  };
}

export async function writeCatalogToDb(project: ProjectSlug, catalog: TestCatalog): Promise<void> {
  const prisma = getPrisma();
  await ensureProject(project);

  const ids = catalog.reports.map((r) => r.id);

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { slug: project },
      data: {
        metaVersion: catalog.meta.version || "1.0.0",
        updatedAt: new Date(),
      },
    });

    if (ids.length === 0) {
      await tx.test.deleteMany({ where: { projectSlug: project } });
      return;
    }

    await tx.test.deleteMany({
      where: { projectSlug: project, id: { notIn: ids } },
    });

    for (const report of catalog.reports) {
      const data = recordToRow(report, project);
      await tx.test.upsert({
        where: { id: report.id },
        create: data,
        update: data,
      });
    }
  });
}
