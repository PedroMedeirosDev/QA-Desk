import type { DashboardMetrics } from "@/lib/dashboard-metrics";
import { QA_DESK_MARK_SVG } from "@/config/brand";
import { CHANNEL_LABELS } from "@/config/channels";
import type { Homologation, HomologationProgress } from "@/types/homologation";
import { HOMOLOGATION_CYCLE_LABELS } from "@/types/homologation";
import {
  evidencePurposeLabel,
  HOMOLOGATION_LABELS,
  type EvidenceFile,
  type HomologationStatus,
  type TestRecord,
} from "@/types/test-record";

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

const REPORT_CSS = `
    :root {
      --bg: #0f1419;
      --card: #1a222c;
      --card-subtle: #151c24;
      --border: #2a3542;
      --text: #e7ecf1;
      --muted: #8b9aab;
      --ok: #34d399;
      --fail: #f87171;
      --pend: #94a3b8;
      --warn: #fbbf24;
      --accent: #38bdf8;
      --radius-sm: 8px;
      --radius-md: 12px;
      --radius-lg: 16px;
      --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.28);
      --shadow-md: 0 8px 24px rgba(0, 0, 0, 0.28);
      --shadow-lg: 0 16px 40px rgba(0, 0, 0, 0.35);
      --ease: 160ms ease;
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
    .brand { display: flex; align-items: center; gap: 0.75rem; }
    .brand img { height: 36px; width: auto; display: block; }
    .brand-name { font-size: 1.15rem; font-weight: 700; letter-spacing: -0.02em; color: var(--text); }
    h1 {
      font-size: 1.55rem;
      margin: 0.85rem 0 0.35rem;
      letter-spacing: -0.02em;
      line-height: 1.25;
    }
    h2 {
      font-size: 0.95rem;
      margin: 1.75rem 0 0.85rem;
      color: var(--accent);
      font-weight: 650;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }
    .sub { color: var(--muted); font-size: 0.88rem; margin: 0; }
    .muted { color: var(--muted); }
    code {
      font-size: 0.85em;
      color: var(--accent);
      background: color-mix(in srgb, var(--accent) 12%, transparent);
      padding: 0.1rem 0.35rem;
      border-radius: 4px;
    }
    ul { margin: 0.35rem 0 0.8rem; padding-left: 1.2rem; }
    li { margin: 0.25rem 0; }
    p { margin: 0.4rem 0; }

    .header-card {
      background: linear-gradient(180deg, color-mix(in srgb, var(--card) 92%, var(--accent)), var(--card));
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 1.25rem 1.35rem 1.35rem;
      box-shadow: var(--shadow-md);
      margin-bottom: 1.15rem;
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.75rem;
      margin: 0 0 1.5rem;
    }
    .kpi {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 0.85rem 0.95rem;
      box-shadow: var(--shadow-sm);
      transition: transform var(--ease), box-shadow var(--ease), border-color var(--ease);
    }
    .kpi:hover {
      transform: translateY(-1px);
      box-shadow: var(--shadow-md);
      border-color: color-mix(in srgb, var(--border) 60%, var(--accent));
    }
    .kpi-label {
      font-size: 0.68rem;
      font-weight: 650;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 0.35rem;
    }
    .kpi-value {
      font-size: 1.55rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.03em;
      line-height: 1;
    }
    .kpi-value.ok { color: var(--ok); }
    .kpi-value.fail { color: var(--fail); }
    .kpi-value.pend { color: var(--pend); }
    .kpi-value.warn { color: var(--warn); }

    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: 0.875rem;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      overflow: hidden;
      box-shadow: var(--shadow-sm);
    }
    th, td { padding: 0.65rem 0.85rem; border-bottom: 1px solid var(--border); text-align: left; }
    th {
      color: var(--muted);
      font-weight: 650;
      font-size: 0.7rem;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      background: color-mix(in srgb, var(--card) 80%, #000);
    }
    tr:last-child td { border-bottom: 0; }
    tbody tr { transition: background var(--ease); }
    tbody tr:hover td { background: color-mix(in srgb, var(--accent) 6%, transparent); }

    .ok { color: var(--ok); }
    .fail { color: var(--fail); }
    .pend { color: var(--pend); }
    .warn { color: var(--warn); }

    .ct {
      background: var(--card);
      border: 1px solid var(--border);
      border-left: 4px solid var(--pend);
      border-radius: var(--radius-md);
      padding: 1.15rem 1.25rem 1.3rem;
      margin: 1rem 0 0;
      box-shadow: var(--shadow-sm);
      transition: box-shadow var(--ease), border-color var(--ease), transform var(--ease);
    }
    .ct:hover { box-shadow: var(--shadow-md); }
    .ct.has-ok { border-left-color: var(--ok); }
    .ct.has-fail { border-left-color: var(--fail); }
    .ct.has-warn { border-left-color: var(--warn); }

    .ct-head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.55rem 1rem;
      margin-bottom: 0.95rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--border);
    }
    .ct-head h3 {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 650;
      letter-spacing: -0.015em;
    }
    .ct-meta { font-size: 0.75rem; color: var(--muted); margin-top: 0.25rem; }

    .badge {
      display: inline-block;
      font-size: 0.72rem;
      font-weight: 650;
      padding: 0.28rem 0.65rem;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: color-mix(in srgb, var(--card-subtle) 80%, #000);
      transition: background var(--ease), border-color var(--ease);
    }
    .badge.ok {
      border-color: color-mix(in srgb, var(--ok) 45%, transparent);
      color: var(--ok);
      background: color-mix(in srgb, var(--ok) 12%, transparent);
    }
    .badge.fail {
      border-color: color-mix(in srgb, var(--fail) 45%, transparent);
      color: var(--fail);
      background: color-mix(in srgb, var(--fail) 12%, transparent);
    }
    .badge.warn {
      border-color: color-mix(in srgb, var(--warn) 45%, transparent);
      color: var(--warn);
      background: color-mix(in srgb, var(--warn) 12%, transparent);
    }
    .badge.pend { color: var(--pend); }

    .block {
      margin-top: 0.85rem;
      padding: 0.85rem 0.95rem;
      border-radius: var(--radius-sm);
      background: var(--card-subtle);
      border: 1px solid color-mix(in srgb, var(--border) 85%, transparent);
    }
    .block-problem {
      background: color-mix(in srgb, var(--fail) 10%, var(--card-subtle));
      border-color: color-mix(in srgb, var(--fail) 28%, var(--border));
    }
    .block-problem .block-label { color: var(--fail); }
    .block-label {
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 0.4rem;
    }
    .block-body {
      white-space: pre-wrap;
      font-size: 0.92rem;
      line-height: 1.5;
    }

    .ev-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 0.85rem;
      margin-top: 0.2rem;
    }
    .ev-card {
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      overflow: hidden;
      background: #121820;
      box-shadow: var(--shadow-sm);
      transition: box-shadow var(--ease), transform var(--ease);
    }
    .ev-card:hover { box-shadow: var(--shadow-md); }
    .ev-card.ev-image,
    .ev-card.ev-video {
      grid-column: 1 / -1;
      max-width: 860px;
    }
    .ev-card img, .ev-card video {
      display: block;
      width: 100%;
      background: #0a0e12;
    }
    .ev-card img {
      max-height: 520px;
      object-fit: contain;
      transition: filter var(--ease);
    }
    .ev-card video {
      max-height: 480px;
      object-fit: contain;
      background: #000;
    }
    .ev-zoom {
      position: relative;
      display: block;
      cursor: zoom-in;
      text-decoration: none;
      color: inherit;
      outline: none;
    }
    .ev-zoom:hover img { filter: brightness(1.07); }
    .ev-zoom:hover .ev-zoom-badge {
      background: rgba(0, 0, 0, 0.88);
      border-color: color-mix(in srgb, var(--accent) 55%, transparent);
      transform: translateY(-1px);
    }
    .ev-zoom:focus-visible {
      box-shadow: inset 0 0 0 2px var(--accent);
    }
    .ev-zoom-badge {
      position: absolute;
      right: 0.7rem;
      bottom: 0.7rem;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.4rem 0.65rem;
      border-radius: var(--radius-sm);
      background: rgba(0, 0, 0, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #f3f6f9;
      font-size: 0.72rem;
      font-weight: 650;
      letter-spacing: 0.01em;
      pointer-events: none;
      backdrop-filter: blur(6px);
      box-shadow: var(--shadow-sm);
      transition: background var(--ease), border-color var(--ease), transform var(--ease);
    }
    .ev-zoom-badge svg {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
    }
    .ev-cap {
      padding: 0.55rem 0.7rem 0.65rem;
      font-size: 0.75rem;
      border-top: 1px solid var(--border);
      background: color-mix(in srgb, var(--card) 70%, #000);
    }
    .ev-cap strong { display: block; color: var(--text); margin-bottom: 0.15rem; }
    .ct-foot {
      margin-top: 1rem;
      padding-top: 0.7rem;
      border-top: 1px dashed var(--border);
      font-size: 0.75rem;
      color: var(--muted);
    }
    footer {
      margin-top: 2.25rem;
      padding-top: 1.1rem;
      border-top: 1px solid var(--border);
      font-size: 0.8rem;
      color: var(--muted);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem 1.25rem;
    }
    .footer-brand {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--text);
      font-weight: 650;
      letter-spacing: -0.02em;
    }
    .footer-brand svg {
      width: 22px;
      height: 22px;
      flex-shrink: 0;
    }
    .footer-brand span span { color: #dc2626; }
    .footer-note { color: var(--muted); font-weight: 400; }

    @media (max-width: 720px) {
      .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

    @media print {
      body { background: #fff; color: #111; padding: 0.75rem; }
      .header-card, .kpi, .ct, .ev-card, .block, table {
        background: #fff !important;
        box-shadow: none !important;
        border-color: #d1d5db !important;
      }
      .header-card { border: 1px solid #d1d5db; }
      .kpi:hover, .ct:hover, .ev-card:hover { transform: none; box-shadow: none; }
      .ok, .badge.ok, .kpi-value.ok { color: #059669 !important; }
      .fail, .badge.fail, .kpi-value.fail, .block-problem .block-label { color: #dc2626 !important; }
      .warn, .badge.warn, .kpi-value.warn { color: #b45309 !important; }
      .pend, .badge.pend, .kpi-value.pend { color: #64748b !important; }
      .badge {
        background: #fff !important;
        border-color: currentColor !important;
      }
      .block-problem {
        background: #fef2f2 !important;
        border-color: #fecaca !important;
      }
      h2 { color: #0369a1; }
      .ct {
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .ev-zoom-badge { display: none; }
      .ev-card img { max-height: none; }
      footer { border-color: #d1d5db; }
      .footer-brand { color: #111; }
    }
`;

