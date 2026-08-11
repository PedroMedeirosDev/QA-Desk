import { Router } from "express";
import { attachUser, rejectVisitorMutations, requireAdmin } from "../middleware/auth.js";
import {
  getSuiteStatus,
  readManifest,
  runSuite,
  suitesForProject,
} from "../api-suite.js";
import { assertProject } from "../storage.js";

export const apiSuiteRouter = Router({ mergeParams: true });

apiSuiteRouter.use(attachUser);
apiSuiteRouter.use(rejectVisitorMutations);
apiSuiteRouter.use(requireAdmin);

function projectSlugFrom(req: { params: Record<string, string | string[] | undefined> }) {
  const raw = req.params.slug;
  return assertProject(String(Array.isArray(raw) ? raw[0] : (raw ?? "")));
}

/** Suites disponíveis só para o projeto da rota. */
apiSuiteRouter.get("/", (req, res) => {
  try {
    const slug = projectSlugFrom(req);
    const suites = suitesForProject(slug).map((m) => getSuiteStatus(m.id));
    res.json({ suites });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Erro" });
  }
});

apiSuiteRouter.get("/:suiteId", (req, res) => {
  try {
    const slug = projectSlugFrom(req);
    const suiteId = String(req.params.suiteId);
    const allowed = suitesForProject(slug).some((s) => s.id === suiteId);
    if (!allowed) {
      res.status(404).json({ error: "Suite não disponível neste projeto" });
      return;
    }
    res.json(getSuiteStatus(suiteId));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Erro" });
  }
});

apiSuiteRouter.post("/:suiteId/run", async (req, res) => {
  try {
    const slug = projectSlugFrom(req);
    const suiteId = String(req.params.suiteId);
    const allowed = suitesForProject(slug).some((s) => s.id === suiteId);
    if (!allowed) {
      res.status(404).json({ error: "Suite não disponível neste projeto" });
      return;
    }
    const manifest = readManifest(suiteId);
    if (!manifest.ready) {
      res.status(409).json({
        error: manifest.reason || "Suite ainda não está pronta",
        suite: getSuiteStatus(suiteId),
      });
      return;
    }
    if (suiteId === "polygonus") {
      const senha =
        process.env.POLY_API_SENHA?.trim() || process.env.PLAYWRIGHT_SENHA?.trim();
      if (!senha) {
        res.status(400).json({
          error:
            "Defina POLY_API_SENHA (ou PLAYWRIGHT_SENHA) no .env do qa-desk para rodar a suite Polygonus.",
        });
        return;
      }
    }
    const result = await runSuite(suiteId);
    res.status(result.ok ? 200 : 422).json(result);
  } catch (e) {
    console.error("[api-suite]", e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Falha ao rodar suite" });
  }
});
