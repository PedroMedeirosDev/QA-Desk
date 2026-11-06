/**
 * Importa o relatório JSON do Playwright (execução pela linha de comando) para o
 * histórico de execuções do QA Desk (test_runs).
 *
 *   npx tsx scripts/importar-playwright.ts --arquivo <ultima-execucao.json> \
 *     [--projeto polygonus] [--canal app] [--versao 6.07.28] [--apelidos apelidos.json] [--simular]
 *
 * O resultado é ligado ao caso de teste pelo código no início do título
 * ("CT-ROTINA-03 WEB: …" → ROTINA-03). Apelidos: { "CT-MURAL-14": "BOLETO-02" }.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const { loadEnv } = await import("../server/load-env.js");
loadEnv();
const { readCatalog } = await import("../server/storage.js");
const { recordTestRun } = await import("../server/db/test-runs.js");
const { isDatabaseEnabled } = await import("../server/db/config.js");

type Resultado = {
  status: "passed" | "failed" | "timedOut" | "skipped" | "interrupted";
  duration: number;
  startTime: string;
  retry: number;
  error?: { message?: string };
  attachments?: Array<{ name: string; path?: string; contentType: string }>;
};
type Spec = { title: string; file: string; tests: Array<{ projectName?: string; results: Resultado[] }> };
type Suite = { title: string; file?: string; specs?: Spec[]; suites?: Suite[] };
type Relatorio = { suites: Suite[] };

function arg(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export function codigoDoTitulo(titulo: string): string | null {
  const m = titulo.trim().match(/^([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)\b/);
  return m ? m[1] : null;
}

export function semAnsi(texto: string): string {
  // eslint-disable-next-line no-control-regex
  return texto.replace(/\u001b\[[0-9;]*m/g, "");
}

function* specsDe(suites: Suite[]): Generator<Spec> {
  for (const s of suites) {
    for (const spec of s.specs ?? []) yield spec;
    yield* specsDe(s.suites ?? []);
  }
}

// O npm do PowerShell descarta as flags depois de "--": aceita o caminho solto também.
const arquivo =
  arg("arquivo") ?? process.argv.slice(2).find((a) => a.endsWith(".json") && a !== arg("apelidos"));
if (!arquivo || !fs.existsSync(arquivo)) {
  console.error("Informe --arquivo com o JSON do Playwright (ex.: resultados/ultima-execucao.json).");
  process.exit(1);
}
const projeto = (arg("projeto") ?? "polygonus") as "polygonus";
const canal = arg("canal") ?? "app";
const versao = arg("versao");
const simular = process.argv.includes("--simular");
const apelidos: Record<string, string> = arg("apelidos")
  ? JSON.parse(fs.readFileSync(arg("apelidos")!, "utf8"))
  : {};

if (!isDatabaseEnabled() && !simular) {
  console.error("Sem DATABASE_URL: o histórico só é gravado no Postgres. Use --simular para só conferir.");
  process.exit(1);
}

const catalogo = await readCatalog(projeto);
const porCodigo = new Map<string, { id: string; title: string }>();
for (const r of catalogo.reports) {
  if (r.recordType === "bug" || (r.channel ?? "app") !== canal) continue;
  const c = codigoDoTitulo(r.title);
  if (c && !porCodigo.has(c)) porCodigo.set(c, { id: r.id, title: r.title });
}

const relatorio = JSON.parse(fs.readFileSync(arquivo, "utf8")) as Relatorio;
let gravados = 0;
const semCaso: string[] = [];
const contagem = { success: 0, failed: 0 };
/** Grupo = código sem número e sem "CT-" (CT-ROTINA-03 → ROTINA). */
const porGrupo = new Map<string, { ok: number; total: number }>();
function contarGrupo(titulo: string, passou: boolean) {
  const g = (codigoDoTitulo(titulo) ?? "OUTROS").replace(/^CT-/, "").replace(/-\d+[A-Z]?$/, "");
  const acc = porGrupo.get(g) ?? { ok: 0, total: 0 };
  acc.total += 1;
  if (passou) acc.ok += 1;
  porGrupo.set(g, acc);
}

for (const spec of specsDe(relatorio.suites)) {
  const codigoBruto = codigoDoTitulo(spec.title);
  const codigo = codigoBruto ? apelidos[codigoBruto] ?? codigoBruto : null;
  const caso = codigo ? porCodigo.get(codigo) ?? porCodigo.get(codigo.replace(/^CT-/, "")) : undefined;
  if (!caso) {
    semCaso.push(spec.title);
    continue;
  }
  for (const teste of spec.tests) {
    for (const r of teste.results) {
      if (r.status === "skipped") continue;
      const status = r.status === "passed" ? "success" : "failed";
      contagem[status] += 1;
      contarGrupo(spec.title, status === "success");
      const runId = `pw-${createHash("sha1").update(`${spec.file}|${spec.title}|${r.startTime}|${r.retry}`).digest("hex").slice(0, 20)}`;
      const erro = r.error?.message ? semAnsi(r.error.message).split("\n").find((l) => l.trim()) ?? "" : "";
      const fim = new Date(new Date(r.startTime).getTime() + r.duration).toISOString();
      const evidencias = (r.attachments ?? []).map((a) => a.path).filter((p): p is string => Boolean(p));
      if (!simular) {
        await recordTestRun({
          project: projeto,
          testId: caso.id,
          runId,
          status,
          flowPath: spec.file.replace(/\\/g, "/"),
          output: erro || undefined,
          appVersion: versao,
          startedAt: r.startTime,
          finishedAt: fim,
          meta: {
            fonte: "playwright-cli",
            titulo: spec.title,
            duracaoMs: r.duration,
            tentativa: r.retry,
            statusPlaywright: r.status,
            relatorio: path.resolve(arquivo),
          },
          evidencePaths: evidencias,
        });
      }
      gravados += 1;
    }
  }
}

console.log(`${simular ? "[simulação] " : ""}execuções ${gravados} (passou ${contagem.success} · falhou ${contagem.failed})`);
if (semCaso.length) {
  console.log(`sem caso no QA Desk (${semCaso.length}) — crie o caso ou um apelido:`);
  for (const t of semCaso) console.log(`  - ${t}`);
}

if (!simular && gravados > 0) {
  const { avisarSlack } = await import("../server/slack-bot.js");
  const grupos = [...porGrupo.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([g, v]) => `${v.ok === v.total ? "✅" : "❌"} ${g} ${v.ok}/${v.total}`);
  const texto = [
    `Suíte web importada${versao ? ` · v${versao}` : ""}: ${contagem.success} passaram · ${contagem.failed} falharam`,
    grupos.join("  ·  "),
    semCaso.length ? `${semCaso.length} sem caso no QA Desk` : "",
  ]
    .filter(Boolean)
    .join("\n");
  if (await avisarSlack(texto)) console.log("aviso enviado ao Slack (#avisos)");
}
process.exit(0);
