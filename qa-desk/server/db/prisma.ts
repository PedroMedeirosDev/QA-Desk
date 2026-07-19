import { PrismaClient } from "@prisma/client";
import { isDatabaseEnabled } from "./config.js";

const globalForPrisma = globalThis as unknown as { __qaPrisma?: PrismaClient };

export function getPrisma(): PrismaClient {
  if (!isDatabaseEnabled()) {
    throw new Error("DATABASE_URL não definido — modo JSON ativo.");
  }
  if (!globalForPrisma.__qaPrisma) {
    globalForPrisma.__qaPrisma = new PrismaClient({
      log: process.env.QA_PRISMA_LOG === "1" ? ["query", "error", "warn"] : ["error"],
    });
  }
  return globalForPrisma.__qaPrisma;
}
