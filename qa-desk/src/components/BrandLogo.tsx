import { cn } from "@/lib/utils";
import { QA_DESK_LOGO_ALT } from "@/config/brand";

type BrandLogoProps = {
  className?: string;
  /** `sidebar` = cabeçalho expandido · `icon` = sidebar recolhida · `xl` = login */
  size?: "icon" | "sm" | "md" | "lg" | "xl" | "sidebar";
  /** Só o monograma Stack, sem tipografia. */
  markOnly?: boolean;
};

const MARK: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  icon: "size-9",
  sm: "size-8",
  md: "size-12",
  lg: "size-14",
  xl: "size-16",
  sidebar: "size-9",
};

const WORDMARK: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  icon: "text-base",
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-3xl",
  xl: "text-4xl",
  sidebar: "text-xl",
};

/** Monograma Stack (sistema + teste + check). */
export function BrandMarkSvg({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <path
        d="M7 21H19C20.1046 21 21 20.1046 21 19V7"
        stroke="currentColor"
        strokeOpacity="0.4"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect
        x="3"
        y="3"
        width="14"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M6 10.5L9 13.5L15 5.5"
        className="stroke-red-600"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Marca oficial QA Desk — Stack SVG + wordmark.
 * Camadas (sistema + ambiente de teste) + check de homologação.
 */
export function BrandLogo({
  className,
  size = "sm",
  markOnly = false,
}: BrandLogoProps) {
  const showWordmark = !markOnly && size !== "icon";

  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center gap-2 text-zinc-900 dark:text-white",
        size === "sidebar" && "w-full",
        className,
      )}
      role="img"
      aria-label={QA_DESK_LOGO_ALT}
    >
      <BrandMarkSvg className={MARK[size]} />

      {showWordmark && (
        <span className={cn("font-bold tracking-tight", WORDMARK[size])}>
          QA
          <span className="ml-0.5 text-red-600">Desk</span>
        </span>
      )}
    </div>
  );
}
