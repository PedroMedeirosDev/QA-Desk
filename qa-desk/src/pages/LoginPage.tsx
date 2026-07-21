import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { BrandLogo } from "@/components/BrandLogo";
import { Footer } from "@/components/Footer";

export function LoginPage() {
  const { ready, authEnabled, session, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/projects/polygonus/app";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!ready) {
    return (
      <div className="login-surface flex min-h-dvh flex-col">
        <div className="flex flex-1 items-center justify-center text-sm text-zinc-400">
          Carregando…
        </div>
        <Footer className="login-footer border-zinc-800/80 bg-transparent" />
      </div>
    );
  }

  if (!authEnabled || session) {
    return <Navigate to={from} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no login");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-surface relative flex min-h-dvh flex-col">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="login-card w-full max-w-md rounded-2xl border border-red-600/35 bg-zinc-950/90 p-8 backdrop-blur-sm">
          <div className="flex flex-col items-center text-center">
            <BrandLogo size="xl" className="mb-5 drop-shadow-[0_0_28px_rgba(220,38,38,0.25)]" />
            <h1 className="text-2xl font-semibold tracking-tight text-white">Entrar</h1>
            <p className="mt-1.5 max-w-xs text-sm text-zinc-500">
              Acesso admin ou visitante (portfólio).
            </p>
          </div>

          <form className="mt-8 space-y-4" onSubmit={onSubmit}>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-400">E-mail</span>
              <input
                type="email"
                autoComplete="username"
                required
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 p-3 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-400">Senha</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 p-3 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            {error && (
              <p className="rounded-md border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md border-2 border-red-600 bg-transparent px-3 py-3 text-sm font-semibold text-red-500 transition-all duration-300 hover:bg-red-600 hover:text-white hover:shadow-[0_0_20px_rgba(220,38,38,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Entrando…" : "Entrar"}
            </button>
          </form>
        </div>
      </div>
      <Footer className="login-footer border-zinc-800/80 bg-transparent" />
    </div>
  );
}
