/**
 * Hub SSE — push quando o gestor comenta numa issue vinculada a bug.
 * Uma conexão por admin; o payload traz o projeto.
 */
import type { Response } from "express";
import type { TestRecord, ProjectSlug, ProductChannel } from "./types.js";

export type GestorReplyVia = "webhook" | "catchup";

export type GestorReplySsePayload = {
  project: ProjectSlug;
  bugId: string;
  bugCode: string;
  title: string;
  issueNumber: number;
  author: string;
  snippet: string;
  commentUrl?: string;
  at: string;
  via: GestorReplyVia;
  channel?: ProductChannel;
};

type Client = {
  id: number;
  res: Response;
};

let nextId = 1;
const clients = new Set<Client>();
const HEARTBEAT_MS = 25_000;

function writeEvent(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function gestorRepliesSseClientCount(): number {
  return clients.size;
}

export function subscribeGestorRepliesSse(res: Response): () => void {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof (res as Response & { flushHeaders?: () => void }).flushHeaders === "function") {
    (res as Response & { flushHeaders: () => void }).flushHeaders();
  }

  const client: Client = { id: nextId++, res };
  clients.add(client);

  writeEvent(res, "hello", {
    at: new Date().toISOString(),
    clients: clients.size,
  });

  const heartbeat = setInterval(() => {
    try {
      res.write(`: ping ${Date.now()}\n\n`);
    } catch {
      cleanup();
    }
  }, HEARTBEAT_MS);

  function cleanup() {
    clearInterval(heartbeat);
    clients.delete(client);
    try {
      res.end();
    } catch {
      /* already closed */
    }
  }

  const req = res.req;
  req.on("close", cleanup);
  req.on("error", cleanup);
  res.on("error", cleanup);
  return cleanup;
}

/** Dispara na hora — sem debounce (cada resposta do gestor conta). */
export function broadcastGestorReply(payload: GestorReplySsePayload) {
  for (const client of [...clients]) {
    try {
      writeEvent(client.res, "gestor-reply", payload);
    } catch {
      clients.delete(client);
      try {
        client.res.end();
      } catch {
        /* ignore */
      }
    }
  }
}

export function emitGestorReplyFromReport(
  project: ProjectSlug,
  report: TestRecord,
  via: GestorReplyVia,
) {
  if (!report.githubIssueLastCommentAt) return;
  broadcastGestorReply({
    project,
    bugId: report.id,
    bugCode: (report.bugCode ?? "").trim() || report.id,
    title: report.title ?? "Bug",
    issueNumber: report.githubIssueNumber ?? 0,
    author: report.githubIssueLastCommentBy ?? "gestor",
    snippet: report.githubIssueLastCommentBody ?? "",
    commentUrl: report.githubIssueLastCommentUrl,
    at: report.githubIssueLastCommentAt,
    via,
    channel: report.channel,
  });
}
