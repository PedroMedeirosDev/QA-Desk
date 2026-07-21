/** ~512 KB — cobre CTs longos (responsável + teardown) sem cortar o início. */
export const MAX_MAESTRO_OUTPUT_CHARS = 512_000;

/** Mantém o final do log se estourar o teto (raro). */
export function clipMaestroOutput(text: string, max = MAX_MAESTRO_OUTPUT_CHARS): string {
  if (text.length <= max) return text;
  const kept = text.slice(-max);
  return `[qa-desk] Log truncado no início (${text.length - max} chars omitidos).\n${kept}`;
}

/** Corrige saída do Maestro no Windows (UTF-8 lido como Latin-1 / CP1252). */
export function normalizeMaestroOutput(text: string): string {
  let s = text.replace(/\r\n/g, "\n");

  if (/[\uFFFD]|Ã[£©ªº]|VersÃ|OpÃ|ColÃ|CARDÃ|Ã§|Ã£|Ã¡|Ã©/i.test(s)) {
    try {
      s = Buffer.from(s, "latin1").toString("utf8");
    } catch {
      /* mantém original */
    }
  }

  return s
    .replace(/\uFFFD/g, "")
    .replace(/Opao/gi, "Opção")
    .replace(/Versao:/g, "Versão:")
    .replace(/CARDAPIO/g, "CARDÁPIO")
    .replace(/Colgio/g, "Colégio");
}
