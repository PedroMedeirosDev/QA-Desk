/**
 * Redação de dados sensíveis (BR) em texto livre — espelho do server.
 * Tokens: [CPF] [CNPJ] [TELEFONE] [EMAIL]
 */

const EMAIL_RE =
  /\b[A-Za-z0-9](?:[A-Za-z0-9._%+-]*[A-Za-z0-9])?@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}\b/g;

const CNPJ_FMT_RE = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;

const CPF_FMT_RE = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;

const PHONE_RE =
  /(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?(?:9\s*)?\d{4}[-\s]?\d{4}\b/g;

function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}

function isLikelyCpf(digits: string): boolean {
  return digits.length === 11 && !/^(\d)\1{10}$/.test(digits);
}

function isLikelyCnpj(digits: string): boolean {
  return digits.length === 14 && !/^(\d)\1{13}$/.test(digits);
}

export function redactPii(input: string): string {
  if (!input) return input;

  let out = input.replace(EMAIL_RE, "[EMAIL]");

  out = out.replace(CNPJ_FMT_RE, (match) => {
    const d = onlyDigits(match);
    if (isLikelyCnpj(d)) return "[CNPJ]";
    if (isLikelyCpf(d)) return "[CPF]";
    return match;
  });

  out = out.replace(CPF_FMT_RE, (match) => {
    const d = onlyDigits(match);
    if (d.length === 11 && isLikelyCpf(d)) return "[CPF]";
    if (d.length === 14 && isLikelyCnpj(d)) return "[CNPJ]";
    return match;
  });

  out = out.replace(PHONE_RE, (match) => {
    const d = onlyDigits(match);
    if (d.length >= 10 && d.length <= 13) return "[TELEFONE]";
    return match;
  });

  return out;
}

/** Alias para uso em UI/exports. */
export const maskPii = redactPii;

export function redactPiiDeep<T>(value: T): T {
  if (value == null) return value;
  if (typeof value === "string") return redactPii(value) as T;
  if (Array.isArray(value)) {
    return value.map((item) => redactPiiDeep(item)) as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactPiiDeep(v);
    }
    return out as T;
  }
  return value;
}
