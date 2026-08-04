/**
 * Hub SSE da Curadoria KB — push quando o catálogo é gravado
 * (webhook GitHub, sync manual, edição de parecer).
 */
import type { Response } from "express";
import type { ProjectSlug } from "./types.js";

export type KbCurationSseReason =
  | "catalog-write"
  | "webhook"
  | "sync"
  | "review"
  | "hello";

export type KbCurationSsePayload = {
  project: ProjectSlug;
  at: string;
  reason: KbCurationSseReason;
};

type Client = {
  id: number;
  project: ProjectSlug;
  res: Response;
};

let nextId = 1;
const clients = new Set<Client>();
const debounceTimers = new Map<ProjectSlug, NodeJS.Timeout>();
const HEARTBEAT_MS = 25_000;
const BROADCAST_DEBOUNCE_MS = 200;

function writeEvent(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function kbCurationSseClientCount(project?: ProjectSlug): number {
  if (!project) return clients.size;
  let n = 0;
  for (const c of clients) if (c.project === project) n += 1;
  return n;
}

export function subscribeKbCurationSse(project: ProjectSlug, res: Response): () => void {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof (res as Response & { flushHeaders?: () => void }).flushHeaders === "function") {
    (res as Response & { flushHeaders: () => void }).flushHeaders();
  }

  const client: Client = { id: nextId++, project, res };
  clients.add(client);

  writeEvent(res, "hello", {
    project,
    at: new Date().toISOString(),
    reason: "hello",
  } satisfies KbCurationSsePayload);

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

  reqOnClose(res, cleanup);
  return cleanup;
}

function reqOnClose(res: Response, cleanup: () => void) {
  const req = res.req;
  req.on("close", cleanup);
  req.on("error", cleanup);
  res.on("error", cleanup);
}

function emitNow(project: ProjectSlug, reason: KbCurationSseReason) {
  const payload: KbCurationSsePayload = {
    project,
    at: new Date().toISOString(),
    reason,
  };
  for (const client of [...clients]) {
    if (client.project !== project) continue;
    try {
      writeEvent(client.res, "catalog-updated", payload);
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

/** Notifica listeners do projeto (debounce curto p/ evitar rajada). */
export function broadcastKbCurationUpdated(
  project: ProjectSlug,
  reason: KbCurationSseReason = "catalog-write",
) {
  const previous = debounceTimers.get(project);
  if (previous) clearTimeout(previous);
  debounceTimers.set(
    project,
    setTimeout(() => {
      debounceTimers.delete(project);
      emitNow(project, reason);
    }, BROADCAST_DEBOUNCE_MS),
  );
}
