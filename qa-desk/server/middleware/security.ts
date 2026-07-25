import type { CorsOptions } from "cors";
import rateLimit from "express-rate-limit";

const IS_PROD = process.env.NODE_ENV === "production";

/** Origens permitidas (vírgula). Vazio em prod = só same-origin; em dev = refletir qualquer origem. */
export function buildCorsOptions(): CorsOptions {
  const raw = process.env.QA_CORS_ORIGINS?.trim();
  if (!raw) {
    if (!IS_PROD) return { origin: true, credentials: true };
    return {
      origin: false,
      credentials: true,
    };
  }
  if (raw === "*") {
    return { origin: true, credentials: true };
  }
  const allowed = new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  return {
    credentials: true,
    origin(origin, callback) {
      // same-origin / curl / server-to-server sem Origin
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowed.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS: origem não permitida (${origin})`));
    },
  };
}

/** Limite geral da API (por IP; atrás do Caddy use trust proxy). */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.QA_RATE_LIMIT_API ?? 400),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições — tente de novo em alguns minutos" },
  skip: (req) =>
    req.path === "/health" ||
    req.path === "/api/health" ||
    (req.originalUrl?.split("?")[0] ?? "") === "/api/health",
});

/** Webhook GitHub — evita flood; GitHub reenvia se 429. */
export const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.QA_RATE_LIMIT_WEBHOOK ?? 60),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Webhook rate limit" },
});
