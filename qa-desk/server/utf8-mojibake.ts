/** Detecta UTF-8 interpretado como Latin-1/CP1252 (ex.: conteÃºdo → conteúdo). */
const MOJIBAKE_RE = /Ã.|Â[\u0080-\u00bf]|ðŸ|â€™|â€œ|â€/;

/**
 * Corrige nomes de arquivo / textos gravados com encoding errado (Multer no Windows).
 * Só altera quando há assinatura típica de mojibake — ASCII e UTF-8 correto ficam iguais.
 */
export function fixUtf8Mojibake(text: string): string {
  if (!text || !MOJIBAKE_RE.test(text)) return text;
  try {
    const fixed = Buffer.from(text, "latin1").toString("utf8");
    if (fixed.includes("\uFFFD") && !text.includes("\uFFFD")) return text;
    return fixed;
  } catch {
    return text;
  }
}
