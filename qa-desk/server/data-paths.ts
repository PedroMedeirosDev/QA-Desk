import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Raiz do modo JSON. `QA_DATA_DIR` isola os dados (os testes usam `e2e/.dados`).
 * Lida no carregamento do módulo: precisa vir do ambiente do processo, não do `.env`.
 */
const DATA_DIR = process.env.QA_DATA_DIR?.trim()
  ? path.resolve(process.env.QA_DATA_DIR.trim())
  : path.join(__dirname, "../data");

export const DATA_ROOT = path.join(DATA_DIR, "projects");
export const UPLOADS_ROOT = path.join(DATA_DIR, "uploads");
