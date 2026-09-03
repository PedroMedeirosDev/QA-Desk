import { Router, type Request } from "express";
import {
  appendContinuacao,
  applyBugStatusToGestorCases,
  composeContinuacaoMessage,
  composeGestorBodyFromBug,
  composeIntroMessage,
  composeOwnCaseMessage,
  createGestorCase,
  isBugWithGestor,
  reopenGestorCase,
  defaultDiscordChannelUrl,
  discordUrlKind,
  findGestorCase,
  findGestorCaseByLinkedTest,
  replaceGestorCaseIntro,
  listCasesByAuthor,
  markGestorCaseDevolvido,
  readGestorCasesCatalog,
  updateGestorCaseDiscordUrl,
  writeGestorCasesCatalog,
} from "../gestor-cases.js";
import { appendHistory, assertProject, readCatalog, writeCatalog } from "../storage.js";
import {
  attachUser,
  forbidVisitor,
  isBot,
  rejectVisitorMutations,
  requireAdmin,
  requireRepasseRead,
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

gestorCasesRouter.get("/", requireRepasseRead, async (req, res) => {
  const project = assertProject(param(req, "slug"));
  const author = authorActor(req);
  const bot = isBot(req);
  const catalog = readGestorCasesCatalog(project);
  const tests = await readCatalog(project);
  if (!bot) {
    let synced = false;
    for (const report of tests.reports) {
      if (report.recordType === "bug" && applyBugStatusToGestorCases(catalog, report.id, report.status)) {
        synced = true;
      }
    }
    if (synced) writeGestorCasesCatalog(project, catalog);
  }
  const cases = (bot ? catalog.cases : listCasesByAuthor(catalog, author))
    .sort((a, b) => b.number - a.number)
    .map((c) => {
      const bug = c.linkedTestId
        ? tests.reports.find((r) => r.id === c.linkedTestId)
        : undefined;
      const attachments = (bug?.evidence ?? [])
        .filter((e) => e.type === "screenshot" || e.type === "video")
        .map((e) => ({
          fileId: e.fileId,
          filename: e.filename,
          type: e.type,
          sizeBytes: e.sizeBytes,
          storageKey: e.storageKey,
        }));
      return {
        ...c,
        discordMessage: composeOwnCaseMessage(c),
        ...(attachments.length ? { attachments } : {}),
      };
    });
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

gestorCasesRouter.post("/from-bug", requireAdmin, async (req, res) => {
  const project = assertProject(param(req, "slug"));
  const author = authorActor(req);
  const testId = String((req.body as { testId?: string }).testId ?? "").trim();
  if (!testId) {
    return res.status(400).json({ error: "testId é obrigatório" });
  }

  const tests = await readCatalog(project);
  const bug = tests.reports.find((r) => r.id === testId);
  if (!bug || (bug.recordType ?? (bug.campaign ? "teste" : "bug")) !== "bug") {
    return res.status(404).json({ error: "Bug não encontrado" });
  }

  const catalog = readGestorCasesCatalog(project);
  const existing = findGestorCaseByLinkedTest(catalog, bug.id, author);
  if (existing) {
    replaceGestorCaseIntro(existing, bug.title, composeGestorBodyFromBug(bug));
    if (existing.status === "devolvido") {
      reopenGestorCase(existing);
    }
    writeGestorCasesCatalog(project, catalog);
    if (!isBugWithGestor(bug.status)) {
      const prev = bug.status;
      bug.status = "enviado_gestor";
      appendHistory(bug, {
        actor: author,
        action: "status_changed",
        detail: `${prev} → enviado_gestor`,
        meta: { previousStatus: prev, newStatus: "enviado_gestor", via: "repasse" },
      });
      await writeCatalog(project, tests);
    }
    return res.json({
      case: existing,
      message: composeIntroMessage(catalog, author, existing),
      created: false,
    });
  }

  const caseItem = createGestorCase(catalog, {
    author,
    title: bug.title,
    body: composeGestorBodyFromBug(bug),
    internalRef: bug.bugCode,
    linkedTestId: bug.id,
  });
  writeGestorCasesCatalog(project, catalog);

  if (bug.status === "rascunho" || bug.status === "reportado") {
    const prev = bug.status;
    bug.status = "enviado_gestor";
    appendHistory(bug, {
      actor: author,
      action: "status_changed",
      detail: `${prev} → enviado_gestor`,
      meta: { previousStatus: prev, newStatus: "enviado_gestor", via: "repasse" },
    });
    await writeCatalog(project, tests);
  }

  res.status(201).json({
    case: caseItem,
    message: composeIntroMessage(catalog, author, caseItem),
    created: true,
  });
});

gestorCasesRouter.get("/:id/compose", requireRepasseRead, (req, res) => {
  const project = assertProject(param(req, "slug"));
  const id = param(req, "id");
  const author = authorActor(req);
  const kind = String(req.query.kind ?? "intro");
  const catalog = readGestorCasesCatalog(project);
  const caseItem = findGestorCase(catalog, id);
  if (!caseItem || (!isBot(req) && caseItem.author !== author)) {
    return res.status(404).json({ error: "Caso não encontrado" });
  }
  if (isBot(req)) {
    return res.json({ message: composeOwnCaseMessage(caseItem) });
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
