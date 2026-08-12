/**
 * Fecha issue GitHub vinculada a um bug do Desk.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { TestRecord } from "../types.js";
import { bugIssuesRepo } from "./create-bug-issue.js";

const execFileAsync = promisify(execFile);

export type CloseBugIssueResult = {
  number: number;
  url: string;
  repository: string;
  alreadyClosed: boolean;
  commentPosted: boolean;
};

export type CloseBugIssueOptions = {
  /** Comentário opcional na issue (homologação / build). */
  comment?: string;
};

function mapGhError(err: unknown): never {
  const e = err as Error & { stderr?: string; code?: string; stdout?: string };
  const detail = [e.stderr?.trim(), e.stdout?.trim(), e.message]
    .filter(Boolean)
    .join(" \u2014 ");
  if (e.code === "ENOENT") {
    throw Object.assign(
      new Error("gh não encontrado no PATH \u2014 instale o GitHub CLI e autentique"),
      { status: 503 },
    );
  }
  throw Object.assign(new Error("Falha ao fechar issue no GitHub: " + detail), {
    status: 502,
  });
}

const ghOpts = {
  windowsHide: true,
  maxBuffer: 1024 * 1024,
  timeout: 60_000,
} as const;

/**
 * gh issue close <n> (+ comentário opcional). Se já estiver fechada, retorna
 * alreadyClosed; ainda assim posta o comentário se houver texto.
 */
export async function closeBugGithubIssue(
  report: TestRecord,
  opts?: CloseBugIssueOptions,
): Promise<CloseBugIssueResult> {
  const number = report.githubIssueNumber;
  const url = report.githubIssueUrl?.trim();
  if (!number || !url) {
    throw Object.assign(
      new Error("Bug sem issue GitHub vinculada"),
      { status: 400 },
    );
  }

  const repository = bugIssuesRepo();
  const comment = (opts?.comment ?? "").trim();

  let alreadyClosed = false;
  let issueUrl = url;

  try {
    const { stdout } = await execFileAsync(
      "gh",
      [
        "issue",
        "view",
        String(number),
        "--repo",
        repository,
        "--json",
        "state,url",
      ],
      ghOpts,
    );
    const viewed = JSON.parse(stdout) as { state?: string; url?: string };
    alreadyClosed = (viewed.state ?? "").toUpperCase() === "CLOSED";
    if (viewed.url?.trim()) issueUrl = viewed.url.trim();
  } catch (err) {
    mapGhError(err);
  }

  let commentPosted = false;

  if (alreadyClosed) {
    if (comment) {
      try {
        await execFileAsync(
          "gh",
          [
            "issue",
            "comment",
            String(number),
            "--repo",
            repository,
            "--body",
            comment,
          ],
          ghOpts,
        );
        commentPosted = true;
      } catch (err) {
        mapGhError(err);
      }
    }
    return {
      number,
      url: issueUrl,
      repository,
      alreadyClosed: true,
      commentPosted,
    };
  }

  try {
    const args = [
      "issue",
      "close",
      String(number),
      "--repo",
      repository,
      "--reason",
      "completed",
    ];
    if (comment) {
      args.push("--comment", comment);
      commentPosted = true;
    }
    await execFileAsync("gh", args, ghOpts);
  } catch (err) {
    mapGhError(err);
  }

  return {
    number,
    url: issueUrl,
    repository,
    alreadyClosed: false,
    commentPosted,
  };
}
