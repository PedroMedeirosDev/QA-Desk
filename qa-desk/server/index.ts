import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./load-env.js";
import { storageMode } from "./db/config.js";
import { isServerAuthConfigured } from "./middleware/auth.js";
import { testsRouter } from "./routes/tests.js";
import { homologationsRouter } from "./routes/homologations.js";
import { automationRouter } from "./routes/automation.js";
import { kbCurationRouter } from "./routes/kb-curation.js";
import { dailySummaryRouter } from "./routes/daily-summary.js";
import {
  githubWebhooksRouter,
  isKbGithubWebhookConfigured,
} from "./routes/github-webhooks.js";
import { PROJECTS } from "./types.js";

loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.QA_APP_PORT ?? 3001);
const HOST = process.env.QA_APP_HOST ?? "0.0.0.0";
const IS_PROD = process.env.NODE_ENV === "production";
const DIST = path.join(__dirname, "../dist");

const app = express();
app.use(cors({ origin: true, credentials: true }));

// Webhooks GitHub precisam do body raw para X-Hub-Signature-256 (antes do json parser).
app.use(
  "/api/webhooks/github",
  express.raw({ type: "application/json", limit: "2mb" }),
  (req, _res, next) => {
    (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : undefined;
    next();
  },
  githubWebhooksRouter,
);

app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    mode: IS_PROD ? "production" : "development",
    storage: storageMode(),
    automationRun: process.env.QA_AUTOMATION_RUN === "1",
    auth: isServerAuthConfigured() ? "supabase" : "mock",
    kbGithubWebhook: isKbGithubWebhookConfigured(),
  });
});


app.get("/api/projects", (_req, res) => {
  res.json(PROJECTS);
});

app.use("/api/projects/:slug/tests", testsRouter);
/** @deprecated use /tests — mantido temporariamente */
app.use("/api/projects/:slug/bugs", testsRouter);

app.use("/api/projects/:slug/homologations", homologationsRouter);
app.use("/api/projects/:slug/kb-curation", kbCurationRouter);
app.use("/api/projects/:slug/daily-summary", dailySummaryRouter);

app.use("/api/projects/:slug/automation", automationRouter);

app.use(
  "/api/evidence",
  express.static(path.join(__dirname, "../data/uploads"), { fallthrough: true }),
);

if (IS_PROD && fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(DIST, "index.html"));
  });
}

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, HOST, () => {
  const automationRun = process.env.QA_AUTOMATION_RUN === "1";
  console.log(`QA App ${IS_PROD ? "PRODUCTION" : "API"} http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
  console.log(`Storage: ${storageMode()}${storageMode() === "json" ? " (defina DATABASE_URL para Postgres)" : ""}`);
  console.log(`Auth: ${isServerAuthConfigured() ? "Supabase JWT" : "mock admin (sem SUPABASE_URL)"}`);
  console.log(
    isKbGithubWebhookConfigured()
      ? "KB Curadoria: webhook GitHub ativo (/api/webhooks/github/kb-curation)"
      : "KB Curadoria: webhook GitHub inativo (defina GITHUB_WEBHOOK_SECRET — ver server/github/README.md)",
  );
  console.log(
    automationRun
      ? "Maestro: execução habilitada (QA_AUTOMATION_RUN=1)"
      : "Maestro: execução desabilitada — copie .env.example para .env ou defina QA_AUTOMATION_RUN=1",
  );
  if (HOST === "0.0.0.0") {
    console.log("Acessível na rede local (mesmo Wi‑Fi) pelo IP desta máquina");
  }
});
