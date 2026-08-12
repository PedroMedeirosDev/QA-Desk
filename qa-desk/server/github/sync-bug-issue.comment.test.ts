/**
 * Smoke unitário: comentário gestor vs QA/bot.
 * Uso: npx tsx server/github/sync-bug-issue.comment.test.ts
 */
import assert from "node:assert/strict";
import {
  isGestorIssueComment,
  statusFromIssueAction,
} from "./sync-bug-issue.ts";

process.env.GITHUB_BUG_ISSUE_ACTORS = "PedroMedeirosDev";
delete process.env.GITHUB_BUG_COMMENT_ACTORS;

assert.equal(
  isGestorIssueComment({ user: { login: "gestor-poly", type: "User" } }),
  true,
);
assert.equal(
  isGestorIssueComment({ user: { login: "PedroMedeirosDev", type: "User" } }),
  false,
);
assert.equal(
  isGestorIssueComment({ user: { login: "dependabot[bot]", type: "Bot" } }),
  false,
);

process.env.GITHUB_BUG_COMMENT_ACTORS = "MoacirPoly,OutroGestor";
assert.equal(
  isGestorIssueComment({ user: { login: "MoacirPoly", type: "User" } }),
  true,
);
assert.equal(
  isGestorIssueComment({ user: { login: "gestor-poly", type: "User" } }),
  false,
);

assert.equal(statusFromIssueAction("closed", null), "corrigido_gestor");
assert.equal(statusFromIssueAction("closed", "not_planned"), "sem_correcao");
assert.equal(statusFromIssueAction("reopened", null), "enviado_gestor");

console.log("sync-bug-issue.comment.test.ts OK");
