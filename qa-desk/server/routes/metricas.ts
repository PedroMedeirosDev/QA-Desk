import { Router, type Request } from "express";
import { listarDemandas } from "../demandas.js";
import { calcularMetricas, calcularTrabalho, lerIntencoesDoPeriodo, lerRunsDoPeriodo } from "../metricas.js";
import { attachUser, forbidBot } from "../middleware/auth.js";
import { assertProject, readCatalog } from "../storage.js";

function param(req: Request, key: string) {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : (v ?? "");
}

/** Métricas agregadas: admin e visitante (portfólio). Nenhum título ou dado da empresa. */
export const metricasRouter = Router({ mergeParams: true });
metricasRouter.use(attachUser);
metricasRouter.use(forbidBot);

metricasRouter.get("/", async (req, res) => {
  const project = assertProject(param(req, "slug"));
  const dias = Math.min(Math.max(Number(req.query.dias) || 30, 1), 365);
  const [catalogo, runs, demandas, intencoes] = await Promise.all([
    readCatalog(project),
    lerRunsDoPeriodo(project, dias),
    listarDemandas(project),
    lerIntencoesDoPeriodo(project, dias),
  ]);
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  res.json(calcularMetricas(catalogo.reports, runs, dias, calcularTrabalho(demandas, intencoes, desde)));
});
