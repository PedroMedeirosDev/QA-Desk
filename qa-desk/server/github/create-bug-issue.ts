/**
 * Abre GitHub Issue no repo KB (label `bug`) a partir de um bug do Desk.
 * Requer `gh` autenticado (mesmo setup da Curadoria KB).
 * Evidências sobem na branch `bug-evidence` e entram no body da issue.
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  formatBugIssueTitle,
  formatBugReportMarkdown,
} from "../../src/lib/bug-report-markdown.js";
import type { TestRecord } from "../types.js";
import { uploadBugEvidenceToRepo } from "./upload-bug-evidence.js";

const execFileAsync = promisify(execFile);

const DEFAULT_REPO = "polygonus-br/polygonus-suporte-kb";
const DEFAULT_LABEL = "bug";

export function bugIssuesRepo(): string {
  return process.env.GITHUB_BUG_ISSUES_REPO?.trim() || DEFAULT_REPO;
}

export type CreateBugIssueResult = {
  number: number;
  url: string;
  title: string;
  repository: string;
  evidenceUploaded: number;
  evidenceSkipped: Array<{ filename: string; reason: string }>;
};

function parseIssueCreateOutput(stdout: string): { number: number; url: string } {
  const url = stdout.trim().split(/\r?\n/).filter(Boolean).pop()?.trim() ?? "";
  const m = url.match(/\/issues\/(\d+)\s*$/);
  if (!url || !m) {
    throw Object.assign(
      new Error(`gh issue create: URL inesperada: ${stdout.slice(0, 200)}`),
      { status: 502 },
    );
  }
  return { number: Number(m[1]), url };
}

export async function createBugGithubIssue(
  report: TestRecord,
): Promise<CreateBugIssueResult> {
  if (report.githubIssueNumber && report.githubIssueUrl) {
    return {
      number: report.githubIssueNumber,
      url: report.githubIssueUrl,
      title: formatBugIssueTitle(report),
      repository: bugIssuesRepo(),
      evidenceUploaded: 0,
      evidenceSkipped: [],
    };
  }

  const repository = bugIssuesRepo();
  const title = formatBugIssueTitle(report);
  const folderKey = report.bugCode?.trim() || report.id;

  const evidenceResult = await uploadBugEvidenceToRepo(
    repository,
    folderKey,
    report.evidence ?? [],
  );

  let evidenceMarkdown = evidenceResult.markdown;
  if (evidenceResult.skipped.length) {
    const skipLines = evidenceResult.skipped
      .map((s) => `- \`${s.filename}\` — ${s.reason}`)
      .join("\n");
    evidenceMarkdown =
      (evidenceResult.uploaded.length ? evidenceMarkdown + "\n\n" : "") +
      `### Não anexados\n${skipLines}`;
  }

  const body = formatBugReportMarkdown(report, { evidenceMarkdown });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qa-desk-issue-"));
  const bodyFile = path.join(tmpDir, "body.md");
  try {
    fs.writeFileSync(bodyFile, body, "utf8");

    let stdout: string;
    try {
      const result = await execFileAsync(
        "gh",
        [
          "issue",
          "create",
          "--repo",
          repository,
          "--label",
          DEFAULT_LABEL,
          "--title",
          title,
          "--body-file",
          bodyFile,
        ],
        {
          windowsHide: true,
          maxBuffer: 2 * 1024 * 1024,
          timeout: 60_000,
        },
      );
      stdout = result.stdout;
    } catch (err) {
      const e = err as Error & { stderr?: string; code?: string };
      const detail = [e.stderr?.trim(), e.message].filter(Boolean).join(" — ");
      if (e.code === "ENOENT") {
        throw Object.assign(
          new Error("gh não encontrado no PATH — instale o GitHub CLI e autentique"),
          { status: 503 },
        );
      }
      throw Object.assign(new Error(`Falha ao criar issue: ${detail || "erro desconhecido"}`), {
        status: 502,
      });
    }

    const { number, url } = parseIssueCreateOutput(stdout);
    return {
      number,
      url,
      title,
      repository,
      evidenceUploaded: evidenceResult.uploaded.length,
      evidenceSkipped: evidenceResult.skipped,
    };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}
