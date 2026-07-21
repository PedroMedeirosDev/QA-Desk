#!/usr/bin/env node
/**
 * Digest GitHub = substituto de abrir e-mail por e-mail.
 * Lista commits/CI de TODOS os repos polygonus-br que você acessa.
 *
 * Auth: gh auth login  (recomendado)  ou  GITHUB_TOKEN no .env
 *
 * Uso:
 *   node scripts/sync-github-homologacao.mjs
 *   node scripts/sync-github-homologacao.mjs --days 3
 *   node scripts/sync-github-homologacao.mjs --discover
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync, spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const INBOX = join(ROOT, "projects/polygonus/homologacao/inbox");
const CONFIG_PATH = join(dirname(fileURLToPath(import.meta.url)), "github-homologacao.config.json");
const COMPANY_REPOS_PATH = join(dirname(fileURLToPath(import.meta.url)), "company-repos.json");
const MAESTRO_ROOT = "projects/polygonus/automation/maestro";

function die(msg) {
  console.error(`\n[sync-github] ${msg}\n`);
  process.exit(1);
}

function findEnvFile() {
  let dir = ROOT;
  for (let i = 0; i < 6; i++) {
    const p = join(dir, ".env");
    if (existsSync(p)) return p;
    dir = dirname(dir);
  }
  return null;
}

function loadGithubToken() {
  if (process.env.GITHUB_TOKEN?.trim()) return process.env.GITHUB_TOKEN.trim();
  const envPath = findEnvFile();
  if (!envPath) return null;
  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((l) => /^GITHUB_TOKEN=/.test(l) && !l.trim().startsWith("#"));
  if (!line) return null;
  return line.slice("GITHUB_TOKEN=".length).trim() || null;
}

function ghAvailable() {
  try {
    execSync("gh --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function ghAuthOk() {
  if (!ghAvailable()) return false;
  return spawnSync("gh", ["auth", "status"], { encoding: "utf8" }).status === 0;
}

function parseArgs(argv) {
  const flags = { dryRun: false, days: null, discover: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dry-run") flags.dryRun = true;
    if (argv[i] === "--discover") flags.discover = true;
    if (argv[i] === "--days" && argv[i + 1]) flags.days = Number(argv[++i]);
  }
  return flags;
}

function loadConfig() {
  return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
}

async function apiGet(path, token) {
  if (ghAuthOk()) {
    const out = execSync(`gh api "${path}"`, { encoding: "utf8", maxBuffer: 15 * 1024 * 1024 });
    return JSON.parse(out);
  }
  if (!token) {
    die("Sem auth. Rode: gh auth login");
  }
  const url = path.startsWith("http") ? path : `https://api.github.com${path}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) die(`GitHub API ${res.status}: ${path}\n${(await res.text()).slice(0, 400)}`);
  return res.json();
}

function sinceIso(daysBack) {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return d.toISOString();
}

function fmtDate(iso) {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 16);
}

function truncate(s, n = 120) {
  if (!s) return "";
  const t = s.replace(/\r\n/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n)}…`;
}

function tierFromPapel(papel) {
  switch (papel) {
    case "APP":
    case "NOVO LAYOUT":
      return "full";
    case "BACKEND PRINCIPAL":
    case "SUPORTE KB":
      return "sanity";
    default:
      return "legacy";
  }
}

function homologHintForTier(tier) {
  if (tier === "legacy") {
    return "Legado — homologar só se entidade usa versão clássica ou Moacir pedir.";
  }
  if (tier === "sanity") {
    return "Backend principal — validar efeito no portal + app (não testar Go isolado).";
  }
  return null;
}

function loadCompanyRepoConfigs() {
  if (!existsSync(COMPANY_REPOS_PATH)) return [];
  const data = JSON.parse(readFileSync(COMPANY_REPOS_PATH, "utf8"));
  return (data.repos ?? []).map((r) => {
    const tier = r.tier ?? tierFromPapel(r.papel);
    return {
      name: r.name,
      label: r.descricao ? `${r.papel} — ${r.descricao}` : r.papel,
      papel: r.papel,
      tier,
      branch: r.branch,
      checklist:
        r.checklist ??
        (r.name === "polygonus-mobile" ? `${MAESTRO_ROOT}/flows/docs/CHECKLIST_v5.53.90.md` : null),
      homologacao: r.homologacao ?? null,
      maestroSmoke:
        r.maestroSmoke ??
        (r.name === "polygonus-mobile" ? `${MAESTRO_ROOT}/flows/smoke/example_launch_app.yaml` : null),
      homologHint: homologHintForTier(tier),
    };
  });
}

async function listOrgRepos(org, token, maxRepos) {
  const all = [];
  for (let page = 1; page <= 5 && all.length < maxRepos; page++) {
    const batch = await apiGet(`/orgs/${org}/repos?per_page=100&page=${page}&sort=pushed`, token);
    if (!batch?.length) break;
    all.push(...batch);
  }
  return all.slice(0, maxRepos);
}

function mergeRepoConfigs(config, orgRepos) {
  const byName = new Map(loadCompanyRepoConfigs().map((r) => [r.name, { ...r }]));
  if (config.autoDiscoverOrgRepos && orgRepos?.length) {
    for (const r of orgRepos) {
      if (r.name && !byName.has(r.name)) {
        byName.set(r.name, {
          name: r.name,
          label: `? — ${r.description?.slice(0, 50) || r.name}`,
          tier: "legacy",
          branch: r.default_branch,
          homologHint: "Repo novo — confirmar papel com Moacir.",
        });
      }
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchNotifications(token, since, org) {
  try {
    const all = await apiGet("/notifications?all=true&per_page=100", token);
    return all.filter((n) => {
      if (!n.repository?.full_name?.startsWith(`${org}/`)) return false;
      return new Date(n.updated_at) >= new Date(since);
    });
  } catch {
    return [];
  }
}

async function fetchReleases(org, repo, token) {
  try {
    return await apiGet(`/repos/${org}/${repo}/releases?per_page=5`, token);
  } catch {
    return [];
  }
}

async function fetchWorkflowRuns(org, repo, branch, token) {
  try {
    const q = `/repos/${org}/${repo}/actions/runs?branch=${encodeURIComponent(branch)}&per_page=8`;
    return (await apiGet(q, token)).workflow_runs ?? [];
  } catch {
    return [];
  }
}

async function fetchRecentCommits(org, repo, branch, limit, token) {
  try {
    return await apiGet(
      `/repos/${org}/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=${limit}`,
      token
    );
  } catch {
    return [];
  }
}

function inferBuildFromTag(tag) {
  if (!tag) return null;
  const m = tag.match(/(\d+\.\d+\.\d+)(?:\+(\d+))?/);
  if (!m) return null;
  return { version: m[1], code: m[2] ?? null, raw: tag };
}

function tierLabel(config, tier) {
  return config.tierLabels?.[tier] ?? tier;
}

function commitInboxLine(org, repoName, c) {
  const sha = c.sha?.slice(0, 7) ?? "???????";
  const msg = c.commit?.message?.split("\n")[0] ?? "—";
  return `- **${fmtDate(c.commit?.author?.date)}** · \`${org}/${repoName}\` · \`${sha}\`: ${truncate(msg, 100)}`;
}

async function collectRepoEvents(config, repoCfg, token, since, commitsLimit) {
  const branch = repoCfg.branch ?? config.defaultBranch ?? "cq";
  const org = config.org;
  const [releases, runs, commitsRaw] = await Promise.all([
    fetchReleases(org, repoCfg.name, token),
    fetchWorkflowRuns(org, repoCfg.name, branch, token),
    fetchRecentCommits(org, repoCfg.name, branch, commitsLimit, token),
  ]);
  const sinceDate = new Date(since);
  return {
    repoCfg,
    branch,
    releases: releases.filter((r) => new Date(r.published_at) >= sinceDate),
    runs: runs.filter((w) => new Date(w.updated_at) >= sinceDate),
    commits: commitsRaw.filter((c) => new Date(c.commit?.author?.date) >= sinceDate),
  };
}

function homologQueueSection(config, repoEvents) {
  const tiers = { full: [], sanity: [], legacy: [] };
  for (const ev of repoEvents) {
    if (!ev.commits.length && !ev.releases.length && !ev.runs.some((r) => r.conclusion === "success")) {
      continue;
    }
    const tier = ev.repoCfg.tier ?? "legacy";
    tiers[tier]?.push(ev) ?? tiers.legacy.push(ev);
  }

  const lines = [];
  lines.push("## Fila de homologação (o que importa para QA)");
  lines.push("");
  lines.push("_Equivalente a ler os e-mails do GitHub — agrupado por prioridade, sem abrir um a um._");
  lines.push("");

  for (const tier of ["full", "sanity", "legacy"]) {
    const items = tiers[tier];
    if (!items.length) continue;
    lines.push(`### ${tier.toUpperCase()} — ${tierLabel(config, tier)}`);
    lines.push("");
    for (const ev of items) {
      const r = ev.repoCfg;
      lines.push(`**${r.name}** (${r.label})`);
      if (r.checklist) lines.push(`- Checklist: \`${r.checklist}\``);
      if (r.homologacao) lines.push(`- Roteiro: \`${r.homologacao}\``);
      if (r.maestroSmoke) lines.push(`- Smoke: \`${r.maestroSmoke}\``);
      if (r.homologHint) lines.push(`- ${r.homologHint}`);
      const last = ev.commits[0];
      if (last) {
        lines.push(`- Último commit: \`${last.sha?.slice(0, 7)}\` — ${truncate(last.commit?.message?.split("\n")[0], 80)}`);
      }
      const rel = ev.releases[0];
      if (rel) {
        const b = inferBuildFromTag(rel.tag_name);
        lines.push(`- Release: \`${rel.tag_name}\`${b?.version ? ` → BUILD \`${b.version}\`${b.code ? `+${b.code}` : ""}` : ""}`);
      }
      lines.push("");
    }
  }

  if (!tiers.full.length && !tiers.sanity.length && !tiers.legacy.length) {
    lines.push("_Nenhuma atividade recente nos repos._");
    lines.push("");
  }
  return lines.join("\n");
}

function inboxDigestSection(config, repoEvents) {
  const rows = [];
  for (const ev of repoEvents) {
    for (const c of ev.commits) {
      rows.push({
        date: new Date(c.commit?.author?.date ?? 0),
        line: commitInboxLine(config.org, ev.repoCfg.name, c),
        repo: ev.repoCfg.name,
      });
    }
  }
  rows.sort((a, b) => b.date - a.date);

  const lines = [];
  lines.push("## Caixa de entrada (estilo e-mail GitHub)");
  lines.push("");
  lines.push(`_${rows.length} commits nos últimos dias — mesma info dos e-mails do Moacir/GitHub._`);
  lines.push("");
  if (!rows.length) {
    lines.push("_Nenhum commit na janela._");
  } else {
    for (const r of rows.slice(0, 80)) {
      lines.push(r.line);
    }
    if (rows.length > 80) lines.push(`\n_… e mais ${rows.length - 80} commits (aumente --days ou commitsPerRepo)._`);
  }
  lines.push("");
  return lines.join("\n");
}

function notificationSection(notifications) {
  if (!notifications.length) return "_Sem notificações GitHub na janela (normal se já leu no site)._ \n";
  const lines = ["| Quando | Repo | Assunto (como no e-mail) |", "|--------|------|-------------------------|"];
  for (const n of notifications.slice(0, 40)) {
    const sub = (n.subject?.title ?? "—").replace(/\|/g, "\\|");
    lines.push(`| ${fmtDate(n.updated_at)} | ${n.repository?.name ?? "—"} | ${sub} |`);
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  const daysBack = flags.days ?? config.daysBack ?? 7;
  const since = sinceIso(daysBack);
  const token = loadGithubToken();
  const commitsLimit = config.commitsPerRepo ?? 12;
  const maxRepos = config.maxRepos ?? 40;

  console.log("[sync-github] Auth:", ghAuthOk() ? "gh OAuth" : token ? "GITHUB_TOKEN" : "—");

  let orgRepos = [];
  if (config.autoDiscoverOrgRepos) {
    console.log(`[sync-github] Descobrindo repos em ${config.org}…`);
    orgRepos = await listOrgRepos(config.org, token, maxRepos);
    console.log(`[sync-github] ${orgRepos.length} repos encontrados`);
  }

  const repoConfigs = mergeRepoConfigs(config, orgRepos);

  if (flags.discover) {
    console.log("\nRepos monitorados:\n");
    for (const r of repoConfigs) {
      console.log(`  - ${r.name} (${r.tier ?? "legacy"}) branch=${r.branch ?? config.defaultBranch}`);
    }
    return;
  }

  console.log(`[sync-github] Janela: ${daysBack} dias · ${repoConfigs.length} repos\n`);

  const notifications = await fetchNotifications(token, since, config.org);

  const repoEvents = [];
  for (const repoCfg of repoConfigs) {
    process.stdout.write(`  ${repoCfg.name}…\r`);
    repoEvents.push(await collectRepoEvents(config, repoCfg, token, since, commitsLimit));
  }
  console.log("");

  const now = new Date();
  const stamp = now.toISOString().slice(0, 10);
  const time = now.toISOString().slice(11, 19);

  const parts = [];
  parts.push("# Homologação — digest GitHub");
  parts.push("");
  parts.push(`> **${stamp} ${time}** · ${repoConfigs.length} repos · últimos **${daysBack}** dias`);
  parts.push(`> Substitui abrir e-mail por e-mail. No Cursor: _"Leia projects/polygonus/homologacao/inbox/latest.md e diga o que homologar hoje."_`);
  parts.push("");
  parts.push(homologQueueSection(config, repoEvents));
  parts.push(inboxDigestSection(config, repoEvents));
  parts.push("## Notificações GitHub");
  parts.push("");
  parts.push(notificationSection(notifications));
  parts.push("## Rotina sugerida");
  parts.push("");
  parts.push("1. `.\\scripts\\sync-github-homologacao.ps1` (2× ao dia ou quando a caixa encher)");
  parts.push("2. Homologar **FULL** (app + portal) → **SANITY** (go via portal/app) → **LEGACY** só se aplicável");
  parts.push("3. `.\\sync.bat` nos repos **full** antes de testar");
  parts.push("4. Maestro + checklist · evidência em `projects/polygonus/evidence/`");
  parts.push("");

  const markdown = parts.join("\n");

  if (flags.dryRun) {
    console.log(markdown);
    return;
  }

  mkdirSync(INBOX, { recursive: true });
  writeFileSync(join(INBOX, "latest.md"), markdown, "utf8");
  writeFileSync(join(INBOX, `${stamp}-github-sync.md`), markdown, "utf8");
  console.log(`[sync-github] OK → projects/polygonus/homologacao/inbox/latest.md`);
}

main().catch((e) => die(e.message ?? String(e)));
