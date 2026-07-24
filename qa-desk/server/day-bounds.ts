/** Fuso do QA Desk (Brasil sem horário de verão desde 2019 → UTC−3 fixo). */
export const QA_DESK_TZ = "America/Sao_Paulo" as const;

/** YYYY-MM-DD no fuso America/Sao_Paulo. */
export function todaySaoPaulo(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: QA_DESK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isValidDateYmd(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/** Início/fim do dia civil em America/Sao_Paulo. */
export function dayBoundsSaoPaulo(dateYmd: string): { start: Date; end: Date } {
  return {
    start: new Date(`${dateYmd}T00:00:00.000-03:00`),
    end: new Date(`${dateYmd}T23:59:59.999-03:00`),
  };
}

export function isInstantInSaoPauloDay(isoOrDate: string | Date, dateYmd: string): boolean {
  const t = typeof isoOrDate === "string" ? new Date(isoOrDate).getTime() : isoOrDate.getTime();
  if (Number.isNaN(t)) return false;
  const { start, end } = dayBoundsSaoPaulo(dateYmd);
  return t >= start.getTime() && t <= end.getTime();
}
