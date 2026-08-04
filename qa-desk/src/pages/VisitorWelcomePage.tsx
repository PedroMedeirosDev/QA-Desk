import { Construction, Sparkles } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

/** Tela única do perfil visitante enquanto o portfólio público não está pronto. */
export function VisitorWelcomePage() {
  return (
    <div className="relative flex min-h-[min(28rem,70dvh)] flex-col items-center justify-center px-[1rem] py-[2.5rem] text-center">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-40"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 60% 45% at 50% 35%, color-mix(in srgb, var(--primary) 12%, transparent), transparent 70%)",
        }}
      />

      <div className="animate-fade-in-up flex max-w-[28rem] flex-col items-center gap-[1.25rem] opacity-0">
        <BrandLogo size="lg" className="text-[var(--foreground)]" />

        <div className="inline-flex items-center gap-[0.5rem] rounded-full border border-[var(--project-highlight-border)] bg-[var(--project-highlight-bg)] px-[0.75rem] py-[0.25rem] text-[0.75rem] font-medium text-[var(--project-highlight-text)] transition-colors">
          <Construction className="size-[0.875rem] shrink-0" strokeWidth={2} />
          Perfil em configuração
        </div>

        <div className="space-y-[0.5rem]">
          <h2 className="text-[1.5rem] font-semibold tracking-tight text-[var(--foreground)] sm:text-[1.875rem]">
            Bem-vindo ao QA Desk
          </h2>
          <p className="text-[0.875rem] leading-relaxed text-[var(--muted-foreground)] sm:text-[0.9375rem]">
            O acesso de visitante ainda está sendo preparado. Em breve você verá
            uma seleção pública de cases, métricas e curadoria — por enquanto
            esta área permanece fechada.
          </p>
        </div>

        <p className="flex items-center gap-[0.375rem] text-[0.75rem] text-[var(--muted-foreground)]/80">
          <Sparkles className="size-[0.875rem] shrink-0 text-[var(--primary)]/80" strokeWidth={2} />
          Obrigado pela visita — volte em breve.
        </p>
      </div>
    </div>
  );
}
