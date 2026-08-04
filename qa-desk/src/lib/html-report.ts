import type { DashboardMetrics } from "@/lib/dashboard-metrics";
import { QA_DESK_MARK_SVG } from "@/config/brand";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Relatório HTML autônomo (abre no browser / anexa no Discord). */
export function buildHomologationHtmlReport(
  metrics: DashboardMetrics,
  opts?: { projectLabel?: string; author?: string },
): string {
  const project = opts?.projectLabel ?? "Polygonus";
  const author = opts?.author ?? "QA";
  const hom = metrics.primaryHomologation;

  const moduleRows = metrics.modules
    .map(
      (m) => `
      <tr>
        <td><strong>${esc(m.label)}</strong></td>
        <td class="num">${m.suiteCount}</td>
        <td class="num">${m.stats.passRatePct}%</td>
        <td class="ok">${m.stats.passed}</td>
        <td class="fail">${m.stats.failed}</td>
        <td class="pend">${m.stats.pending}</td>
      </tr>`,
    )
    .join("");

  const suiteRows = metrics.suites
    .map(
      (s) => `
      <tr>
        <td>${esc(s.moduleLabel)}</td>
        <td><strong>${esc(s.label)}</strong></td>
        <td class="num">${s.stats.passRatePct}%</td>
        <td class="ok">${s.stats.passed}</td>
        <td class="fail">${s.stats.failed}</td>
        <td class="pend">${s.stats.pending}</td>
        <td class="num">${s.stats.totalRuns}</td>
        <td>${esc(fmtDate(s.stats.lastRunAt))}</td>
        <td>${s.stats.draftCount > 0 ? `${s.stats.draftCount} rascunho(s)` : "—"}</td>
      </tr>`,
    )
    .join("");

  const failRows =
    metrics.failures.length === 0
      ? `<tr><td colspan="4" class="muted">Nenhuma falha aberta.</td></tr>`
      : metrics.failures
          .map(
            (f) => `
      <tr>
        <td>${esc(f.module)}</td>
        <td>${esc(f.suite)}</td>
        <td>${esc(f.title)}</td>
        <td><code>${esc(f.testKey ?? f.id)}</code></td>
      </tr>`,
          )
          .join("");

  const conclusion =
    metrics.failed > 0
      ? "Bloqueado — há falhas abertas na suíte."
      : metrics.pending > 0
        ? "Em andamento — ainda há itens pendentes."
        : metrics.passed > 0
          ? "Aprovado (pelos CTs automatizados registrados)."
          : "Sem dados suficientes.";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Relatório QA — ${esc(project)}</title>
  <style>
    :root {
      --bg: #0f1419;
      --card: #1a222c;
      --border: #2a3542;
      --text: #e7ecf1;
      --muted: #8b9aab;
      --ok: #34d399;
      --fail: #f87171;
      --pend: #94a3b8;
      --accent: #38bdf8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.45;
      padding: 2rem 1.25rem 3rem;
    }
    .wrap { max-width: 920px; margin: 0 auto; }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      margin-bottom: 1.25rem;
    }
    .brand-name {
      font-size: 1.05rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .brand-name span { color: #dc2626; }
    h1 { font-size: 1.5rem; margin: 0 0 0.25rem; }
    h2 { font-size: 1.05rem; margin: 1.75rem 0 0.75rem; color: var(--accent); }
    .sub { color: var(--muted); font-size: 0.9rem; margin-bottom: 1.5rem; }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 0.75rem;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 0.9rem 1rem;
    }
    .card .label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
    .card .value { font-size: 1.45rem; font-weight: 700; margin-top: 0.2rem; font-variant-numeric: tabular-nums; }
    .ok { color: var(--ok); }
    .fail { color: var(--fail); }
    .pend { color: var(--pend); }
    .muted { color: var(--muted); }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
    }
    th, td { padding: 0.55rem 0.75rem; border-bottom: 1px solid var(--border); text-align: left; }
    th { color: var(--muted); font-weight: 600; font-size: 0.75rem; text-transform: uppercase; }
    tr:last-child td { border-bottom: 0; }
    .num { font-variant-numeric: tabular-nums; }
    code { font-size: 0.8em; color: var(--accent); }
    .bar {
      height: 8px;
      background: var(--border);
      border-radius: 999px;
      overflow: hidden;
      margin-top: 0.35rem;
    }
    .bar > i {
      display: block;
      height: 100%;
      background: linear-gradient(90deg, var(--ok), #22d3ee);
    }
    .conclusion {
      margin-top: 1.5rem;
      padding: 1rem 1.1rem;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--card);
    }
    footer { margin-top: 2rem; font-size: 0.75rem; color: var(--muted); }
    @media print {
      body { background: #fff; color: #111; padding: 1rem; }
      .card, table, .conclusion { background: #fff; border-color: #ccc; }
      .ok { color: #059669; }
      .fail { color: #dc2626; }
      h2 { color: #0369a1; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="brand">
      ${QA_DESK_MARK_SVG}
      <div class="brand-name">QA<span>Desk</span></div>
    </div>
    <h1>Relatório de homologação — ${esc(project)}</h1>
    <p class="sub">
      Gerado em ${esc(fmtDate(metrics.generatedAt))} · ${esc(author)}
      ${hom ? ` · Campanha: <strong>${esc(hom.title)}</strong>` : ""}
      ${hom?.build ? ` · Build ${esc(hom.build)}` : ""}
    </p>

    <div class="cards">
      <div class="card"><div class="label">Passou</div><div class="value ok">${metrics.passed}</div></div>
      <div class="card"><div class="label">Falhou</div><div class="value fail">${metrics.failed}</div></div>
      <div class="card"><div class="label">Pendente</div><div class="value pend">${metrics.pending}</div></div>
      <div class="card"><div class="label">Taxa</div><div class="value">${metrics.passRatePct}%</div>
        <div class="bar"><i style="width:${metrics.passRatePct}%"></i></div>
      </div>
      <div class="card"><div class="label">Flows estáveis</div><div class="value">${metrics.readyFlows}<span class="muted" style="font-size:.9rem">/${metrics.automated}</span></div></div>
      <div class="card"><div class="label">Bugs abertos</div><div class="value">${metrics.bugsOpen}</div></div>
    </div>

    <h2>Módulos</h2>
    <table>
      <thead>
        <tr>
          <th>Módulo</th><th>Suites</th><th>%</th><th>Passou</th><th>Falhou</th><th>Pendente</th>
        </tr>
      </thead>
      <tbody>${moduleRows}</tbody>
    </table>

    <h2>Suites</h2>
    <table>
      <thead>
        <tr>
          <th>Módulo</th><th>Suite</th><th>%</th><th>Passou</th><th>Falhou</th><th>Pendente</th>
          <th>Rodadas</th><th>Última</th><th>Flows</th>
        </tr>
      </thead>
      <tbody>${suiteRows}</tbody>
    </table>

    <h2>Falhas abertas</h2>
    <table>
      <thead><tr><th>Módulo</th><th>Suite</th><th>Cenário</th><th>Chave</th></tr></thead>
      <tbody>${failRows}</tbody>
    </table>

    <div class="conclusion">
      <strong>Conclusão (automática)</strong>
      <p style="margin:.4rem 0 0">${esc(conclusion)}</p>
      <p class="muted" style="margin:.5rem 0 0;font-size:.8rem">
        Revise manualmente antes de liberar build. Rascunhos: ${metrics.draftFlows} flow(s).
        Última execução: ${esc(fmtDate(metrics.lastRunAt))}.
      </p>
    </div>

    <footer>
      QA Desk · relatório gerado a partir do catálogo de testes (sem novos backends).
      ${hom ? `Homologação ${esc(hom.id)} (${esc(hom.status)}).` : ""}
    </footer>
  </div>
</body>
</html>`;
}

export function downloadHtmlReport(html: string, filename: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
