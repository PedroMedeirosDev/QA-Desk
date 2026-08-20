import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { CURRENT_USER } from "@/config/user";
import { setAccessToken } from "@/lib/auth-token";
import { getSupabase, isAuthConfigured } from "@/lib/supabase";
import {
  initialsFromName,
  type UserProfile,
  type UserRole,
} from "@/types/profile";

interface AuthContextValue {
  ready: boolean;
  authEnabled: boolean;
  session: Session | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  isVisitor: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Atualiza avatar no estado após upload (admin). */
  applyAvatar: (avatarPath: string, avatarUrl: string | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const MOCK_PROFILE: UserProfile = {
  id: CURRENT_USER.id,
  email: "local@qa-desk.dev",
  displayName: CURRENT_USER.name,
  role: "admin",
  actor: CURRENT_USER.actor,
  initials: CURRENT_USER.initials,
};

function roleFromRow(raw: unknown): UserRole {
  return raw === "admin" ? "admin" : "visitor";
}

async function loadProfile(userId: string, email: string | undefined): Promise<UserProfile> {
  const supabase = getSupabase();
  if (!supabase) return MOCK_PROFILE;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, role, avatar_path")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    const displayName = email?.split("@")[0] ?? "Usuário";
    return {
      id: userId,
      email: email ?? "",
      displayName,
      role: "visitor",
      actor: displayName,
      initials: initialsFromName(displayName),
      avatarPath: null,
      avatarUrl: null,
    };
  }

  const displayName = (data.display_name as string | null)?.trim() || email?.split("@")[0] || "Usuário";
  const role = roleFromRow(data.role);
  const avatarPath = (data.avatar_path as string | null)?.trim() || null;
  const base = import.meta.env.VITE_SUPABASE_URL?.trim()?.replace(/\/$/, "") ?? "";
  const avatarUrl =
    avatarPath && base
      ? `${base}/storage/v1/object/public/avatars/${avatarPath.replace(/^\/+/, "")}`
      : null;
  return {
    id: data.id as string,
    email: (data.email as string | null) ?? email ?? "",
    displayName,
    role,
    actor: role === "admin" ? CURRENT_USER.actor : displayName,
    initials: initialsFromName(displayName),
    avatarPath,
    avatarUrl,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const authEnabled = isAuthConfigured();
  const [ready, setReady] = useState(!authEnabled);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(authEnabled ? null : MOCK_PROFILE);

  useEffect(() => {
    if (!authEnabled) {
      setAccessToken(null);
      setProfile(MOCK_PROFILE);
      setReady(true);
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setReady(true);
      return;
    }

    let cancelled = false;
    let knownUserId: string | null = null;
    let markedReady = false;

    function markReady() {
      if (cancelled || markedReady) return;
      markedReady = true;
      setReady(true);
    }

    async function applySession(next: Session | null) {
      setSession(next);
      setAccessToken(next?.access_token ?? null);
      knownUserId = next?.user.id ?? null;
      if (!next?.user) {
        setProfile(null);
        return;
      }
      try {
        const p = await Promise.race([
          loadProfile(next.user.id, next.user.email),
          new Promise<UserProfile>((_, reject) => {
            window.setTimeout(() => reject(new Error("profile timeout")), 8_000);
          }),
        ]);
        if (!cancelled) setProfile(p);
      } catch {
        if (!cancelled) {
          const displayName = next.user.email?.split("@")[0] ?? "Usuário";
          setProfile({
            id: next.user.id,
            email: next.user.email ?? "",
            displayName,
            role: "visitor",
            actor: displayName,
            initials: initialsFromName(displayName),
            avatarPath: null,
            avatarUrl: null,
          });
        }
      }
    }

    const bootTimeout = window.setTimeout(() => {
      console.warn("[auth] timeout ao carregar sessão — liberando UI");
      markReady();
    }, 12_000);

    void supabase.auth
      .getSession()
      .then(({ data }) => applySession(data.session))
      .catch((err) => {
        console.warn("[auth] getSession falhou", err);
        setSession(null);
        setAccessToken(null);
        setProfile(null);
      })
      .finally(() => {
        window.clearTimeout(bootTimeout);
        markReady();
      });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      // Alt+Tab: TOKEN_REFRESHED / INITIAL_SESSION. Recarregar perfil
      // desmonta o editor e apaga o que estava sendo digitado.
      if (event === "INITIAL_SESSION") return;
      if (event === "TOKEN_REFRESHED") {
        if (next) {
          setAccessToken(next.access_token);
          setSession((prev) =>
            prev?.user.id === next.user.id ? prev : next,
          );
        }
        return;
      }
      if (event === "SIGNED_IN" && next?.user.id && next.user.id === knownUserId) {
        setAccessToken(next.access_token);
        return;
      }
      if (event === "SIGNED_OUT") {
        void applySession(null);
        return;
      }
      void applySession(next);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(bootTimeout);
      sub.subscription.unsubscribe();
    };
  }, [authEnabled]);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Auth não configurada");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
    setAccessToken(null);
    setProfile(null);
    setSession(null);
  }, []);

  const applyAvatar = useCallback((avatarPath: string, avatarUrl: string | null) => {
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            avatarPath,
            avatarUrl: avatarUrl
              ? `${avatarUrl}${avatarUrl.includes("?") ? "&" : "?"}t=${Date.now()}`
              : null,
          }
        : prev,
    );
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      authEnabled,
      session,
      profile,
      isAdmin: profile?.role === "admin",
      isVisitor: profile?.role === "visitor",
      signIn,
      signOut,
      applyAvatar,
    }),
    [ready, authEnabled, session, profile, signIn, signOut, applyAvatar],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
