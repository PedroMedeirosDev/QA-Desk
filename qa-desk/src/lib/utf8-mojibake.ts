/** Detecta UTF-8 interpretado como Latin-1/CP1252 (ex.: conteÃºdo → conteúdo). */
const MOJIBAKE_RE = /Ã.|Â[\u0080-\u00bf]|ðŸ|â€™|â€œ|â€/;

/**
 * Corrige nomes de arquivo / textos gravados com encoding errado (Multer no Windows).
 * Versão browser (sem Buffer) — espelha `server/utf8-mojibake.ts`.
 */
export function fixUtf8Mojibake(text: string): string {
  if (!text || !MOJIBAKE_RE.test(text)) return text;
  try {
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) {
      bytes[i] = text.charCodeAt(i) & 0xff;
    }
    const fixed = new TextDecoder("utf-8").decode(bytes);
    if (fixed.includes("\uFFFD") && !text.includes("\uFFFD")) return text;
    return fixed;
  } catch {
    return text;
  }
}
