import { Router } from "express";
import os from "node:os";
import {
  appendAgentJobLog,
  claimNextAgentJob,
  completeAgentJob,
  getAgentJob,
  getAgentPresence,
  touchAgent,
  verifyAgentToken,
  agentTokenConfigured,
} from "../agent-jobs.js";

export const agentRouter = Router();

function requireAgentAuth(
  req: { headers: { authorization?: string } },
  res: { status: (c: number) => { json: (b: unknown) => void } },
  next: () => void,
) {
  if (!agentTokenConfigured()) {
    res.status(503).json({
      error:
        "Agente não configurado no servidor. Defina QA_AGENT_TOKEN no .env da API.",
    });
    return;
  }
  if (!verifyAgentToken(req.headers.authorization)) {
    res.status(401).json({ error: "Token do agente inválido" });
    return;
  }
  next();
}

agentRouter.use(requireAgentAuth);

agentRouter.post("/heartbeat", (req, res) => {
  const body = (req.body ?? {}) as {
    hostname?: string;
    version?: string;
    device?: {
      ready?: boolean;
      booting?: boolean;
      message?: string;
      primarySerial?: string;
      avdName?: string;
      devices?: Array<{ serial: string; state: string; kind: "emulator" | "physical" }>;
    };
  };
  const device =
    body.device && typeof body.device.message === "string"
      ? {
          ready: Boolean(body.device.ready),
          booting: Boolean(body.device.booting),
          message: body.device.message,
          primarySerial: body.device.primarySerial,
          avdName: body.device.avdName,
          devices: Array.isArray(body.device.devices) ? body.device.devices : [],
        }
      : undefined;
  touchAgent({
    hostname: body.hostname?.trim() || os.hostname(),
    version: body.version?.trim(),
    device,
  });
  res.json({
    ok: true,
    presence: getAgentPresence(),
  });
});

agentRouter.get("/jobs/next", (_req, res) => {
  const job = claimNextAgentJob();
  if (!job) {
    res.status(204).end();
    return;
  }
  res.json({
    id: job.id,
    payload: job.payload,
    createdAt: job.createdAt,
  });
});

agentRouter.get("/jobs/:id", (req, res) => {
  const job = getAgentJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: "Job não encontrado" });
    return;
  }
  res.json({
    id: job.id,
    status: job.status,
    cancelled: job.status === "cancelled",
  });
});

agentRouter.post("/jobs/:id/log", (req, res) => {
  const body = (req.body ?? {}) as { chunk?: string };
  const chunk = typeof body.chunk === "string" ? body.chunk : "";
  if (!chunk) {
    res.status(400).json({ error: "chunk obrigatório" });
    return;
  }
  const result = appendAgentJobLog(req.params.id, chunk);
  if (!result.ok) {
    res.status(404).json({ error: "Job não encontrado ou já finalizado" });
    return;
  }
  res.json({ ok: true, cancelled: result.cancelled });
});

agentRouter.post("/jobs/:id/complete", (req, res) => {
  const body = (req.body ?? {}) as {
    exitCode?: number | null;
    output?: string;
    error?: string;
    appVersion?: string;
    cancelled?: boolean;
  };
  const job = completeAgentJob(req.params.id, {
    exitCode: body.exitCode ?? 1,
    output: body.output,
    error: body.error,
    appVersion: body.appVersion,
    cancelled: Boolean(body.cancelled),
  });
  if (!job) {
    res.status(404).json({ error: "Job não encontrado" });
    return;
  }
  res.json({
    ok: true,
    id: job.id,
    status: job.status,
    exitCode: job.exitCode,
  });
});
