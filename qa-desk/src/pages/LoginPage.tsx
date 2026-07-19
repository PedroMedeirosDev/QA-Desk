import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { Footer } from "@/components/Footer";
import { ThemeToggle } from "@/components/ThemeToggle";

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
      <div className="flex min-h-dvh flex-col bg-background">
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Carregando…
        </div>
        <Footer />
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
    <div className="relative flex min-h-dvh flex-col bg-background">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">QA Desk</p>
          <h1 className="mt-1 text-xl font-semibold text-foreground">Entrar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Admin ou visitante (portfólio curado).
          </p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">E-mail</span>
              <input
                type="email"
                autoComplete="username"
                required
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Senha</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            {error && (
              <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-60"
            >
              {submitting ? "Entrando…" : "Entrar"}
            </button>
          </form>
        </div>
      </div>
      <Footer />
    </div>
  );
}
