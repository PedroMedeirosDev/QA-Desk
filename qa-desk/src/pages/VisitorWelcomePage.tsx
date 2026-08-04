import { Construction, Sparkles } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

/** Tela única do perfil visitante enquanto o portfólio público não está pronto. */
export function VisitorWelcomePage() {
  return (
    <div className="flex min-h-[min(28rem,70dvh)] flex-col items-center justify-center px-4 py-10 text-center">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-40"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 60% 45% at 50% 35%, rgba(220,38,38,0.12), transparent 70%)",
        }}
      />

      <div className="animate-fade-in-up flex max-w-md flex-col items-center gap-5 opacity-0">
        <BrandLogo size="lg" className="text-foreground" />

        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200">
          <Construction className="size-3.5 shrink-0" strokeWidth={2} />
          Perfil em configuração
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Bem-vindo ao QA Desk
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
            O acesso de visitante ainda está sendo preparado. Em breve você verá
            uma seleção pública de cases, métricas e curadoria — por enquanto
            esta área permanece fechada.
          </p>
        </div>

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground/80">
          <Sparkles className="size-3.5 shrink-0 text-red-500/80" strokeWidth={2} />
          Obrigado pela visita — volte em breve.
        </p>
      </div>
    </div>
  );
}