function statusBadgeClass(status: string): string {
  if (status === "passou" || status === "homologado") return "ok";
  if (status === "falhou") return "fail";
  if (status === "falta_evidencias") return "warn";
  return "pend";
}

function ctStatusClass(status: string): string {
  if (status === "passou" || status === "homologado") return "has-ok";
  if (status === "falhou") return "has-fail";
  if (status === "falta_evidencias") return "has-warn";
  return "";
}

export type HomologationReportMedia = Record<
  string,
  { dataUrl?: string; kind: "image" | "video" | "other"; href?: string }
>;

const ZOOM_BADGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="2"/>
  <path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <path d="M11 8.5v5M8.5 11h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>`;

function evidenceMediaHtml(
  ev: EvidenceFile,
  status: HomologationStatus | undefined,
  media?: HomologationReportMedia,
): string {
  const purpose = evidencePurposeLabel(ev.purpose, status);
  const mediaType =
    ev.type === "screenshot" ? "Print" : ev.type === "video" ? "Vídeo" : "Arquivo";
  const filename = esc(ev.filename);
  const packed = media?.[ev.fileId];
  const isVideo = packed?.kind === "video" || ev.type === "video";
  const isImage =
    packed?.kind === "image" ||
    ev.type === "screenshot" ||
    (ev.mimeType?.startsWith("image/") ?? false);

  let body: string;
  let cardClass = "ev-card";
  let capHint = "";
  if (isImage && packed?.dataUrl) {
    cardClass += " ev-image";
    capHint = `<span class="muted">Clique na imagem para abrir em tamanho real</span>`;
    body = `<a class="ev-zoom" href="${packed.dataUrl}" target="_blank" rel="noopener noreferrer" title="Abrir print em nova guia">
      <img src="${packed.dataUrl}" alt="${filename}" loading="lazy" />
      <span class="ev-zoom-badge">${ZOOM_BADGE_SVG} Ampliar</span>
    </a>`;
  } else if (isVideo && packed?.dataUrl) {
    cardClass += " ev-video";
    body = `<video controls playsinline preload="metadata" src="${packed.dataUrl}"></video>`;
  } else {
    body = `<p class="muted" style="padding:.75rem">Não foi possível embutir este anexo no HTML (${mediaType}: ${filename}). Reexporte com o QA Desk aberto.</p>`;
  }
  return `<figure class="${cardClass}">
    ${body}
    <figcaption class="ev-cap">
      <strong>${esc(purpose)}</strong>
      <span class="muted">${mediaType} · ${filename}</span>
      ${capHint ? `<br/>${capHint}` : ""}
    </figcaption>
  </figure>`;
}

