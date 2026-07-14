import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const jsonPath = path.join(root, "data", "sentry_correcoes_suporte.json");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.split("=");
    return [k.replace(/^--/, ""), v ?? true];
  }),
);
const versaoFiltro = args.versao || "";
let outPath = path.join(root, "data", "sentry_correcoes_suporte_copilot.csv");
if (args.saida) outPath = path.isAbsolute(args.saida) ? args.saida : path.join(root, args.saida);

function esc(s) {
  s = String(s ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Link para busca de issues no Sentry (projeto polygonus-flutter). */
function linkSentryIssue(meta, query) {
  const q = (query || "").trim();
  if (!q) return "";
  const enc = encodeURIComponent(q);
  const tpl = meta?.sentry_issues_url_template;
  if (tpl && tpl.includes("{query}")) return tpl.replace("{query}", enc);
  return `https://sentry.io/organizations/polygonus/issues/?project=4511175512883200&query=${enc}`;
}

const j = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const meta = j.meta || {};
let rows = j.correcoes;
if (versaoFiltro) {
  rows = rows.filter((e) => (e.versao_correcao || "") === versaoFiltro);
}

/** Cabeçalhos em português — primeira linha do CSV para planilha única (Sheets/Docs). */
const headerPt = [
  "Versão (correção)",
  "ID triagem",
  "Data registro",
  "Título do erro",
  "Descrição para suporte (linguagem simples)",
  "Detalhes técnicos (código, arquivos, causa)",
  "Query Sentry (busca em issues)",
  "Event IDs Sentry (exemplos)",
  "Link Sentry (abrir busca)",
];

const lines = [headerPt.map(esc).join(",")];

for (const e of rows) {
  const ev = Array.isArray(e.sentry_event_ids) ? e.sentry_event_ids.join("; ") : "";
  const q = e.sentry_issue_query || "";
  lines.push(
    [
      e.versao_correcao,
      e.id,
      e.data,
      e.titulo,
      e.texto_suporte,
      e.fix_tecnico,
      q,
      ev,
      linkSentryIssue(meta, q),
    ]
      .map(esc)
      .join(","),
  );
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
const body = lines.join("\n");
// BOM UTF-8: Excel no Windows reconhece acentos ao abrir o CSV.
const out = "\uFEFF" + body;
fs.writeFileSync(outPath, out, "utf8");
console.log("Wrote", outPath, "rows", rows.length, versaoFiltro ? `(versao=${versaoFiltro})` : "");
