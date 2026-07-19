import type { Prisma } from "@prisma/client";
import type { ProjectSlug } from "../types.js";
import { isDatabaseEnabled } from "./config.js";
import { getPrisma } from "./prisma.js";

export type TestRunRecordInput = {
  project: ProjectSlug;
  testId: string;
  runId: string;
  runNumber?: number;
  status: "success" | "failed" | "cancelled";
  exitCode?: number | null;
  flowPath?: string;
  output?: string;
  appVersion?: string;
  homologationId?: string;
  startedAt: string;
  finishedAt?: string;
  meta?: Record<string, unknown>;
  evidencePaths?: string[];
};

/** Persiste execução em test_runs (no-op se modo JSON). */
export async function recordTestRun(input: TestRunRecordInput): Promise<void> {
  if (!isDatabaseEnabled()) return;

  const prisma = getPrisma();
  const data = {
    projectSlug: input.project,
    testId: input.testId,
    runId: input.runId,
    runNumber: input.runNumber ?? null,
    status: input.status,
    exitCode: input.exitCode ?? null,
    flowPath: input.flowPath ?? null,
    output: input.output ?? null,
    appVersion: input.appVersion ?? null,
    homologationId: input.homologationId ?? null,
    startedAt: new Date(input.startedAt),
    finishedAt: input.finishedAt ? new Date(input.finishedAt) : new Date(),
    meta: (input.meta ?? undefined) as Prisma.InputJsonValue | undefined,
    evidencePaths: (input.evidencePaths ?? undefined) as Prisma.InputJsonValue | undefined,
  };

  try {
    await prisma.testRun.upsert({
      where: { runId: input.runId },
      create: data,
      update: data,
    });
  } catch (err) {
    console.warn("[qa-desk] Falha ao gravar test_run:", err);
  }
}
