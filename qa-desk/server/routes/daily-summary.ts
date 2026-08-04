import { Router } from "express";
import {
  computeDailySummary,
  isValidDateYmd,
  listPortfolioDailyCards,
  parseIntentsBody,
  publishDailySummary,
  todaySaoPaulo,
} from "../daily-summary.js";
import { attachUser, isVisitor, rejectVisitorMutations, requireAdmin } from "../middleware/auth.js";
import { sanitizeVisitorData } from "../privacy/sanitize-visitor.js";
import { assertProject } from "../storage.js";

function param(req: { params: Record<string, string | string[] | undefined> }, key: string) {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : (v ?? "");
}

export const dailySummaryRouter = Router({ mergeParams: true });

dailySummaryRouter.use(attachUser);
dailySummaryRouter.use(rejectVisitorMutations);

/** Lista dias liberados no portfolio (visitante e admin). */
dailySummaryRouter.get("/portfolio", async (req, res) => {
  const project = assertProject(param(req, "slug"));
  const cards = await listPortfolioDailyCards(project);
  const payload = { project, cards };
  if (isVisitor(req)) {
    return res.json(sanitizeVisitorData(payload));
  }
  res.json(payload);
});

/** Resumo de um dia. Visitante só vê dias com showInPortfolio (hardcoded no backend). */
dailySummaryRouter.get("/", async (req, res) => {
  const project = assertProject(param(req, "slug"));
  const dateRaw = typeof req.query.date === "string" ? req.query.date : todaySaoPaulo();
  if (!isValidDateYmd(dateRaw)) {
    return res.status(400).json({ error: "date deve ser YYYY-MM-DD" });
  }

  const visitor = isVisitor(req);
  const summary = await computeDailySummary(project, dateRaw, {
    preferSnapshotForVisitor: visitor,
  });

  if (visitor && !summary.showInPortfolio) {
    return res.status(404).json({ error: "Resumo não disponível no portfolio" });
  }

  if (visitor) {
    return res.json(sanitizeVisitorData({ ...summary, showInPortfolio: true }));
  }

  res.json(summary);
});

/** Publica / atualiza meta do dia (snapshot + showInPortfolio + intents). */
dailySummaryRouter.put("/", requireAdmin, async (req, res) => {
  const project = assertProject(param(req, "slug"));
  const body = req.body as {
    date?: string;
    showInPortfolio?: boolean;
    intents?: unknown;
    note?: string | null;
  };

  const date = body.date ?? todaySaoPaulo();
  if (!isValidDateYmd(date)) {
    return res.status(400).json({ error: "date deve ser YYYY-MM-DD" });
  }
  if (typeof body.showInPortfolio !== "boolean") {
    return res.status(400).json({ error: "showInPortfolio (boolean) é obrigatório" });
  }

  const intents = parseIntentsBody(body.intents);
  const summary = await publishDailySummary(project, date, {
    showInPortfolio: body.showInPortfolio,
    intents,
    note: body.note,
  });
  res.json(summary);
});
