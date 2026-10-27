// ESLint com catraca de avisos (npm run lint:ci).
// - erro: reprova, como o `eslint .`;
// - aviso: vira anotação na linha do PR e entra no resumo da execução;
// - mais avisos que o limite em eslint-limite.json: reprova;
// - menos avisos: pede para baixar o limite, para a catraca não voltar atrás.
import { ESLint } from "eslint";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const LIMITE_ARQ = "eslint-limite.json";
const limite = JSON.parse(fs.readFileSync(LIMITE_ARQ, "utf8")).avisos;
const noCI = process.env.GITHUB_ACTIONS === "true";
// As anotações do GitHub usam caminho a partir da raiz do repositório.
const prefixoRepo = noCI ? path.relative(process.env.GITHUB_WORKSPACE ?? process.cwd(), process.cwd()) : "";

const eslint = new ESLint();
const resultados = await eslint.lintFiles(["."]);

const avisos = [];
let erros = 0;
for (const r of resultados) {
  const arq = path.relative(process.cwd(), r.filePath).replaceAll("\\", "/");
  for (const m of r.messages) {
    if (m.severity === 2) erros++;
    if (m.severity !== 1) continue;
    avisos.push({ arq, linha: m.line, coluna: m.column, regra: m.ruleId ?? "?", texto: m.message });
  }
}

const formatter = await eslint.loadFormatter("stylish");
const saida = await formatter.format(resultados);
if (saida) console.log(saida);

if (noCI) {
  for (const a of avisos) {
    const arquivo = prefixoRepo ? `${prefixoRepo}/${a.arq}` : a.arq;
    const msg = a.texto.replace(/\r?\n/g, " ");
    console.log(`::warning file=${arquivo},line=${a.linha},col=${a.coluna},title=${a.regra}::${msg}`);
  }
}

const linhas = [
  "## ESLint",
  "",
  `| Erros | Avisos | Limite |`,
  `|---|---|---|`,
  `| ${erros} | ${avisos.length} | ${limite} |`,
  "",
];
if (avisos.length) {
  linhas.push("| Arquivo | Linha | Regra |", "|---|---|---|");
  for (const a of avisos) linhas.push(`| \`${a.arq}\` | ${a.linha} | \`${a.regra}\` |`);
  linhas.push("");
}
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${linhas.join("\n")}\n`);
}

if (erros > 0) {
  console.error(`ESLint: ${erros} erro(s).`);
  process.exit(1);
}
if (avisos.length > limite) {
  const msg = `Avisos do ESLint subiram de ${limite} para ${avisos.length}. Corrija os novos (veja as anotações no PR).`;
  console.error(noCI ? `::error title=Catraca do ESLint::${msg}` : msg);
  process.exit(1);
}
if (avisos.length < limite) {
  const msg = `Avisos do ESLint caíram de ${limite} para ${avisos.length}: baixe "avisos" em ${LIMITE_ARQ} para ${avisos.length}.`;
  console.log(noCI ? `::notice title=Catraca do ESLint::${msg}` : msg);
}
console.log(`ESLint: ${erros} erro(s), ${avisos.length} aviso(s), limite ${limite}.`);
