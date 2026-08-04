import { authHeaders } from "@/lib/auth-token";
import type { ProjectSlug } from "@/types/test-record";

export type KbCurationStreamEvent = {
  project: ProjectSlug;
  at: string;
  reason: string;
};

/**
 * Mantém a conexão SSE aberta (fetch + ReadableStream — Bearer auth).
 * Resolve quando a stream fecha; o caller reconecta com backoff.
 */
export async function listenKbCurationStream(
  project: ProjectSlug,
  onUpdate: (event: KbCurationStreamEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch(`/api/projects/${project}/kb-curation/stream`, {
    headers: authHeaders({ Accept: "text/event-stream" }),
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(
      (err as { error?: string }).error ?? `SSE ${res.status}`,
    );
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

      if (eventName === "catalog-updated" && dataLine) {
        try {
          onUpdate(JSON.parse(dataLine) as KbCurationStreamEvent);
        } catch {
          /* ignore malformed */
        }
      }
      eventName = "message";
    }
  }
}
