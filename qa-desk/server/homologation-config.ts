import {
  MURAL_HOMOLOGATION_ITEMS,
  muralDomainTestKey,
} from "./automation.js";
import { testKeyFromFlow } from "./test-key.js";

export const MURAL_HOMOLOGATION_SLUG = "mural-backend-homologacao";

/** Chaves canônicas na ordem das suites (CRUD → … → E2E). */
export function muralTestKeys(): string[] {
  return MURAL_HOMOLOGATION_ITEMS.map((item) => muralDomainTestKey(item.ctId));
}

/** Chave legada derivada do YAML (`mural/01_1_comunicado_enviar`) — só migração. */
export function muralLegacyFlowTestKey(flowPath: string): string {
  return testKeyFromFlow(flowPath);
}
