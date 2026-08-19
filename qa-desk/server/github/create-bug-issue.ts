/**
 * Abre / atualiza GitHub Issue no repo KB (label `bug`) a partir de um bug do Desk.
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
import type { GithubIssueProgressEvent } from "../../src/lib/github-issue-stream.js";

const execFileAsync = promisify(execFile);

const DEFAULT_REPO = "polygonus-br/polygonus-suporte-kb";
const DEFAULT_LABEL = "bug";

export function bugIssuesRepo(): string {
  return process.env.GITHUB_BUG_ISSUES_REPO?.trim() || DEFAULT_REPO;
}

export type BugIssueResult = {
  number: number;
  url: string;
  title: string;
  repository: string;
  evidenceUploaded: number;
  evidenceSkipped: Array<{ filename: string; reason: string }>;
};

/** @deprecated use BugIssueResult */
export type CreateBugIssueResult = BugIssueResult;

export type IssueProgressFn = (ev: GithubIssueProgressEvent) => void;

async function buildIssueMarkdown(
  report: TestRecord,
  onProgress?: IssueProgressFn,
): Promise<{
  title: string;
  body: string;
  evidenceUploaded: number;
  evidenceSkipped: Array<{ filename: string; reason: string }>;
}> {
  const repository = bugIssuesRepo();
  const title = formatBugIssueTitle(report);
  const folderKey = report.bugCode?.trim() || report.id;
  const files = report.evidence ?? [];

  if (files.length) {
    onProgress?.({
      type: "progress",
      phase: "evidence",
      message: `Preparando ${files.length} evidência${files.length === 1 ? "" : "s"}…`,
      current: 0,
      total: files.length,
    });
  }

  const evidenceResult = await uploadBugEvidenceToRepo(
    repository,
    folderKey,
    files,
    (ev) => {
      const preparing = ev.current === 0;
      onProgress?.({
        type: "progress",
        phase: "evidence",
        message: preparing
          ? "Preparando branch de evidências no GitHub…"
          : `Enviando evidência ${ev.current}/${ev.total}: ${ev.filename}`,
        current: ev.current,
        total: ev.total,
        filename: ev.filename,
      });
    },
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

  return {
    title,
    body: formatBugReportMarkdown(report, { evidenceMarkdown }),
    evidenceUploaded: evidenceResult.uploaded.length,
    evidenceSkipped: evidenceResult.skipped,
  };
}

async function withBodyFile<T>(
  body: string,
  run: (bodyFile: string) => Promise<T>,
): Promise<T> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qa-desk-issue-"));
  const bodyFile = path.join(tmpDir, "body.md");
  try {
    fs.writeFileSync(bodyFile, body, "utf8");
    return await run(bodyFile);
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

function mapGhError(err: unknown, action: "criar" | "atualizar"): never {
  const e = err as Error & { stderr?: string; code?: string };
  const detail = [e.stderr?.trim(), e.message].filter(Boolean).join(" — ");
  if (e.code === "ENOENT") {
    throw Object.assign(
      new Error("gh não encontrado no PATH — instale o GitHub CLI e autentique"),
      { status: 503 },
    );
  }
  throw Object.assign(
    new Error(`Falha ao ${action} issue: ${detail || "erro desconhecido"}`),
    { status: 502 },
  );
}

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
  onProgress?: IssueProgressFn,
): Promise<BugIssueResult> {
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
  const built = await buildIssueMarkdown(report, onProgress);
  onProgress?.({
    type: "progress",
    phase: "issue",
    message: "Criando a issue no GitHub…",
  });

  return withBodyFile(built.body, async (bodyFile) => {
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
          built.title,
          "--body-file",
          bodyFile,
        ],
        {
          windowsHide: true,
          maxBuffer: 2 * 1024 * 1024,
          timeout: 120_000,
        },
      );
      stdout = result.stdout;
    } catch (err) {
      mapGhError(err, "criar");
    }

    const { number, url } = parseIssueCreateOutput(stdout);
    return {
      number,
      url,
      title: built.title,
      repository,
      evidenceUploaded: built.evidenceUploaded,
      evidenceSkipped: built.evidenceSkipped,
    };
  });
}

/**
 * Atualiza título + body da issue já vinculada (e reenvia evidências para bug-evidence/).
 */
export async function updateBugGithubIssue(
  report: TestRecord,
  onProgress?: IssueProgressFn,
): Promise<BugIssueResult> {
  const number = report.githubIssueNumber;
  const url = report.githubIssueUrl?.trim();
  if (!number || !url) {
    throw Object.assign(
      new Error("Bug sem issue GitHub vinculada — abra a issue antes de sincronizar"),
      { status: 400 },
    );
  }

  const repository = bugIssuesRepo();
  const built = await buildIssueMarkdown(report, onProgress);
  onProgress?.({
    type: "progress",
    phase: "issue",
    message: `Atualizando título e body da issue #${number}…`,
  });

  return withBodyFile(built.body, async (bodyFile) => {
    try {
      await execFileAsync(
        "gh",
        [
          "issue",
          "edit",
          String(number),
          "--repo",
          repository,
          "--title",
          built.title,
          "--body-file",
          bodyFile,
        ],
        {
          windowsHide: true,
          maxBuffer: 2 * 1024 * 1024,
          timeout: 120_000,
        },
      );
    } catch (err) {
      mapGhError(err, "atualizar");
    }

    return {
      number,
      url,
      title: built.title,
      repository,
      evidenceUploaded: built.evidenceUploaded,
      evidenceSkipped: built.evidenceSkipped,
    };
  });
}
