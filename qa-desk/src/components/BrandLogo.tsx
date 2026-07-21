import { cn } from "@/lib/utils";
import { QA_DESK_LOGO_ALT, QA_DESK_LOGO_SRC } from "@/config/brand";

type BrandLogoProps = {
  className?: string;
  /** `sidebar` = cabeçalho expandido · `icon` = sidebar recolhida · `xl` = login */
  size?: "icon" | "sm" | "md" | "lg" | "xl" | "sidebar";
};

const SIZE: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  icon: "h-11 w-11",
  sm: "h-9 w-9",
  md: "h-16 w-16",
  lg: "h-28 w-28",
  xl: "h-40 w-auto max-w-[18rem] sm:h-44",
  /** Cabeçalho da sidebar — logo horizontal já cortada (ícone + QA DESK) */
  sidebar: "h-14 w-full max-w-none object-contain object-left",
};

/** Logo da marca QA Desk (não confundir com logos de projetos). */
export function BrandLogo({ className, size = "sm" }: BrandLogoProps) {
  return (
    <img
      src={QA_DESK_LOGO_SRC}
      alt={QA_DESK_LOGO_ALT}
      className={cn("shrink-0 object-contain", SIZE[size], className)}
      draggable={false}
    />
  );
}
