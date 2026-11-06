/**
 * OCR local (tesseract.js) — o print nunca sai do servidor, e o texto lido passa pelo
 * mesmo filtro de dados sensíveis do resto da demanda.
 */
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { createWorker } from "tesseract.js";

const CONFIANCA_MINIMA = 60;
/** O tesseract baixa o idioma (~15 MB) na primeira leitura; fora da pasta do projeto. */
const CACHE_IDIOMA = path.join(os.tmpdir(), "qa-desk-tesseract");

export function ehImagem(mime: string, nome: string): boolean {
  return /^image\/(png|jpe?g|webp|bmp|gif)$/i.test(mime) || /\.(png|jpe?g|webp|bmp)$/i.test(nome);
}

/** Prints do Discord são pequenos e de tema escuro: ampliar, cinza e inverter dobra a legibilidade. */
async function prepararImagem(buffer: Buffer): Promise<Buffer> {
  const img = sharp(buffer);
  const [meta, stats] = await Promise.all([img.metadata(), img.stats()]);
  const largura = meta.width ?? 0;
  const escuro = (stats.channels[0]?.mean ?? 255) < 128;
  let p = sharp(buffer);
  if (largura > 0 && largura < 1500) p = p.resize({ width: largura * 3, kernel: "lanczos3" });
  p = p.grayscale();
  if (escuro) p = p.negate({ alpha: false });
  return p.normalize().sharpen().png().toBuffer();
}

/** Lê os prints em sequência; devolve só o que tiver confiança suficiente. */
export async function lerTextoDosPrints(imagens: Buffer[]): Promise<string> {
  if (imagens.length === 0) return "";
  const worker = await createWorker("por", undefined, { cachePath: CACHE_IDIOMA });
  try {
    const textos: string[] = [];
    for (const img of imagens) {
      const { data } = await worker.recognize(await prepararImagem(img));
      const texto = data.text.replace(/\n{3,}/g, "\n\n").trim();
      if (texto && data.confidence >= CONFIANCA_MINIMA) textos.push(texto);
    }
    return textos.join("\n\n");
  } finally {
    await worker.terminate();
  }
}
