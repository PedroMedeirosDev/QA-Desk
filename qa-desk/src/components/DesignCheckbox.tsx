import type { InputHTMLAttributes, ReactNode } from "react";
import { focusRingClass } from "@/lib/button-styles";
import { cn } from "@/lib/utils";

export { focusRingClass };

/** Checkbox do design system — sem aparência nativa do SO. */
export function DesignCheckbox({
  label,
  description,
  className,
  labelClassName,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: ReactNode;
  description?: ReactNode;
  labelClassName?: string;
}) {
  const control = (
    <div className="relative flex shrink-0 items-center justify-center">
      <input
        type="checkbox"
        className={cn(
          "peer h-[1.125rem] w-[1.125rem] cursor-pointer appearance-none rounded-[0.25rem] border border-[var(--border)] bg-[var(--background)] transition-all duration-200 outline-none",
          "checked:border-[var(--project-highlight-border)] checked:bg-[var(--project-highlight-bg)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
        {...props}
      />
      <svg
        className="pointer-events-none absolute h-[0.75rem] w-[0.75rem] text-[var(--project-highlight-text)] opacity-0 transition-opacity duration-200 peer-checked:opacity-100"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
  );

  if (label == null && description == null) {
    return <div className={cn("inline-flex", className)}>{control}</div>;
  }

  return (
    <label
      className={cn(
        "group flex cursor-pointer gap-[0.5rem]",
        description ? "items-start" : "items-center",
        props.disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <div className={cn(description && "mt-[0.125rem]")}>{control}</div>
      <span className="min-w-0">
        {label != null && (
          <span
            className={cn(
              "block text-[0.875rem] text-[var(--muted-foreground)] transition-colors select-none group-hover:text-[var(--foreground)]",
              labelClassName,
            )}
          >
            {label}
          </span>
        )}
        {description != null && (
          <span className="mt-[0.125rem] block text-[0.75rem] leading-snug text-[var(--muted-foreground)] select-none">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}
