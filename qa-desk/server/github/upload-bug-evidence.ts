/**
 * Sobe evidências no repo da issue (Contents API) e devolve Markdown embutível.
 * Branch dedicada `bug-evidence` — não polui a default.
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { resolveEvidenceForAttach } from "../supabase-storage.js";
import type { EvidenceFile } from "../types.js";

const execFileAsync = promisify(execFile);

export const EVIDENCE_BRANCH = "bug-evidence";
/** Margem sob o limite prático do Contents API com base64 via CLI. */
const MAX_FILE_BYTES = 20 * 1024 * 1024;

const IMAGE_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".svg",
]);

export type UploadedEvidence = {
  filename: string;
  pathInRepo: string;
  url: string;
  isImage: boolean;
};

export type UploadEvidenceResult = {
  uploaded: UploadedEvidence[];
  skipped: Array<{ filename: string; reason: string }>;
  markdown: string;
};

async function ghJson<T>(args: string[]): Promise<T> {
  const { stdout } = await execFileAsync(
    "gh",
    ["api", "-H", "Accept: application/vnd.github+json", ...args],
    {
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
      timeout: 120_000,
    },
  );
  return JSON.parse(stdout || "null") as T;
}

async function ghApiQuiet(args: string[]): Promise<{ ok: boolean; stderr: string }> {
  try {
    await execFileAsync("gh", ["api", "-H", "Accept: application/vnd.github+json", ...args], {
      windowsHide: true,
      maxBuffer: 32 * 1024 * 1024,
      timeout: 180_000,
    });
    return { ok: true, stderr: "" };
  } catch (err) {
    const e = err as Error & { stderr?: string };
    return { ok: false, stderr: e.stderr?.trim() || e.message };
  }
}

function splitRepo(repository: string): { owner: string; repo: string } {
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) {
    throw Object.assign(new Error(`Repositório inválido: ${repository}`), { status: 500 });
  }
  return { owner, repo };
}

function safeSegment(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() || "file";
  return base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "file";
}

function isImageFilename(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return IMAGE_EXT.has(ext);
}

/** Garante branch `bug-evidence` a partir da default. */
export async function ensureEvidenceBranch(repository: string): Promise<void> {
  const { owner, repo } = splitRepo(repository);
  const prefix = `repos/${owner}/${repo}`;

  const head = await ghApiQuiet([`${prefix}/git/ref/heads/${EVIDENCE_BRANCH}`]);
  if (head.ok) return;

  const meta = await ghJson<{ default_branch: string }>([`${prefix}`]);
  const defaultBranch = meta.default_branch || "main";
  const ref = await ghJson<{ object: { sha: string } }>([
    `${prefix}/git/ref/heads/${defaultBranch}`,
  ]);
  const create = await ghApiQuiet([
    "--method",
    "POST",
    `${prefix}/git/refs`,
    "-f",
    `ref=refs/heads/${EVIDENCE_BRANCH}`,
    "-f",
    `sha=${ref.object.sha}`,
  ]);
  if (!create.ok && !/Reference already exists/i.test(create.stderr)) {
    throw Object.assign(
      new Error(`Não criou branch ${EVIDENCE_BRANCH}: ${create.stderr}`),
      { status: 502 },
    );
  }
}

async function putFile(opts: {
  repository: string;
  pathInRepo: string;
  buffer: Buffer;
  message: string;
}): Promise<void> {
  const { owner, repo } = splitRepo(opts.repository);
  const apiPath = `repos/${owner}/${repo}/contents/${opts.pathInRepo
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qa-desk-gh-ev-"));
  const payloadFile = path.join(tmpDir, "payload.json");
  try {
    fs.writeFileSync(
      payloadFile,
      JSON.stringify({
        message: opts.message,
        content: opts.buffer.toString("base64"),
        branch: EVIDENCE_BRANCH,
      }),
      "utf8",
    );
    const result = await ghApiQuiet(["--method", "PUT", apiPath, "--input", payloadFile]);
    if (!result.ok) {
      // arquivo já existe: busca SHA e sobrescreve
      if (/sha|already exists|422/i.test(result.stderr)) {
        const existing = await ghJson<{ sha: string }>([
          `${apiPath}?ref=${EVIDENCE_BRANCH}`,
        ]).catch(() => null);
        if (existing?.sha) {
          fs.writeFileSync(
            payloadFile,
            JSON.stringify({
              message: opts.message,
              content: opts.buffer.toString("base64"),
              branch: EVIDENCE_BRANCH,
              sha: existing.sha,
            }),
            "utf8",
          );
          const retry = await ghApiQuiet(["--method", "PUT", apiPath, "--input", payloadFile]);
          if (!retry.ok) {
            throw Object.assign(new Error(`Upload falhou: ${retry.stderr}`), { status: 502 });
          }
          return;
        }
      }
      throw Object.assign(new Error(`Upload falhou: ${result.stderr}`), { status: 502 });
    }
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

function rawUrl(repository: string, pathInRepo: string): string {
  const encoded = pathInRepo
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
  return `https://github.com/${repository}/raw/${EVIDENCE_BRANCH}/${encoded}`;
}

export function evidenceToMarkdown(uploaded: UploadedEvidence[]): string {
  if (!uploaded.length) return "_(nenhuma evidência anexada)_";
  return uploaded
    .map((u) =>
      u.isImage
        ? `![${u.filename}](${u.url})`
        : `- [${u.filename}](${u.url})`,
    )
    .join("\n\n");
}

/**
 * Baixa evidências do Storage/disco e sobe no repo da issue.
 */
export type EvidenceUploadProgress = {
  current: number;
  total: number;
  filename: string;
};

export async function uploadBugEvidenceToRepo(
  repository: string,
  folderKey: string,
  evidence: EvidenceFile[],
  onProgress?: (ev: EvidenceUploadProgress) => void,
): Promise<UploadEvidenceResult> {
  const skipped: Array<{ filename: string; reason: string }> = [];
  const uploaded: UploadedEvidence[] = [];

  if (!evidence.length) {
    return { uploaded, skipped, markdown: evidenceToMarkdown(uploaded) };
  }

  onProgress?.({
    current: 0,
    total: evidence.length,
    filename: "branch bug-evidence",
  });
  await ensureEvidenceBranch(repository);
  const folder = safeSegment(folderKey);

  let index = 0;
  for (const ev of evidence) {
    index += 1;
    const filename = ev.filename?.trim() || "arquivo";
    onProgress?.({ current: index, total: evidence.length, filename });
    const loaded = await resolveEvidenceForAttach(ev.storageKey);
    if (!loaded) {
      skipped.push({ filename, reason: "arquivo ausente (Storage/disco)" });
      continue;
    }
    if (loaded.size > MAX_FILE_BYTES) {
      skipped.push({
        filename,
        reason: `acima de ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB`,
      });
      continue;
    }

    const safeName = safeSegment(filename);
    const pathInRepo = `bug-evidence/${folder}/${safeName}`;
    try {
      await putFile({
        repository,
        pathInRepo,
        buffer: loaded.buffer,
        message: `evidência: ${folder}/${safeName}`,
      });
      uploaded.push({
        filename: safeName,
        pathInRepo,
        url: rawUrl(repository, pathInRepo),
        isImage: isImageFilename(safeName) || ev.type === "screenshot",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      skipped.push({ filename, reason: msg.slice(0, 160) });
    }
  }

  return { uploaded, skipped, markdown: evidenceToMarkdown(uploaded) };
}
