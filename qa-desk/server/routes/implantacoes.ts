import { Router } from "express";
import {
  addRequisito,
  createImplantacaoTipo,
  findImplantacaoBySlug,
  readImplantacaoCatalog,
  writeImplantacaoCatalog,
  type ImplantacaoExecutor,
  type ImplantacaoRequisitoTipo,
  type ImplantacaoStatus,
} from "../implantacoes.js";
import { assertProject } from "../storage.js";
import {
  attachUser,
  forbidBot,
  forbidVisitor,
  rejectVisitorMutations,
  requireAdmin,
} from "../middleware/auth.js";

function param(
  req: { params: Record<string, string | string[] | undefined> },
  key: string,
) {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : (v ?? "");
}

export const implantacoesRouter = Router({ mergeParams: true });

implantacoesRouter.use(attachUser);
implantacoesRouter.use(rejectVisitorMutations);
implantacoesRouter.use(forbidVisitor);
implantacoesRouter.use(forbidBot);

implantacoesRouter.get("/", (req, res) => {
  const project = assertProject(param(req, "slug"));
  const catalog = readImplantacaoCatalog(project);
  res.json(catalog);
});

implantacoesRouter.post("/", requireAdmin, (req, res) => {
  const project = assertProject(param(req, "slug"));
  const body = req.body as { title?: string; description?: string; slug?: string };
  if (!body.title?.trim()) {
    return res.status(400).json({ error: "Título é obrigatório" });
  }
  const catalog = readImplantacaoCatalog(project);
  const tipo = createImplantacaoTipo(catalog, {
    title: body.title,
    description: body.description,
    slug: body.slug,
  });
  writeImplantacaoCatalog(project, catalog);
  res.status(201).json({ tipo });
});

implantacoesRouter.get("/:impSlug", (req, res) => {
  const project = assertProject(param(req, "slug"));
  const impSlug = param(req, "impSlug");
  const catalog = readImplantacaoCatalog(project);
  const tipo = findImplantacaoBySlug(catalog, impSlug);
  if (!tipo) return res.status(404).json({ error: "Implantação não encontrada" });
  res.json({ tipo });
});

implantacoesRouter.put("/:impSlug", requireAdmin, (req, res) => {
  const project = assertProject(param(req, "slug"));
  const impSlug = param(req, "impSlug");
  const catalog = readImplantacaoCatalog(project);
  const tipo = findImplantacaoBySlug(catalog, impSlug);
  if (!tipo) return res.status(404).json({ error: "Implantação não encontrada" });

  const body = req.body as {
    title?: string;
    description?: string;
    status?: ImplantacaoStatus;
  };
  if (body.title?.trim()) tipo.title = body.title.trim();
  if (typeof body.description === "string") tipo.description = body.description.trim();
  if (body.status === "ativo" || body.status === "arquivado") tipo.status = body.status;
  tipo.updatedAt = new Date().toISOString();
  writeImplantacaoCatalog(project, catalog);
  res.json({ tipo });
});

implantacoesRouter.post("/:impSlug/requisitos", requireAdmin, (req, res) => {
  const project = assertProject(param(req, "slug"));
  const impSlug = param(req, "impSlug");
  const catalog = readImplantacaoCatalog(project);
  const tipo = findImplantacaoBySlug(catalog, impSlug);
  if (!tipo) return res.status(404).json({ error: "Implantação não encontrada" });

  const body = req.body as {
    titulo?: string;
    detalhe?: string;
    tipo?: ImplantacaoRequisitoTipo;
    executor?: ImplantacaoExecutor;
    obrigatorio?: boolean;
    fonte?: string;
    fonteEm?: string;
    notas?: string;
    ordem?: number;
  };

  if (!body.titulo?.trim() || !body.detalhe?.trim()) {
    return res.status(400).json({ error: "Título e detalhe são obrigatórios" });
  }

  const reqItem = addRequisito(tipo, {
    titulo: body.titulo,
    detalhe: body.detalhe,
    tipo: body.tipo ?? "manual",
    executor: body.executor ?? "outro",
    obrigatorio: body.obrigatorio !== false,
    fonte: body.fonte,
    fonteEm: body.fonteEm,
    notas: body.notas,
    ordem: body.ordem,
  });
  writeImplantacaoCatalog(project, catalog);
  res.status(201).json({ tipo, requisito: reqItem });
});
