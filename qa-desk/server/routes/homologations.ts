import { Router } from "express";
import {
  appendHomologationHistory,
  computeHomologationProgress,
  createHomologation,
  findHomologationBySlug,
  linkTestsToHomologation,
  readHomologationCatalog,
  syncMuralHomologation,
  writeHomologationCatalog,
} from "../homologations.js";
import { MURAL_HOMOLOGATION_SLUG } from "../homologation-config.js";
import { assertProject, readCatalog, writeCatalog } from "../storage.js";
import { actorOf, attachUser, requireAdmin } from "../middleware/auth.js";
import type { HomologationCycleStatus, HomologationChangeScope, ProductChannel } from "../types.js";

function param(req: { params: Record<string, string | string[] | undefined> }, key: string) {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : (v ?? "");
}

export const homologationsRouter = Router({ mergeParams: true });

homologationsRouter.use(attachUser);

homologationsRouter.get("/", async (req, res) => {
  const project = assertProject(param(req, "slug"));
  const homCatalog = await readHomologationCatalog(project);
  const testCatalog = await readCatalog(project);

  const list = homCatalog.homologations.map((h) => ({
    ...h,
    progress: computeHomologationProgress(h, testCatalog),
  }));

  res.json({ meta: homCatalog.meta, homologations: list });
});

homologationsRouter.post("/", requireAdmin, async (req, res) => {
  const project = assertProject(param(req, "slug"));
  const body = req.body as {
    title?: string;
    description?: string;
    channel?: ProductChannel;
    changeScope?: HomologationChangeScope;
    testKeys?: string[];
    build?: string;
  };

  if (!body.title?.trim()) {
    return res.status(400).json({ error: "Título é obrigatório" });
  }

  const homCatalog = await readHomologationCatalog(project);
  const homologation = createHomologation(homCatalog, {
    project,
    title: body.title,
    description: body.description,
    channel: body.channel,
    changeScope: body.changeScope,
    testKeys: body.testKeys,
    build: body.build,
  });

  const testCatalog = await readCatalog(project);
  const linked = linkTestsToHomologation(testCatalog, homologation);

  await writeHomologationCatalog(project, homCatalog);
  if (linked > 0) await writeCatalog(project, testCatalog);

  res.status(201).json({
    homologation,
    linked,
    progress: computeHomologationProgress(homologation, testCatalog),
  });
});

homologationsRouter.get("/:homSlug", async (req, res) => {
  const project = assertProject(param(req, "slug"));
  const homSlug = param(req, "homSlug");
  const homCatalog = await readHomologationCatalog(project);
  const homologation = findHomologationBySlug(homCatalog, homSlug);

  if (!homologation) {
    return res.status(404).json({ error: "Homologação não encontrada" });
  }

  const testCatalog = await readCatalog(project);
  res.json({
    homologation,
    progress: computeHomologationProgress(homologation, testCatalog),
  });
});

homologationsRouter.put("/:homSlug", requireAdmin, async (req, res) => {
  const project = assertProject(param(req, "slug"));
  const homSlug = param(req, "homSlug");
  const homCatalog = await readHomologationCatalog(project);
  const idx = homCatalog.homologations.findIndex(
    (h) => h.slug === homSlug || h.id === homSlug,
  );
  if (idx < 0) return res.status(404).json({ error: "Homologação não encontrada" });

  const prev = homCatalog.homologations[idx];
  const body = req.body as {
    title?: string;
    description?: string;
    build?: string;
    status?: HomologationCycleStatus;
    changeScope?: HomologationChangeScope;
    testKeys?: string[];
  };

  const updated = {
    ...prev,
    ...body,
    testKeys: body.testKeys ? [...new Set(body.testKeys)] : prev.testKeys,
    finishedAt:
      body.status === "concluida" && prev.status !== "concluida"
        ? new Date().toISOString()
        : body.status && body.status !== "concluida"
          ? undefined
          : prev.finishedAt,
  };

  if (body.status && body.status !== prev.status) {
    appendHomologationHistory(updated, {
      actor: actorOf(req),
      action: "homologation_status_changed",
      detail: `${prev.status} → ${body.status}`,
    });
  }

  if (body.testKeys) {
    appendHomologationHistory(updated, {
      actor: actorOf(req),
      action: "homologation_scope_updated",
      detail: `Escopo atualizado: ${updated.testKeys.length} teste(s)`,
    });
  }

  homCatalog.homologations[idx] = updated;
  await writeHomologationCatalog(project, homCatalog);

  const testCatalog = await readCatalog(project);
  if (body.testKeys) linkTestsToHomologation(testCatalog, updated);
  if (body.testKeys) await writeCatalog(project, testCatalog);

  res.json({
    homologation: updated,
    progress: computeHomologationProgress(updated, testCatalog),
  });
});

/** Sincroniza escopo + vínculos dos testes (checklist Mural) */
homologationsRouter.post("/:homSlug/sync", requireAdmin, async (req, res) => {
  const project = assertProject(param(req, "slug"));
  const homSlug = param(req, "homSlug");

  if (homSlug !== MURAL_HOMOLOGATION_SLUG && homSlug !== "HOM-2026-001") {
    return res.status(400).json({ error: "Sync automático só para homologação Mural por enquanto" });
  }

  const { homCatalog, testCatalog, mural, linked } = await syncMuralHomologation(project);
  await writeHomologationCatalog(project, homCatalog);
  await writeCatalog(project, testCatalog);

  res.json({
    homologation: mural,
    linked,
    progress: computeHomologationProgress(mural, testCatalog),
    message: `Escopo: ${mural.testKeys.length} teste(s) · ${linked} vínculo(s)`,
  });
});

homologationsRouter.post("/:homSlug/link-tests", requireAdmin, async (req, res) => {
  const project = assertProject(param(req, "slug"));
  const homSlug = param(req, "homSlug");
  const homCatalog = await readHomologationCatalog(project);
  const homologation = findHomologationBySlug(homCatalog, homSlug);
  if (!homologation) return res.status(404).json({ error: "Homologação não encontrada" });

  const testCatalog = await readCatalog(project);
  const linked = linkTestsToHomologation(testCatalog, homologation);
  await writeCatalog(project, testCatalog);

  res.json({
    linked,
    progress: computeHomologationProgress(homologation, testCatalog),
  });
});
