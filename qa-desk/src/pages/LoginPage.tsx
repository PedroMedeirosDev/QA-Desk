import { useState, type FormEvent } from "react";
import { Eye } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { BrandLogo } from "@/components/BrandLogo";
import { SOCIAL_LINKS } from "@/components/Footer";
import { PremiumTooltip } from "@/components/PremiumTooltip";
import { cn } from "@/lib/utils";

const INPUT_CLASS =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition-all placeholder:text-zinc-500 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/30";

const SHELL_CLASS =
  "login-surface relative flex h-dvh min-h-0 flex-col overflow-hidden bg-[#0a0a0a]";

const VISITOR_EMAIL =
  (import.meta.env.VITE_VISITOR_EMAIL as string | undefined)?.trim() ||
  "visitante@qa-desk.local";
const VISITOR_PASSWORD = (
  import.meta.env.VITE_VISITOR_PASSWORD as string | undefined
)?.trim();

function Spotlight() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_40%,rgba(43,115,235,0.16)_0%,rgba(10,10,10,0.85)_50%,#0a0a0a_100%)]"
    />
  );
}

export function LoginPage() {
  const { ready, authEnabled, session, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/projects/polygonus/app";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [visitorSubmitting, setVisitorSubmitting] = useState(false);

  if (!ready) {
    return (
      <div className={SHELL_CLASS}>
        <Spotlight />
        <div className="flex flex-1 items-center justify-center text-sm text-zinc-400">
          Carregando…
        </div>
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

  async function onVisitorClick() {
    setError(null);
    if (!VISITOR_PASSWORD) {
      setError(
        "Login visitante não configurado (falta VITE_VISITOR_PASSWORD no .env).",
      );
      return;
    }
    setVisitorSubmitting(true);
    try {
      await signIn(VISITOR_EMAIL, VISITOR_PASSWORD);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no login visitante");
    } finally {
      setVisitorSubmitting(false);
    }
  }

  return (
    <div className={SHELL_CLASS}>
      <Spotlight />

      <div className="relative z-0 flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-6 sm:px-6">
        <div
          className={cn(
            "animate-fade-in-up grid w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 shadow-2xl opacity-0",
            "bg-black/40 backdrop-blur-xl",
            "md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]",
          )}
        >
          {/* Painel da marca */}
          <aside
            className={cn(
              "relative flex flex-col justify-between gap-8 overflow-hidden px-6 py-7 sm:px-8 sm:py-8",
              "bg-linear-to-br from-[#1c1c1c] to-[#0a0a0a]",
              "border-b border-white/10 md:border-b-0 md:border-r",
            )}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -top-32 -left-32 size-96 rounded-full bg-red-600/10 blur-[100px]"
            />

            <div className="relative">
              <BrandLogo size="lg" className="text-white" />
              <h1 className="mt-6 text-xl font-semibold tracking-tight text-white sm:text-2xl">
                Homologação e testes
              </h1>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-gray-400">
                Portfólio QA — cases, curadoria KB e automação em um só lugar.
              </p>
              <p className="mt-4 inline-block w-fit rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-[0.875rem] text-gray-400">
                Perfil visitante em configuração — em breve.
              </p>
            </div>

            <nav
              aria-label="Redes sociais"
              className="relative flex items-center gap-6"
            >
              {SOCIAL_LINKS.map(({ label, href, icon: Icon, className }) => (
                <PremiumTooltip key={label} label={label} side="top">
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className={cn(
                      "text-gray-500 transition-all duration-300 hover:-translate-y-1",
                      className,
                    )}
                  >
                    <Icon className="size-6" strokeWidth={1.75} />
                  </a>
                </PremiumTooltip>
              ))}
            </nav>
          </aside>

          {/* Formulário */}
          <section className="flex flex-col justify-center px-6 py-7 sm:px-8 sm:py-8">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                Bem-vindo
              </h2>
              <p className="mt-1 text-sm text-zinc-500">Acesse o QA Desk</p>
            </div>

            <form className="mt-6 space-y-3.5" onSubmit={onSubmit}>
              <label className="block space-y-1 text-left">
                <span className="text-[0.8125rem] font-medium text-zinc-400">E-mail</span>
                <input
                  type="email"
                  autoComplete="username"
                  required
                  className={INPUT_CLASS}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="block space-y-1 text-left">
                <span className="text-[0.8125rem] font-medium text-zinc-400">Senha</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  className={INPUT_CLASS}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>

              {error && (
                <p className="rounded-lg border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-400">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || visitorSubmitting}
                className="w-full rounded-lg bg-white py-2.5 text-sm font-semibold text-black transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Entrando…" : "Entrar"}
              </button>
            </form>

            <div className="my-4 flex items-center gap-3 text-[0.75rem] text-zinc-600">
              <span className="h-px flex-1 bg-white/10" />
              ou
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <button
              type="button"
              onClick={() => void onVisitorClick()}
              disabled={submitting || visitorSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-transparent py-2.5 text-sm font-medium text-gray-400 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Eye className="size-3.5 shrink-0 opacity-80" strokeWidth={1.75} />
              {visitorSubmitting ? "Entrando…" : "Acessar como visitante"}
            </button>
          </section>
        </div>

        <p
          className="animate-fade-in-up mt-5 text-center text-[0.75rem] text-gray-500"
          style={{ animationDelay: "0.2s", opacity: 0 }}
        >
          Desenvolvido por{" "}
          <span className="font-medium text-gray-400">Pedro Medeiros</span>
          {" "}
          — 2026
        </p>
      </div>
    </div>
  );
}
