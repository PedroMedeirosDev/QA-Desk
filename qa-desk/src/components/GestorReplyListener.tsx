import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import {
  listenGestorRepliesStream,
  QA_GESTOR_REPLY_EVENT,
  emitGestorInboxChanged,
  type GestorReplyEvent,
} from "@/lib/gestor-replies-stream";
import { notifyGestorReply, readGestorNotifyPref } from "@/lib/gestor-notify";
import { projectBugDetailPath } from "@/lib/project-paths";
import { useToast } from "@/lib/toast";

/**
 * Conexão SSE global (admin): notificação do Chrome + toast + evento para a lista/ficha.
 */
export function GestorReplyListener() {
  const { isAdmin, ready } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (!ready || !isAdmin) return;

    const ac = new AbortController();
    let cancelled = false;
    let attempt = 0;

    function handle(event: GestorReplyEvent) {
      const key = `${event.bugId}:${event.at}:${event.commentUrl ?? ""}`;
      if (seen.current.has(key)) return;
      seen.current.add(key);

      const openBug = () => {
        navigate(projectBugDetailPath(event.project, event.bugId, event.channel));
      };

      window.dispatchEvent(new CustomEvent<GestorReplyEvent>(QA_GESTOR_REPLY_EVENT, { detail: event }));
      emitGestorInboxChanged();

      if (readGestorNotifyPref() !== "on") return;

      notifyGestorReply({
        bugCode: event.bugCode,
        title: event.title,
        author: event.author,
        snippet: event.snippet,
        onClick: openBug,
      });

      toast.info(event.snippet || event.title, {
        title: `Gestor respondeu · ${event.bugCode}`,
        duration: 14_000,
        action: { label: "Abrir", onClick: openBug },
      });
    }

    async function loop() {
      while (!cancelled) {
        try {
          await listenGestorRepliesStream(handle, ac.signal);
          attempt = 0;
        } catch (error) {
          if (cancelled || ac.signal.aborted) break;
          const delay = Math.min(15_000, 1_500 * 2 ** Math.min(attempt, 3));
          attempt += 1;
          console.warn(
            "[gestor-replies-sse] reconectando em",
            delay,
            "ms",
            error instanceof Error ? error.message : error,
          );
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    void loop();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [ready, isAdmin, navigate, toast]);

  return null;
}