function ctFooterMeta(record?: TestRecord, campaignBuild?: string): string {
  if (!record) return "";
  const bits: string[] = [];
  if (record.testLogin?.trim()) bits.push(`Login ${esc(record.testLogin.trim())}`);
  const build = record.build?.trim() || campaignBuild?.trim();
  if (build) bits.push(`Build ${esc(build)}`);
  if (record.deviceLabel?.trim()) bits.push(esc(record.deviceLabel.trim()));
  if (record.browser?.trim()) bits.push(esc(record.browser.trim()));
  if (record.osVersion?.trim()) bits.push(esc(record.osVersion.trim()));
  if (bits.length === 0) return "";
  return `<div class="ct-foot">${bits.join(" · ")}</div>`;
}

/** Relatório enxuto por CT (problema / observação / evidência) — sem briefing. */
export function buildHomologationScopeHtml(
  homologation: Homologation,
  progress: HomologationProgress,
  opts?: {
    projectLabel?: string;
    author?: string;
    /** @deprecated Ignorado — o relatório não inclui o textão de escopo/briefing. */
    briefing?: string;
    /** Registros completos dos CTs do escopo (por testKey). */
    recordsByKey?: Record<string, TestRecord>;
    /** Embeds de evidência (data URL) indexados por fileId. */
    mediaByFileId?: HomologationReportMedia;
    /** Logo do produto (data URL) para o cabeçalho. */
    brandLogoDataUrl?: string;
    /** Cor de tema da corporação/projeto (ex.: #2b73eb Polygonus). */
    themeAccent?: string;
    /** Destaque secundário do tema (opcional). */
    themeHighlight?: string;
  },
): string {
  const project = opts?.projectLabel ?? "Polygonus";
  const author = opts?.author ?? "QA";
  const channel = homologation.channel
    ? CHANNEL_LABELS[homologation.channel]
    : "—";
  const records = opts?.recordsByKey ?? {};
  const media = opts?.mediaByFileId ?? {};
  const themeAccent = opts?.themeAccent?.trim() || "";
  const themeHighlight = opts?.themeHighlight?.trim() || "";
  const themeCss =
    themeAccent || themeHighlight
      ? `
    :root {
      ${themeAccent ? `--accent: ${esc(themeAccent)};` : ""}
      ${themeHighlight ? `--brand-highlight: ${esc(themeHighlight)};` : ""}
    }
    .header-card {
      background: linear-gradient(
        135deg,
        color-mix(in srgb, var(--accent) 18%, var(--card)) 0%,
        var(--card) 55%
      );
      border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
      box-shadow: var(--shadow-md), 0 0 0 1px color-mix(in srgb, var(--accent) 12%, transparent);
    }
    .kpi:hover {
      border-color: color-mix(in srgb, var(--border) 45%, var(--accent));
    }
    code {
      color: var(--accent);
      background: color-mix(in srgb, var(--accent) 14%, transparent);
    }
  `
      : "";

  const brandMark = opts?.brandLogoDataUrl
    ? `<img src="${opts.brandLogoDataUrl}" alt="${esc(project)}" />`
    : "";
  const brandTitle =
    project.toLowerCase() === "polygonus"
      ? `Polygonus`
      : esc(project);

  const approved = progress.items.filter(
    (i) => i.status === "passou" || i.status === "homologado",
  ).length;
  const failedKpi = progress.items.filter((i) => i.status === "falhou").length;
  const pendingOpen = progress.items.filter(
    (i) => i.status === "pendente" || i.status === "falta_evidencias",
  ).length;
  const totalKpi = progress.items.length;

  const ctSections =
    progress.items.length === 0
      ? `<p class="muted">Nenhum CT no escopo.</p>`
      : progress.items
          .map((item) => {
            const record = records[item.testKey];
            const st = HOMOLOGATION_LABELS[item.status] ?? item.status;
            const cls = statusBadgeClass(item.status);
            const accent = ctStatusClass(item.status);
            const problem = record?.description?.trim() || "";
            const observation = record?.actualResult?.trim() || "";
            const evidence = record?.evidence ?? [];
            const evidenceHtml =
              evidence.length === 0
                ? `<p class="muted">Sem evidência anexada.</p>`
                : `<div class="ev-grid">${evidence
                    .map((ev) => evidenceMediaHtml(ev, item.status, media))
                    .join("")}</div>`;

            return `<article class="ct ${accent}">
  <div class="ct-head">
    <div>
      <h3>${esc(item.title)}</h3>
      <div class="ct-meta">${esc(item.suite ?? "—")}${item.testKey ? ` · <code>${esc(item.testKey)}</code>` : ""}</div>
    </div>
    <span class="badge ${cls}">${esc(st)}</span>
  </div>
  <div class="block block-problem">
    <div class="block-label">1 · Problema (nas palavras do cliente)</div>
    <div class="block-body">${problem ? esc(problem) : "<span class=\"muted\">—</span>"}</div>
  </div>
  <div class="block">
    <div class="block-label">2 · Observação do QA</div>
    <div class="block-body">${observation ? esc(observation) : "<span class=\"muted\">—</span>"}</div>
  </div>
  <div class="block">
    <div class="block-label">3 · Evidência</div>
    ${evidenceHtml}
  </div>
  ${ctFooterMeta(record, homologation.build)}
</article>`;
          })
          .join("\n");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Relatório — ${esc(homologation.title)}</title>
  <style>${REPORT_CSS}${themeCss}</style>
</head>
<body>
  <div class="wrap">
    <header class="header-card">
      <div class="brand">
        ${brandMark}
        <div class="brand-name">${brandTitle}</div>
      </div>
      <h1>${esc(homologation.title)}</h1>
      <p class="sub">
        Homologação · ${esc(channel)} ·
        ${esc(HOMOLOGATION_CYCLE_LABELS[homologation.status])} ·
        ${esc(fmtDate(new Date().toISOString()))} · ${esc(author)}
        ${homologation.build ? ` · Build ${esc(homologation.build)}` : ""}
      </p>
    </header>

    <section class="kpi-grid" aria-label="Resumo da homologação">
      <div class="kpi">
        <div class="kpi-label">Total</div>
        <div class="kpi-value">${totalKpi}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Aprovados</div>
        <div class="kpi-value ok">${approved}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Falhas</div>
        <div class="kpi-value fail">${failedKpi}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Pendentes</div>
        <div class="kpi-value ${pendingOpen > 0 ? "warn" : "pend"}">${pendingOpen}</div>
      </div>
    </section>

    <h2>Casos homologados</h2>
    ${ctSections}
    <footer>
      <div class="footer-brand">
        ${QA_DESK_MARK_SVG}
        <span>QA <span>Desk</span></span>
      </div>
      <div class="footer-note">Relatório de homologação · problema · observação · evidência</div>
    </footer>
  </div>
  <script>
    (function () {
      document.querySelectorAll("a.ev-zoom").forEach(function (a) {
        a.addEventListener("click", function (ev) {
          ev.preventDefault();
          var src = a.getAttribute("href");
          if (!src) return;
          var title = (a.querySelector("img") && a.querySelector("img").getAttribute("alt")) || "Print";
          var w = window.open("", "_blank");
          if (!w) return;
          var doc = w.document;
          doc.open();
          doc.write("<!DOCTYPE html><html lang=\\"pt-BR\\"><head><meta charset=\\"utf-8\\"><meta name=\\"viewport\\" content=\\"width=device-width, initial-scale=1\\"><title></title><style>html,body{margin:0;background:#0f1419;min-height:100%}img{display:block;max-width:100%;height:auto;margin:0 auto;cursor:zoom-out}</style></head><body></body></html>");
          doc.close();
          doc.title = title;
          var img = doc.createElement("img");
          img.src = src;
          img.alt = title;
          img.title = "Clique para fechar";
          doc.body.appendChild(img);
          doc.addEventListener("click", function () { w.close(); });
        });
      });
    })();
  </script>
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

/** Converte URL (logo bundlado ou evidência) em data URL para HTML autônomo. */
export async function fetchAsDataUrl(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error("read fail"));
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

/** Converte evidências em data URL (print + vídeo) para o HTML autônomo (file://). */
export async function collectEvidenceMediaForReport(
  evidence: EvidenceFile[],
  resolveUrl: (storageKey: string) => string,
  opts?: {
    maxImageBytes?: number;
    maxVideoBytes?: number;
    /** Headers de auth — obrigatório se a rota de evidência exigir login. */
    headers?: HeadersInit;
    /** Evita saturar o proxy do Storage (padrão: 2). */
    concurrency?: number;
  },
): Promise<HomologationReportMedia> {
  // Base64 infla ~33%; limites pensados para HTML ainda abrível no browser.
  const maxImageBytes = opts?.maxImageBytes ?? 12 * 1024 * 1024;
  const maxVideoBytes = opts?.maxVideoBytes ?? 48 * 1024 * 1024;
  const concurrency = Math.max(1, opts?.concurrency ?? 2);
  const out: HomologationReportMedia = {};

  async function loadOne(ev: EvidenceFile): Promise<void> {
    const href = resolveUrl(ev.storageKey);
    if (ev.type === "log") {
      out[ev.fileId] = { kind: "other", href };
      return;
    }
    const preferVideo =
      ev.type === "video" || (ev.mimeType?.startsWith("video/") ?? false);

    const attempt = async (): Promise<boolean> => {
      const res = await fetch(href, {
        credentials: "include",
        // Cópia por tentativa — evita compartilhar Headers entre fetches paralelos.
        headers: opts?.headers ? new Headers(opts.headers) : undefined,
      });
      if (!res.ok) return false;
      const contentType = (res.headers.get("content-type") || "").toLowerCase();
      if (contentType.includes("application/json")) return false;
      const blob = await res.blob();
      const isVideo =
        preferVideo ||
        contentType.startsWith("video/") ||
        blob.type.startsWith("video/") ||
        /\.(mp4|webm|mov|mkv)$/i.test(ev.filename);
      const isImage =
        !isVideo &&
        (ev.type === "screenshot" ||
          contentType.startsWith("image/") ||
          blob.type.startsWith("image/") ||
          /\.(png|jpe?g|webp|gif)$/i.test(ev.filename));
      const limit = isVideo ? maxVideoBytes : maxImageBytes;
      if (blob.size > limit) {
        out[ev.fileId] = {
          kind: isVideo ? "video" : isImage ? "image" : "other",
          href,
        };
        return true;
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error ?? new Error("read fail"));
        reader.readAsDataURL(blob);
      });
      out[ev.fileId] = {
        kind: isVideo ? "video" : isImage ? "image" : "other",
        dataUrl,
        href,
      };
      return true;
    };

    try {
      if (await attempt()) return;
      // Uma nova tentativa (timeout/proxy sob carga).
      await new Promise((r) => setTimeout(r, 400));
      if (await attempt()) return;
      out[ev.fileId] = { kind: preferVideo ? "video" : "other", href };
    } catch {
      try {
        await new Promise((r) => setTimeout(r, 400));
        if (await attempt()) return;
      } catch {
        /* ignore */
      }
      out[ev.fileId] = { kind: preferVideo ? "video" : "other", href };
    }
  }

  for (let i = 0; i < evidence.length; i += concurrency) {
    const slice = evidence.slice(i, i + concurrency);
    await Promise.all(slice.map((ev) => loadOne(ev)));
  }
  return out;
}
