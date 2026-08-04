import { useMemo, useState, type CSSProperties } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { PremiumTooltip } from "@/components/PremiumTooltip";
import { cn } from "@/lib/utils";
import { getBundledLogoUrl } from "@/config/logos";

const LOGO_EXTENSIONS = ["png", "svg", "webp", "jpg", "jpeg"] as const;

interface ProjectLogoProps {
  logoFile: string;
  label: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  style?: CSSProperties;
}

const sizeClass = {
  sm: "size-8",
  md: "size-10",
  lg: "size-14",
} as const;

const BRAND_SIZE = {
  sm: "sm",
  md: "md",
  lg: "lg",
} as const satisfies Record<
  NonNullable<ProjectLogoProps["size"]>,
  "sm" | "md" | "lg"
>;

function isQaDeskBrand(logoFile: string): boolean {
  const slug = logoFile.replace(/_logo$/, "").toLowerCase();
  return slug === "qa_desk" || slug === "qadesk" || slug === "desk";
}

function logoNameCandidates(logoFile: string): string[] {
  const slug = logoFile.replace(/_logo$/, "");
  return [...new Set([logoFile, slug, `${slug}_logo`])];
}

export function ProjectLogo({ logoFile, label, className, size = "md", style }: ProjectLogoProps) {
  const bundled = getBundledLogoUrl(logoFile);
  const candidates = useMemo(() => logoNameCandidates(logoFile), [logoFile]);
  const [attempt, setAttempt] = useState(0);

  if (isQaDeskBrand(logoFile)) {
    return (
      <PremiumTooltip label={label} side="top">
        <span className={cn("inline-flex", sizeClass[size], className)} style={style}>
          <BrandLogo markOnly size={BRAND_SIZE[size]} className="h-full w-full justify-center" />
        </span>
      </PremiumTooltip>
    );
  }

  if (bundled) {
    return (
      <img
        src={bundled}
        alt={`Logo ${label}`}
        className={cn("shrink-0 rounded-lg object-contain", sizeClass[size], className)}
        style={style}
      />
    );
  }

  const totalAttempts = candidates.length * LOGO_EXTENSIONS.length;
  const failed = attempt >= totalAttempts;

  if (failed) {
    return (
      <PremiumTooltip label={label} side="top">
        <span
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-lg border bg-muted font-semibold uppercase text-muted-foreground",
            sizeClass[size],
            size === "sm" ? "text-xs" : "text-sm",
            className,
          )}
        >
          {label.slice(0, 2)}
        </span>
      </PremiumTooltip>
    );
  }

  const nameIndex = Math.floor(attempt / LOGO_EXTENSIONS.length);
  const extIndex = attempt % LOGO_EXTENSIONS.length;
  const src = `/logos/${candidates[nameIndex]}.${LOGO_EXTENSIONS[extIndex]}`;

  return (
    <img
      src={src}
      alt={`Logo ${label}`}
      className={cn("shrink-0 rounded-lg object-contain", sizeClass[size], className)}
      style={style}
      onError={() => setAttempt((i) => i + 1)}
    />
  );
}
