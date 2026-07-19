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
