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
};

function mapGhError(err: unknown): never {
  const e = err as Error & { stderr?: string; code?: string; stdout?: string };
  const detail = [e.stderr?.trim(), e.stdout?.trim(), e.message]
    .filter(Boolean)
    .join(" — ");
  if (e.code === "ENOENT") {
    throw Object.assign(
      new Error("gh não encontrado no PATH — instale o GitHub CLI e autentique"),
      { status: 503 },
    );
  }
  throw Object.assign(new Error(`Falha ao fechar issue no GitHub: ${detail}`), {
    status: 502,
  });
}

/**
 * `gh issue close <n>`. Se já estiver fechada, retorna alreadyClosed.
 */
export async function closeBugGithubIssue(
  report: TestRecord,
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
      {
        windowsHide: true,
        maxBuffer: 1024 * 1024,
        timeout: 60_000,
      },
    );
    const viewed = JSON.parse(stdout) as { state?: string; url?: string };
    if ((viewed.state ?? "").toUpperCase() === "CLOSED") {
      return {
        number,
        url: viewed.url?.trim() || url,
        repository,
        alreadyClosed: true,
      };
    }
  } catch (err) {
    mapGhError(err);
  }

  try {
    await execFileAsync(
      "gh",
      [
        "issue",
        "close",
        String(number),
        "--repo",
        repository,
        "--reason",
        "completed",
      ],
      {
        windowsHide: true,
        maxBuffer: 1024 * 1024,
        timeout: 60_000,
      },
    );
  } catch (err) {
    mapGhError(err);
  }

  return { number, url, repository, alreadyClosed: false };
}
