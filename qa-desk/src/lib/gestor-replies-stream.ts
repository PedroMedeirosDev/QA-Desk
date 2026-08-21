import { authHeaders } from "@/lib/auth-token";
import type { ProductChannel, ProjectSlug } from "@/types/test-record";

export const QA_GESTOR_REPLY_EVENT = "qa-gestor-reply";
/** Inbox mudou (novo comentário ou marcado como lido). */
export const QA_GESTOR_INBOX_CHANGED = "qa-gestor-inbox-changed";

export type GestorReplyEvent = {
  project: ProjectSlug;
  bugId: string;
  bugCode: string;
  title: string;
  issueNumber: number;
  author: string;
  snippet: string;
  commentUrl?: string;
  at: string;
  via: "webhook" | "catchup";
  channel?: ProductChannel;
};

export type GestorUnreadItem = {
  project: ProjectSlug;
  bugId: string;
  bugCode: string;
  title: string;
  author: string;
  snippet: string;
  at: string;
  channel?: ProductChannel;
  commentUrl?: string;
};

export function emitGestorInboxChanged() {
  window.dispatchEvent(new CustomEvent(QA_GESTOR_INBOX_CHANGED));
}

/**
 * Mantém a conexão SSE aberta (fetch + ReadableStream — Bearer auth).
 * Resolve quando a stream fecha; o caller reconecta com backoff.
 */
export async function listenGestorRepliesStream(
  onReply: (event: GestorReplyEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch("/api/bugs/gestor-replies/stream", {
    headers: authHeaders({ Accept: "text/event-stream" }),
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? `SSE ${res.status}`);
  }
  if (!res.body) throw new Error("SSE sem body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "message";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) >= 0) {
      const raw = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      if (!raw.trim() || raw.startsWith(":")) continue;

      let dataLine: string | null = null;
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLine = line.slice(5).trim();
        }
      }

      if (eventName === "gestor-reply" && dataLine) {
        try {
          onReply(JSON.parse(dataLine) as GestorReplyEvent);
        } catch {
          /* ignore malformed */
        }
      }
      eventName = "message";
    }
  }
}
