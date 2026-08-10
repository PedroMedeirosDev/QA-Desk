import { Github, Instagram, Linkedin, Youtube } from "lucide-react";
import { PremiumTooltip } from "@/components/PremiumTooltip";
import { cn } from "@/lib/utils";

export const SOCIAL_LINKS = [
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/pedroo-medeiross/",
    icon: Linkedin,
    className: "social-link social-link-linkedin",
  },
  {
    label: "GitHub",
    href: "https://github.com/PedroMedeirosDev/",
    icon: Github,
    className: "social-link social-link-github",
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/pedroo_medeiross",
    icon: Instagram,
    className: "social-link social-link-instagram",
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/@PedroHenrique-xk1en",
    icon: Youtube,
    className: "social-link social-link-youtube",
  },
] as const;

interface FooterProps {
  className?: string;
  /** Compacto na base da sidebar esquerda do shell logado. */
  variant?: "default" | "sidebar";
}

export function Footer({ className, variant = "default" }: FooterProps) {
  if (variant === "sidebar") {
    return (
      <footer
        className={cn(
          "mt-auto hidden min-w-0 shrink-0 overflow-x-hidden border-t border-white/5 px-3 py-4 md:block",
          className,
        )}
      >
        <p className="text-center text-[0.7rem] leading-snug text-gray-500 [overflow-wrap:anywhere]">
          Desenvolvido por{" "}
          <span className="font-medium text-gray-400">Pedro Medeiros</span>
          {" "}
          — 2026
        </p>
        <nav
          aria-label="Redes sociais"
          className="mt-3 flex flex-wrap items-center justify-center gap-2"
        >
          {SOCIAL_LINKS.map(({ label, href, icon: Icon, className: linkClass }) => (
            <PremiumTooltip key={label} label={label} side="top">
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className={cn(linkClass, "text-gray-500 opacity-70 hover:opacity-100")}
              >
                <Icon className="size-3.5" strokeWidth={1.75} />
              </a>
            </PremiumTooltip>
          ))}
        </nav>
      </footer>
    );
  }

  return (
    <footer
      className={cn(
        "shrink-0 border-t border-border/80 bg-background py-4",
        className,
      )}
    >
      <div className="flex w-full flex-col items-center gap-4 px-4 text-[0.875rem] text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-center sm:text-left">
          Desenvolvido por{" "}
          <span className="font-medium text-gray-300">Pedro Medeiros</span>
          {" "}
          — 2026
        </p>

        <nav aria-label="Redes sociais" className="flex items-center gap-4">
          {SOCIAL_LINKS.map(({ label, href, icon: Icon, className: linkClass }) => (
            <PremiumTooltip key={label} label={label} side="top">
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className={linkClass}
              >
                <Icon className="size-4" strokeWidth={1.75} />
              </a>
            </PremiumTooltip>
          ))}
        </nav>
      </div>
    </footer>
  );
}
