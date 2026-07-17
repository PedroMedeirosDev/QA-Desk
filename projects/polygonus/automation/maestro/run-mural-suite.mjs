import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const envPath = existsSync(join(root, ".env"))
  ? join(root, ".env")
  : join(root, "flows", ".env");

const fileEnv = {};
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i > 0) fileEnv[t.slice(0, i)] = t.slice(i + 1);
}

const flows = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      "flows/mural/01_1_comunicado_enviar.yaml",
      "flows/mural/01_1_comunicado_editar.yaml",
      "flows/mural/01_1_comunicado_excluir.yaml",
      "flows/mural/01_1_comunicado_enquete.yaml",
      "flows/mural/01_1_comunicado_foto_galeria.yaml",
      "flows/mural/01_1_comunicado_pdf.yaml",
      "flows/mural/01_1_comunicado_video_pequeno.yaml",
      "flows/mural/01_1_comunicado_evento.yaml",
      "flows/mural/01_1_filtro_enviadas.yaml",
      "flows/mural/01_1_comunicado_completo_e2e.yaml",
    ];

const quote = (s) => (/[\s"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const results = [];
let combinedOutput = "";

for (const flow of flows) {
  const args = ["test"];
  for (const [k, v] of Object.entries(fileEnv)) {
    if (k && v !== undefined && v !== "") args.push("-e", `${k}=${v}`);
  }
  args.push("--config", join(root, "config.yaml"));
  args.push("--test-output-dir", join(root, ".maestro-output"));
  args.push("--udid", "emulator-5554", flow);

  const runStartedAt = Date.now();
  console.log(`\n========== ${flow} ==========`);
  const cmd = `maestro.bat ${args.map(quote).join(" ")}`;
  const r = spawnSync(cmd, {
    cwd: root,
    shell: true,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  const ok = r.status === 0;
  const cleanupScript = join(root, "scripts/cleanup-test-artifacts.mjs");
  if (existsSync(cleanupScript)) {
    const cleanupArgs = [
      cleanupScript,
      "--post-run",
      ok ? "--ok" : "--fail",
      "--since",
      String(runStartedAt),
      "--quiet",
    ];
    spawnSync(process.execPath, cleanupArgs, { cwd: root, encoding: "utf8" });
  }
  if (r.stdout) {
    process.stdout.write(r.stdout);
    combinedOutput += r.stdout;
  }
  if (r.stderr) {
    process.stderr.write(r.stderr);
    combinedOutput += r.stderr;
  }
  results.push({ flow, ok, code: r.status });
  console.log(ok ? ">>> PASS" : `>>> FAIL code=${r.status}`);
}

console.log("\n=== RESUMO ===");
for (const x of results) console.log(`${x.ok ? "PASS" : "FAIL"}  ${x.flow}`);

const fullLog =
  combinedOutput +
  "\n" +
  results.map((x) => `${x.ok ? "PASS" : "FAIL"}  ${x.flow}`).join("\n");
const logPath = join(root, ".maestro-analysis", "suite-last.log");
mkdirSync(join(root, ".maestro-analysis"), { recursive: true });
writeFileSync(logPath, fullLog, "utf8");

const analyzeScript = join(root, "analyze-maestro-run.mjs");
if (existsSync(analyzeScript)) {
  const analyzeArgs = ["--log", logPath, "--quiet"];
  const webhook = process.env.N8N_WEBHOOK_URL || process.env.QA_N8N_WEBHOOK_URL;
  if (webhook) analyzeArgs.push("--webhook", webhook);
  const a = spawnSync(process.execPath, [analyzeScript, ...analyzeArgs], {
    cwd: root,
    encoding: "utf8",
  });
  if (a.stdout) console.log("\n=== ANÁLISE ===\n" + a.stdout);
}

const cleanupScript = join(root, "scripts/cleanup-test-artifacts.mjs");
if (existsSync(cleanupScript)) {
  spawnSync(process.execPath, [cleanupScript, "--prune-days", "14", "--quiet"], {
    cwd: root,
    encoding: "utf8",
  });
}

process.exit(results.some((x) => !x.ok) ? 1 : 0);
