import { CURRENT_USER } from "@/config/user";

const ACTOR_LABELS: Record<string, string> = {
  [CURRENT_USER.id]: CURRENT_USER.actor,
  system: "System",
};

/** Exibe ator do histórico com capitalização correta (inclui registros legados). */
export function formatActor(actor: string): string {
  return ACTOR_LABELS[actor] ?? actor;
}
