import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import helmet from "helmet";
import { loadEnv } from "./load-env.js";
import { storageMode } from "./db/config.js";
import { isServerAuthConfigured } from "./middleware/auth.js";
import {
  apiRateLimiter,
  buildCorsOptions,
  webhookRateLimiter,
} from "./middleware/security.js";
import { testsRouter } from "./routes/tests.js";
import { homologationsRouter } from "./routes/homologations.js";
import { automationRouter } from "./routes/automation.js";
import { agentRouter } from "./routes/agent.js";
import { kbCurationRouter } from "./routes/kb-curation.js";
import { implantacoesRouter } from "./routes/implantacoes.js";
import { dailySummaryRouter } from "./routes/daily-summary.js";
import { apiSuiteRouter } from "./routes/api-suite.js";
import { evidenceRouter } from "./routes/evidence.js";
import {
  githubWebhooksRouter,
  isKbGithubWebhookConfigured,
} from "./routes/github-webhooks.js";
import {
  agentTokenConfigured,
  getAgentPresence,
} from "./agent-jobs.js";
import { PROJECTS } from "./types.js";

loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.QA_APP_PORT ?? 3001);
const IS_PROD = process.env.NODE_ENV === "production";
/** Em produção (atrás do Caddy) o default é localhost — não expor 3001 na internet. */
const HOST = process.env.QA_APP_HOST ?? (IS_PROD ? "127.0.0.1" : "0.0.0.0");
const DIST = path.join(__dirname, "../dist");

const supabaseOrigin = (() => {
  const url = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
})();

const app = express();

if (IS_PROD) {
  // Caddy → Node: X-Forwarded-For para rate limit por IP real
  app.set("trust proxy", 1);
}

app.use(
  helmet({
    // SPA + assets locais; connect no Supabase Auth
    contentSecurityPolicy: IS_PROD
      ? {
          useDefaults: true,
          directives: {
            "default-src": ["'self'"],
            "script-src": ["'self'"],
            "style-src": ["'self'", "'unsafe-inline'"],
            "img-src": ["'self'", "data:", "blob:"],
            "font-src": ["'self'", "data:"],
            "connect-src": ["'self'", ...(supabaseOrigin ? [supabaseOrigin] : [])],
            "object-src": ["'none'"],
            "base-uri": ["'self'"],
            "frame-ancestors": ["'none'"],
            "form-action": ["'self'"],
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(cors(buildCorsOptions()));

// Webhooks GitHub precisam do body raw para X-Hub-Signature-256 (antes do json parser).
app.use(
  "/api/webhooks/github",
  webhookRateLimiter,
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
app.use("/api", apiRateLimiter);

app.get("/api/health", (_req, res) => {
  const agent = getAgentPresence();
  if (IS_PROD) {
    res.json({
      ok: true,
      automationRun: process.env.QA_AUTOMATION_RUN === "1",
      agentConfigured: agentTokenConfigured(),
      agentOnline: agent.online,
      agentHostname: agent.hostname,
    });
    return;
  }
  res.json({
    ok: true,
    mode: "development",
    storage: storageMode(),
    automationRun: process.env.QA_AUTOMATION_RUN === "1",
    auth: isServerAuthConfigured() ? "supabase" : "mock",
    kbGithubWebhook: isKbGithubWebhookConfigured(),
    agentConfigured: agentTokenConfigured(),
    agentOnline: agent.online,
    agentHostname: agent.hostname,
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
app.use("/api/projects/:slug/implantacoes", implantacoesRouter);
app.use("/api/projects/:slug/daily-summary", dailySummaryRouter);

app.use("/api/projects/:slug/automation", automationRouter);
app.use("/api/projects/:slug/api-suite", apiSuiteRouter);
app.use("/api/agent", agentRouter);

app.use("/api/evidence", evidenceRouter);

if (IS_PROD && fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(DIST, "index.html"));
  });
}

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const isCors = err.message.startsWith("CORS:");
  if (isCors) {
    res.status(403).json({ error: "Origem não permitida" });
    return;
  }
  res.status(500).json({
    error: IS_PROD ? "Erro interno" : err.message,
  });
});

app.listen(PORT, HOST, () => {
  const automationRun = process.env.QA_AUTOMATION_RUN === "1";
  console.log(
    `QA App ${IS_PROD ? "PRODUCTION" : "API"} http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`,
  );
  console.log(`Storage: ${storageMode()}${storageMode() === "json" ? " (defina DATABASE_URL para Postgres)" : ""}`);
  console.log(`Auth: ${isServerAuthConfigured() ? "Supabase JWT" : "mock admin (sem SUPABASE_URL)"}`);
  console.log(
    isKbGithubWebhookConfigured()
      ? "KB Curadoria: webhook GitHub ativo (/api/webhooks/github/kb-curation)"
      : "KB Curadoria: webhook GitHub inativo (defina GITHUB_WEBHOOK_SECRET — ver server/github/README.md)",
  );
  console.log(
    automationRun
      ? "Maestro: execução local habilitada (QA_AUTOMATION_RUN=1)"
      : agentTokenConfigured()
        ? "Maestro: remoto via agente (QA_AUTOMATION_RUN=0 + QA_AGENT_TOKEN)"
        : "Maestro: desabilitado — QA_AUTOMATION_RUN=1 (local) ou QA_AGENT_TOKEN (remoto)",
  );
  if (HOST === "0.0.0.0") {
    console.log("Acessível na rede local (mesmo Wi‑Fi) pelo IP desta máquina");
  } else if (IS_PROD && HOST === "127.0.0.1") {
    console.log("Bind localhost — acesso público só via Caddy (80/443)");
  }
});
