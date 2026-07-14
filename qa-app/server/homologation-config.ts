import { testKeyFromFlow } from "./test-key.js";
import { MURAL_HOMOLOGATION_ITEMS } from "./automation.js";

export const MURAL_HOMOLOGATION_SLUG = "mural-backend-homologacao";

export function muralTestKeys(): string[] {
  return MURAL_HOMOLOGATION_ITEMS.map((item) => testKeyFromFlow(item.flowPath));
}
