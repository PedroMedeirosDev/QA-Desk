import { Router, type Request } from "express";
import {
  appendContinuacao,
  composeContinuacaoMessage,
  composeIntroMessage,
  createGestorCase,
  defaultDiscordChannelUrl,
  discordUrlKind,
  findGestorCase,
  listCasesByAuthor,
  markGestorCaseDevolvido,
  readGestorCasesCatalog,
  updateGestorCaseDiscordUrl,
  writeGestorCasesCatalog,
} from "../gestor-cases.js";
import { assertProject } from "../storage.js";
import {
  attachUser,
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

function authorActor(req: Request): string {
  return req.user?.actor ?? req.user?.displayName ?? "anon";
}

export const gestorCasesRouter = Router({ mergeParams: true });

gestorCasesRouter.use(attachUser);
gestorCasesRouter.use(rejectVisitorMutations);
gestorCasesRouter.use(forbidVisitor);

gestorCasesRouter.get("/", requireAdmin, (req, res) => {
  const project = assertProject(param(req, "slug"));
  const author = authorActor(req);
  const catalog = readGestorCasesCatalog(project);
  const cases = listCasesByAuthor(catalog, author).sort((a, b) => b.number - a.number);
  const suggestedNextNumber = (catalog.lastNumberByAuthor[author] ?? 0) + 1;
  res.json({
    cases,
    suggestedNextNumber,
    author,
    discordChannelUrl: catalog.discordChannelUrl ?? defaultDiscordChannelUrl(project),
  });
});

gestorCasesRouter.post("/", requireAdmin, (req, res) => {
  const project = assertProject(param(req, "slug"));
  const author = authorActor(req);
  const body = req.body as {
    title?: string;
    body?: string;
    discordUrl?: string;
    internalRef?: string;
    linkedTestId?: string;
  };

  if (!body.title?.trim()) {
    return res.status(400).json({ error: "Título é obrigatório" });
  }
  if (!body.body?.trim()) {
    return res.status(400).json({ error: "Descrição é obrigatória" });
  }

  const catalog = readGestorCasesCatalog(project);
  const caseItem = createGestorCase(catalog, {
    author,
    title: body.title,
    body: body.body,
    discordUrl: body.discordUrl,
    internalRef: body.internalRef,
    linkedTestId: body.linkedTestId,
  });
  writeGestorCasesCatalog(project, catalog);

  const message = composeIntroMessage(catalog, author, caseItem);
  res.status(201).json({ case: caseItem, message });
});

gestorCasesRouter.get("/:id/compose", requireAdmin, (req, res) => {
  const project = assertProject(param(req, "slug"));
  const id = param(req, "id");
  const author = authorActor(req);
  const kind = String(req.query.kind ?? "intro");
  const catalog = readGestorCasesCatalog(project);
  const caseItem = findGestorCase(catalog, id);
  if (!caseItem || caseItem.author !== author) {
    return res.status(404).json({ error: "Caso não encontrado" });
  }

  if (kind === "continuacao") {
    const body = String(req.query.body ?? "").trim();
    if (!body) {
      return res.status(400).json({ error: "Parâmetro body é obrigatório para continuação" });
    }
    return res.json({ message: composeContinuacaoMessage(caseItem, body) });
  }

  res.json({ message: composeIntroMessage(catalog, author, caseItem) });
});

gestorCasesRouter.post("/:id/continuacao", requireAdmin, (req, res) => {
  const project = assertProject(param(req, "slug"));
  const id = param(req, "id");
  const author = authorActor(req);
  const body = req.body as { body?: string; discordUrl?: string };

  if (!body.body?.trim()) {
    return res.status(400).json({ error: "Texto da continuação é obrigatório" });
  }

  const catalog = readGestorCasesCatalog(project);
  const caseItem = findGestorCase(catalog, id);
  if (!caseItem || caseItem.author !== author) {
    return res.status(404).json({ error: "Caso não encontrado" });
  }
  if (caseItem.status !== "pendente") {
    return res.status(400).json({ error: "Só é possível continuar casos pendentes" });
  }

  appendContinuacao(caseItem, body.body);
  writeGestorCasesCatalog(project, catalog);

  const message = composeContinuacaoMessage(caseItem, body.body);
  res.json({ case: caseItem, message });
});

gestorCasesRouter.patch("/:id/devolvido", requireAdmin, (req, res) => {
  const project = assertProject(param(req, "slug"));
  const id = param(req, "id");
  const author = authorActor(req);

  const catalog = readGestorCasesCatalog(project);
  const caseItem = findGestorCase(catalog, id);
  if (!caseItem || caseItem.author !== author) {
    return res.status(404).json({ error: "Caso não encontrado" });
  }

  markGestorCaseDevolvido(caseItem);
  writeGestorCasesCatalog(project, catalog);
  res.json({ case: caseItem });
});

gestorCasesRouter.patch("/:id/discord-url", requireAdmin, (req, res) => {
  const project = assertProject(param(req, "slug"));
  const id = param(req, "id");
  const author = authorActor(req);
  const body = req.body as { discordUrl?: string };

  if (!body.discordUrl?.trim()) {
    return res.status(400).json({ error: "Link Discord é obrigatório" });
  }
  if (discordUrlKind(body.discordUrl) !== "message") {
    return res.status(400).json({
      error:
        "Cole o link da mensagem (botão direito na mensagem → Copiar link da mensagem). O link do canal não identifica o caso na lista Pendente.",
    });
  }

  const catalog = readGestorCasesCatalog(project);
  const caseItem = findGestorCase(catalog, id);
  if (!caseItem || caseItem.author !== author) {
    return res.status(404).json({ error: "Caso não encontrado" });
  }

  updateGestorCaseDiscordUrl(caseItem, body.discordUrl);
  writeGestorCasesCatalog(project, catalog);
  res.json({ case: caseItem });
});
