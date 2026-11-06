import { Router, type Request } from "express";
import { formatarListaPendencias, type DemandaStatus } from "../../src/types/demanda.js";
import {
  DemandaInvalidaError,
  atualizarDemanda,
  criarDemanda,
  listarDemandas,
  listarPendencias,
  pessoasConhecidas,
} from "../demandas.js";
import { attachUser, forbidVisitor, requireAdmin } from "../middleware/auth.js";
import { assertProject } from "../storage.js";

function param(req: Request, key: string) {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : (v ?? "");
}

function actor(req: Request): string {
  return req.user?.actor ?? req.user?.displayName ?? "admin";
}

function erro(res: import("express").Response, e: unknown) {
  if (e instanceof DemandaInvalidaError) return res.status(400).json({ error: e.message });
  throw e;
}

/** Demandas: só admin, inclusive leitura (texto vem do Discord da empresa). */
export const demandasRouter = Router({ mergeParams: true });

demandasRouter.use(attachUser);
demandasRouter.use(forbidVisitor);
demandasRouter.use(requireAdmin);

demandasRouter.get("/", async (req, res) => {
  const project = assertProject(param(req, "slug"));
  const [demandas, pessoas] = await Promise.all([listarDemandas(project), pessoasConhecidas(project)]);
  res.json({ demandas: demandas.sort((a, b) => b.numero - a.numero), pessoas });
});

demandasRouter.get("/pendencias", async (req, res) => {
  const project = assertProject(param(req, "slug"));
  const comQuem = String(req.query.comQuem ?? "").trim();
  if (!comQuem) return res.status(400).json({ error: "informe comQuem" });
  const itens = await listarPendencias(project, comQuem);
  res.json({ comQuem, itens, texto: formatarListaPendencias(itens) });
});

demandasRouter.post("/", async (req, res) => {
  const project = assertProject(param(req, "slug"));
  const body = req.body as { texto?: string; titulo?: string; comQuem?: string; status?: DemandaStatus };
  try {
    const demanda = await criarDemanda(
      project,
      { texto: body.texto ?? "", titulo: body.titulo, comQuem: body.comQuem, status: body.status },
      actor(req),
    );
    res.status(201).json(demanda);
  } catch (e) {
    erro(res, e);
  }
});

demandasRouter.patch("/:id", async (req, res) => {
  const project = assertProject(param(req, "slug"));
  const body = req.body as {
    titulo?: string;
    texto?: string;
    status?: DemandaStatus;
    comQuem?: string;
    bugId?: string;
  };
  try {
    const demanda = await atualizarDemanda(
      project,
      param(req, "id"),
      { titulo: body.titulo, texto: body.texto, status: body.status, comQuem: body.comQuem, bugId: body.bugId },
      actor(req),
    );
    if (!demanda) return res.status(404).json({ error: "Demanda não encontrada" });
    res.json(demanda);
  } catch (e) {
    erro(res, e);
  }
});
