import { useAuth } from "@/auth/AuthProvider";

/** Aviso no acesso visitante enquanto o portfólio público ainda não tem conteúdo marcado. */
export function VisitorPortfolioBanner() {
  const { isVisitor } = useAuth();
  if (!isVisitor) return null;

  return (
    <div
      className="mb-4 rounded-lg border border-amber-500/40 bg-amber-950/40 px-4 py-3 text-sm text-amber-100"
      role="status"
    >
      <p className="font-medium text-amber-200">Portfólio em construção</p>
      <p className="mt-1 text-amber-100/80">
        O login de visitante ainda não exibe casos, métricas nem curadoria. Em breve haverá
        uma seleção pública; por enquanto use a conta admin para ver o conteúdo completo.
      </p>
    </div>
  );
}
