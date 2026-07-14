import { Github, Instagram, Linkedin, Youtube } from "lucide-react";
import { cn } from "@/lib/utils";

const SOCIAL_LINKS = [
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/pedromedeiros",
    icon: Linkedin,
    className: "social-link social-link-linkedin",
  },
  {
    label: "GitHub",
    href: "https://github.com/pedromedeiros",
    icon: Github,
    className: "social-link social-link-github",
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/pedromedeiros",
    icon: Instagram,
    className: "social-link social-link-instagram",
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/@pedromedeiros",
    icon: Youtube,
    className: "social-link social-link-youtube",
  },
] as const;

interface FooterProps {
  className?: string;
}

export function Footer({ className }: FooterProps) {
  return (
    <footer
      className={cn(
        "shrink-0 border-t border-border/80 bg-background py-4",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-4 px-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-center sm:text-left">
          Desenvolvido por{" "}
          <span className="font-medium text-foreground/90">Pedro Medeiros</span>
          {" "}
          — 2026
        </p>

        <nav aria-label="Redes sociais" className="flex items-center gap-4">
          {SOCIAL_LINKS.map(({ label, href, icon: Icon, className: linkClass }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              title={label}
              className={linkClass}
            >
              <Icon className="size-4" strokeWidth={1.75} />
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
