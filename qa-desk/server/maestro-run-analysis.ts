import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { REPO_ROOT } from "./automation.js";

const ANALYZE_SCRIPT = path.join(
  REPO_ROOT,
  "projects/polygonus/automation/maestro/analyze-maestro-run.mjs",
);

export interface MaestroAnalysis {
  ok: boolean;
  alerts?: Array<{ level: string; code: string; message: string }>;
  webhookSent?: boolean;
  webhookError?: string;
}

export async function analyzeMaestroOutput(
  output: string,
  meta: Record<string, unknown> = {},
): Promise<MaestroAnalysis | null> {
  if (!output.trim() || !fs.existsSync(ANALYZE_SCRIPT)) return null;

  const webhook =
    process.env.N8N_WEBHOOK_URL || process.env.QA_N8N_WEBHOOK_URL || "";

  const tmp = path.join(os.tmpdir(), `maestro-run-${Date.now()}.log`);
  fs.writeFileSync(tmp, output, "utf8");

  return new Promise((resolve) => {
    const args = ["--log", tmp, "--quiet"];
    if (webhook) args.push("--webhook", webhook);

    const child = spawn(process.execPath, [ANALYZE_SCRIPT, ...args], {
      cwd: path.dirname(ANALYZE_SCRIPT),
      env: { ...process.env, N8N_WEBHOOK_URL: webhook },
    });

    let stdout = "";
    child.stdout.on("data", (c) => {
      stdout += c.toString();
    });
    child.on("close", () => {
      fs.unlink(tmp, () => {});
      try {
        resolve({ ...(JSON.parse(stdout) as MaestroAnalysis), ...meta });
      } catch {
        resolve(null);
      }
    });
    child.on("error", () => {
      fs.unlink(tmp, () => {});
      resolve(null);
    });
  });
}

/** Fire-and-forget — não bloqueia resposta HTTP */
export function analyzeMaestroOutputAsync(
  output: string,
  meta: Record<string, unknown> = {},
): void {
  void analyzeMaestroOutput(output, meta).catch(() => {});
}
