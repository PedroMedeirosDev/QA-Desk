/** Postgres ativo quando DATABASE_URL está definido (ex.: docker compose + .env). */
export function isDatabaseEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function storageMode(): "postgres" | "json" {
  return isDatabaseEnabled() ? "postgres" : "json";
}
