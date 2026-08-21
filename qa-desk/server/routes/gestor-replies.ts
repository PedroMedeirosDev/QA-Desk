import { Router } from "express";
import { subscribeGestorRepliesSse } from "../gestor-replies-sse.js";
import { attachUser, requireAdmin } from "../middleware/auth.js";
import { readCatalog } from "../storage.js";
import {
  PROJECTS,
  type ProductChannel,
  type ProjectSlug,
  type TestRecord,
} from "../types.js";

export const gestorRepliesRouter = Router();

gestorRepliesRouter.use(attachUser);
gestorRepliesRouter.use(requireAdmin);

gestorRepliesRouter.get("/stream", (req, res) => {
  req.socket.setTimeout(0);
  res.setTimeout(0);
  subscribeGestorRepliesSse(res);
});

function isBugReport(record: TestRecord): boolean {
  return (record.recordType ?? (record.campaign ? "teste" : "bug")) === "bug";
}

function isGestorReplyUnread(r: TestRecord): boolean {
  const at = r.githubIssueLastCommentAt;
  if (!at) return false;
  const seen = r.githubIssueLastCommentSeenAt;
  if (!seen) return false;
  return seen < at;
}

function inferChannel(r: TestRecord): ProductChannel | undefined {
  if (r.channel) return r.channel;
  if (r.platform === "android" || r.platform === "ios" || r.platform === "app_web") {
    return "app";
  }
  if (r.platform === "web") return "web";
  return undefined;
}

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

/** Inbox: comentários do gestor ainda não abertos no Desk. */
gestorRepliesRouter.get("/unread", async (_req, res) => {
  const items: GestorUnreadItem[] = [];

  for (const { slug } of PROJECTS) {
    const catalog = await readCatalog(slug);
    for (const report of catalog.reports) {
      if (!isBugReport(report) || !isGestorReplyUnread(report)) continue;
      const code = report.bugCode?.trim() || report.id;
      items.push({
        project: slug,
        bugId: report.id,
        bugCode: code,
        title: report.title?.trim() || "(sem título)",
        author: report.githubIssueLastCommentBy?.trim() || "gestor",
        snippet: report.githubIssueLastCommentBody?.trim() || "",
        at: report.githubIssueLastCommentAt!,
        channel: inferChannel(report),
        commentUrl: report.githubIssueLastCommentUrl,
      });
    }
  }

  items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  res.json({ items, count: items.length });
});
