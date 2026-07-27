import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"] as const;

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function formatTrigger(ymd: string): string {
  return parseYmd(ymd).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type DatePickerProps = {
  value: string;
  onChange: (ymd: string) => void;
  /** YYYY-MM-DD — dias depois disso ficam desabilitados */
  max?: string;
  /** YYYY-MM-DD — dias antes ficam desabilitados */
  min?: string;
  className?: string;
};

export function DatePicker({ value, onChange, max, min, className }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => startOfMonth(parseYmd(value)));
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const maxDate = max ? parseYmd(max) : undefined;
  const minDate = min ? parseYmd(min) : undefined;
  const selected = parseYmd(value);
  const today = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }, []);

  useEffect(() => {
    if (open) setView(startOfMonth(parseYmd(value)));
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const cells = useMemo(() => {
    const first = startOfMonth(view);
    const startPad = first.getDay();
    const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const prevMonthDays = new Date(view.getFullYear(), view.getMonth(), 0).getDate();
    const items: Array<{ date: Date; inMonth: boolean }> = [];

    for (let i = startPad - 1; i >= 0; i -= 1) {
      items.push({
        date: new Date(view.getFullYear(), view.getMonth() - 1, prevMonthDays - i),
        inMonth: false,
      });
    }
    for (let d = 1; d <= daysInMonth; d += 1) {
      items.push({
        date: new Date(view.getFullYear(), view.getMonth(), d),
        inMonth: true,
      });
    }
    while (items.length % 7 !== 0 || items.length < 42) {
      const last = items[items.length - 1].date;
      items.push({
        date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1),
        inMonth: false,
      });
    }
    return items;
  }, [view]);

  function isDisabled(date: Date): boolean {
    if (maxDate && date > maxDate) return true;
    if (minDate && date < minDate) return true;
    return false;
  }

  function pick(date: Date) {
    if (isDisabled(date)) return;
    onChange(toYmd(date));
    setOpen(false);
  }

  function goToday() {
    const t = today;
    if (isDisabled(t)) return;
    onChange(toYmd(t));
    setView(startOfMonth(t));
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={listId}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground shadow-sm transition-colors",
          "hover:border-primary/40 hover:bg-muted/40",
          open && "border-primary/50 ring-2 ring-primary/15",
        )}
      >
        <CalendarDays className="size-3.5 text-primary" />
        <span className="tabular-nums">{formatTrigger(value)}</span>
      </button>

      {open && (
        <div
          id={listId}
          role="dialog"
          aria-label="Escolher data"
          className="absolute right-0 top-[calc(100%+0.4rem)] z-50 w-[17.5rem] overflow-hidden rounded-xl border border-border bg-card p-3 shadow-xl shadow-black/10 dark:shadow-black/40"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Mês anterior"
              onClick={() =>
                setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))
              }
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
            </button>
            <p className="text-sm font-semibold capitalize tracking-tight">
              {monthLabel(view)}
            </p>
            <button
              type="button"
              aria-label="Próximo mês"
              onClick={() =>
                setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))
              }
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {WEEKDAYS.map((d, i) => (
              <span
                key={`${d}-${i}`}
                className="py-1 text-center text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {d}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map(({ date, inMonth }) => {
              const disabled = isDisabled(date);
              const isSelected = sameDay(date, selected);
              const isToday = sameDay(date, today);
              return (
                <button
                  key={toYmd(date)}
                  type="button"
                  disabled={disabled}
                  onClick={() => pick(date)}
                  className={cn(
                    "relative flex h-8 items-center justify-center rounded-lg text-sm tabular-nums transition-colors",
                    !inMonth && "text-muted-foreground/45",
                    inMonth && !isSelected && "text-foreground hover:bg-muted",
                    isToday && !isSelected && "ring-1 ring-inset ring-primary/35",
                    isSelected &&
                      "bg-primary font-semibold text-primary-foreground shadow-sm hover:bg-primary",
                    disabled && "cursor-not-allowed opacity-35 hover:bg-transparent",
                  )}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={goToday}
              disabled={isDisabled(today)}
              className="rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-40"
            >
              Hoje
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
