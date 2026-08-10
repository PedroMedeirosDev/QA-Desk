import type { NextFunction, Request, Response } from "express";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { CURRENT_USER } from "../config/user.js";

export type AppRole = "admin" | "visitor";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: AppRole;
  actor: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

let anonClient: SupabaseClient | null = null;
let serviceClient: SupabaseClient | null = null;

export function isServerAuthConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_ANON_KEY?.trim());
}

function getAnonClient(): SupabaseClient | null {
  if (!isServerAuthConfigured()) return null;
  if (!anonClient) {
    anonClient = createClient(
      process.env.SUPABASE_URL!.trim(),
      process.env.SUPABASE_ANON_KEY!.trim(),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return anonClient;
}

/** Client com service_role — Storage, updates em profiles, etc. Nunca expor ao front. */
export function getServiceClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  if (!serviceClient) {
    serviceClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return serviceClient;
}

const MOCK_ADMIN: AuthUser = {
  id: CURRENT_USER.id,
  email: "local@qa-desk.dev",
  displayName: CURRENT_USER.name,
  role: "admin",
  actor: CURRENT_USER.actor,
};

/** Evita getUser+profiles em todo request (Supabase remoto ~1–3s cada). */
const AUTH_CACHE_TTL_MS = 60_000;
const authCache = new Map<string, { user: AuthUser; expiresAt: number }>();

function cachedAuthUser(token: string): AuthUser | null {
  const hit = authCache.get(token);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    authCache.delete(token);
    return null;
  }
  return hit.user;
}

function putAuthCache(token: string, user: AuthUser) {
  authCache.set(token, { user, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
  if (authCache.size > 200) {
    const now = Date.now();
    for (const [k, v] of authCache) {
      if (now > v.expiresAt) authCache.delete(k);
    }
  }
}

function bearerToken(req: Request): string | null {
  const h = req.headers.authorization;
  if (h?.startsWith("Bearer ")) {
    const token = h.slice(7).trim();
    if (token) return token;
  }
  // Evidências via <img>/<a> não enviam Authorization — token na query (mesmo JWT).
  const q = req.query.access_token;
  if (typeof q === "string" && q.trim()) return q.trim();
  return null;
}

async function profileForUser(user: User): Promise<AuthUser> {
  const email = user.email ?? "";
  const fallbackName = email.split("@")[0] || "Usuário";
  const db = getServiceClient() ?? getAnonClient();

  if (db) {
    const { data } = await db
      .from("profiles")
      .select("display_name, role, email")
      .eq("id", user.id)
      .maybeSingle();

    if (data) {
      const displayName =
        (data.display_name as string | null)?.trim() || fallbackName;
      const role: AppRole = data.role === "admin" ? "admin" : "visitor";
      return {
        id: user.id,
        email: (data.email as string | null) ?? email,
        displayName,
        role,
        actor: role === "admin" ? CURRENT_USER.actor : displayName,
      };
    }
  }

  return {
    id: user.id,
    email,
    displayName: fallbackName,
    role: "visitor",
    actor: fallbackName,
  };
}

/** Anexa req.user. Sem Supabase → mock admin (dev local / Maestro). */
export async function attachUser(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isServerAuthConfigured()) {
      req.user = MOCK_ADMIN;
      return next();
    }

    const token = bearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const cached = cachedAuthUser(token);
    if (cached) {
      req.user = cached;
      return next();
    }

    const client = getAnonClient();
    if (!client) {
      return res.status(500).json({ error: "Auth mal configurada no servidor" });
    }

    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: "Sessão inválida ou expirada" });
    }

    req.user = await profileForUser(data.user);
    putAuthCache(token, req.user);
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Apenas admin" });
  }
  next();
}

export function actorOf(req: Request): string {
  return req.user?.actor ?? CURRENT_USER.actor;
}

export function isVisitor(req: Request): boolean {
  return req.user?.role === "visitor";
}

/**
 * Visitante: apenas leitura (GET/HEAD/OPTIONS).
 * Mutações retornam 403 genérico — defesa em profundidade além do requireAdmin.
 */
export function rejectVisitorMutations(req: Request, res: Response, next: NextFunction) {
  if (!isVisitor(req)) return next();
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return next();
  return res.status(403).json({ error: "Operação não permitida" });
}

/** Bloqueia visitante em rotas ainda fechadas no portfólio (KB, homologações, etc.). */
export function forbidVisitor(req: Request, res: Response, next: NextFunction) {
  if (isVisitor(req)) {
    return res.status(403).json({ error: "Operação não permitida" });
  }
  next();
}

/** Filtra catálogo de testes para visitante (só portfólio). Nunca confiar em query/body. */
export function filterPortfolioReports<T extends { showInPortfolio?: boolean }>(
  reports: T[],
  visitor: boolean,
): T[] {
  if (!visitor) return reports;
  return reports.filter((r) => r.showInPortfolio === true);
}
