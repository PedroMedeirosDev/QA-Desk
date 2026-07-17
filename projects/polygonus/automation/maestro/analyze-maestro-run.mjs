#!/usr/bin/env node
/**
 * Analisa saída Maestro / JSON de run e gera métricas + alertas heurísticos.
 * Opcional: POST para webhook N8N (N8N_WEBHOOK_URL ou QA_N8N_WEBHOOK_URL).
 *
 * Uso:
 *   node analyze-maestro-run.mjs --log maestro.log
 *   node analyze-maestro-run.mjs --text "$(Get-Content run.txt -Raw)"
 *   cat run.txt | node analyze-maestro-run.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, ".maestro-analysis");

function readInput(flags) {
  if (flags.log) return fs.readFileSync(flags.log, "utf8");
  if (flags.text) return flags.text;
  if (!process.stdin.isTTY) {
    return fs.readFileSync(0, "utf8");
  }
  return "";
}

function parseFlags(argv) {
  const flags = { log: "", text: "", webhook: "", quiet: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--log" && argv[i + 1]) flags.log = argv[++i];
    else if (a === "--text" && argv[i + 1]) flags.text = argv[++i];
    else if (a === "--webhook" && argv[i + 1]) flags.webhook = argv[++i];
    else if (a === "--quiet") flags.quiet = true;
  }
  return flags;
}

function analyze(text, meta = {}) {
  const lines = text.split(/\r?\n/);
  const steps = [];
  let optionalFails = 0;
  let warnCount = 0;
  let loginCount = 0;
  let logoutCount = 0;

  for (const line of lines) {
    const m = line.match(/^\s*(.+?)\s+\.{3}\s+(COMPLETED|FAILED|WARNED|SKIPPED)\s*$/i);
    if (m) {
      const [, label, status] = m;
      steps.push({ label: label.trim(), status: status.toUpperCase() });
      if (status.toUpperCase() === "WARNED") warnCount++;
      if (/optional/i.test(label) && status.toUpperCase() === "FAILED") optionalFails++;
    }
    if (/login|ENTRAR|ensure_login/i.test(line)) loginCount++;
    if (/logout|ensure_logged_out/i.test(line)) logoutCount++;
  }

  const failed = steps.filter((s) => s.status === "FAILED");
  const completed = steps.filter((s) => s.status === "COMPLETED");
  const alerts = [];

  if (optionalFails > 2) {
    alerts.push({
      level: "warn",
      code: "optional_tap_noise",
      message: `${optionalFails} tap(s) optional falharam — revisar seletor ou remover optional.`,
    });
  }
  if (loginCount > 3) {
    alerts.push({
      level: "info",
      code: "heavy_auth",
      message: "Muitas referências a login no log — considere resume_phjesus_coordenador.",
    });
  }
  if (logoutCount > 1) {
    alerts.push({
      level: "warn",
      code: "multi_logout",
      message: "Múltiplos logouts — batch longo pode deixar app instável.",
    });
  }
  if (failed.length) {
    alerts.push({
      level: "error",
      code: "step_failed",
      message: `Falhou em: ${failed[failed.length - 1].label}`,
    });
  }
  if (/Element not found/i.test(text)) {
    alerts.push({
      level: "error",
      code: "element_not_found",
      message: "Element not found — conferir MAPA_SELETORES_APP / dump UI.",
    });
  }
  if (/undefined\|/i.test(text) || /\$\{NOME_PHJESUS\}/.test(text)) {
    alerts.push({
      level: "warn",
      code: "env_undefined",
      message: "Variável .env ausente (ex.: NOME_PHJESUS) — revisar flows/.env.",
    });
  }

  return {
    analyzedAt: new Date().toISOString(),
    ok: failed.length === 0 && !/>>> FAIL/i.test(text),
    meta,
    counts: {
      steps: steps.length,
      completed: completed.length,
      failed: failed.length,
      warned: warnCount,
      optionalFails,
    },
    alerts,
    lastSteps: steps.slice(-12),
  };
}

async function postWebhook(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`N8N webhook ${res.status}: ${await res.text()}`);
}

async function main() {
  const flags = parseFlags(process.argv);
  const text = readInput(flags);
  if (!text.trim()) {
    console.error("Uso: node analyze-maestro-run.mjs --log <arquivo> | --text <string>");
    process.exit(1);
  }

  const report = analyze(text, {
    flow: flags.log ? path.basename(flags.log) : undefined,
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, "latest.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  const webhook =
    flags.webhook ||
    process.env.N8N_WEBHOOK_URL ||
    process.env.QA_N8N_WEBHOOK_URL ||
    "";

  if (webhook) {
    try {
      await postWebhook(webhook, { source: "polygonus-maestro-analyze", ...report });
      report.webhookSent = true;
    } catch (e) {
      report.webhookError = String(e.message ?? e);
    }
  }

  if (!flags.quiet) {
    console.log(JSON.stringify(report, null, 2));
    console.error(`\nSalvo: ${outPath}`);
  }

  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
