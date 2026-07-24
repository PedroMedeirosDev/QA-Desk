import type {
  KbCurationMetrics,
  KbCurationRecord,
  KbCurationStatus,
  KbCurationVerdict,
} from "@/types/kb-curation";
import { maskPii } from "@/lib/redact-pii";

const STATUS_LABELS: Record<KbCurationStatus, string> = {
  aguardando_revisao: "Aguardando revisão",
  aguardando_correcao: "Aguardando correção",
  aguardando_rerevisao: "Respondida (re-revisar)",
  aprovada: "Aprovada",
  mesclada: "Mesclada",
  bloqueada: "Bloqueada",
  fechada: "Fechada (sem merge)",
  pendente: "Aguardando revisão",
  em_revisao: "Aguardando revisão",
};

const VERDICT_LABELS: Record<KbCurationVerdict, string> = {
  aprovavel: "Aprovável",
  precisa_correcao: "Precisa correção",
  bloqueado: "Bloqueado",
  inconclusivo: "Inconclusivo",
};

function esc(value: string): string {
  return maskPii(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? esc(url.href) : "#";
  } catch {
    return "#";
  }
}

function fmtDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function latestActivity(record: KbCurationRecord): string | undefined {
  return (
    record.history.at(-1)?.at ??
    record.githubUpdatedAt ??
    record.reviewedAt ??
    record.lastSyncedAt
  );
}

function statusClass(status: KbCurationStatus): string {
  if (status === "mesclada" || status === "aprovada") return "ok";
  if (status === "bloqueada") return "fail";
  if (status === "fechada") return "muted";
  if (status === "aguardando_rerevisao") return "attention";
  if (status === "aguardando_correcao") return "warning";
  return "pending";
}

function automaticConclusion(metrics: KbCurationMetrics): string {
  if (metrics.awaitingRereview > 0) {
    return `${metrics.awaitingRereview} PR(s) receberam retorno do autor e precisam de nova revisão.`;
  }
  if (metrics.blocked > 0) {
    return `${metrics.blocked} PR(s) estão bloqueadas e exigem acompanhamento.`;
  }
  if (metrics.awaitingCorrection > 0) {
    return `${metrics.awaitingCorrection} PR(s) aguardam correções solicitadas na revisão.`;
  }
  if (metrics.awaitingReview > 0) {
    return `${metrics.awaitingReview} PR(s) ainda aguardam a primeira revisão.`;
  }
  if (metrics.closedUnmerged > 0) {
    return `${metrics.closedUnmerged} PR(s) foram fechadas no GitHub sem merge.`;
  }
  return "Todo o escopo registrado foi aprovado ou mesclado.";
}

export function computeKbCurationReportMetrics(
  records: KbCurationRecord[],
): KbCurationMetrics {
  const statusOf = (record: KbCurationRecord): KbCurationStatus =>
    record.status === "pendente" || record.status === "em_revisao"
      ? "aguardando_revisao"
      : record.status;
  const count = (status: KbCurationStatus) =>
    records.filter((record) => statusOf(record) === status).length;
  const approved = count("aprovada");
  const merged = count("mesclada");

  return {
    total: records.length,
    awaitingReview: count("aguardando_revisao"),
    awaitingCorrection: count("aguardando_correcao"),
    awaitingRereview: count("aguardando_rerevisao"),
    approved,
    merged,
    blocked: count("bloqueada"),
    closedUnmerged: count("fechada"),
    completionPercent:
      records.length > 0
        ? Math.round(((approved + merged) / records.length) * 100)
        : 0,
  };
}

/** Ex.: Curadoria-KB-2026-07-21_17-47.html */
export function kbCurationReportFilename(emittedAt: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = [
    emittedAt.getFullYear(),
    pad(emittedAt.getMonth() + 1),
    pad(emittedAt.getDate()),
  ].join("-");
  const time = `${pad(emittedAt.getHours())}-${pad(emittedAt.getMinutes())}`;
  return `Curadoria-KB-${stamp}_${time}.html`;
}

export function buildKbCurationHtmlReport(
  records: KbCurationRecord[],
  metrics: KbCurationMetrics,
  opts?: {
    repository?: string;
    author?: string;
    generatedAt?: string;
    scopeLabel?: string;
  },
): string {
  const generatedAt = opts?.generatedAt ?? new Date().toISOString();
  const repository =
    opts?.repository ?? records[0]?.repository ?? "polygonus-br/polygonus-suporte-kb";
  const author = opts?.author ?? "Pedro Medeiros (QA)";
  const scopeLabel = opts?.scopeLabel ?? "Todas as situações";
  const rows = [...records]
    .sort((a, b) => a.prNumber - b.prNumber)
    .map((record) => {
      const corrections =
        record.corrections && record.corrections.length > 0
          ? `<ul>${record.corrections.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`
          : `<span class="muted">Nenhuma correção pendente registrada.</span>`;

      return `
        <article class="pr-card">
          <div class="pr-head">
            <div>
              <a class="pr-link" href="${safeUrl(record.url)}" target="_blank" rel="noreferrer">
                PR #${record.prNumber} — ${esc(record.title)}
              </a>
              <div class="meta">
                GitHub: ${esc(record.githubState)} · Última atividade: ${esc(fmtDate(latestActivity(record)))}
                ${record.reviewer ? ` · Responsável: ${esc(record.reviewer)}` : ""}
              </div>
            </div>
            <div class="status-wrap">
              <span class="badge ${statusClass(record.status)}">${esc(STATUS_LABELS[record.status])}</span>
              <span class="verdict">${esc(VERDICT_LABELS[record.verdict])}</span>
            </div>
          </div>
          <div class="details">
            <div>
              <h3>Correções / pendências</h3>
              ${corrections}
            </div>
          </div>
        </article>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Relatório de Curadoria KB — ${esc(repository)}</title>
  <style>
    :root {
      --bg: #0f1419;
      --card: #1a222c;
      --border: #2a3542;
      --text: #e7ecf1;
      --muted: #91a0b2;
      --accent: #38bdf8;
      --ok: #34d399;
      --warning: #fbbf24;
      --attention: #fb923c;
      --fail: #f87171;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 2rem 1.25rem 3rem;
      background: var(--bg);
      color: var(--text);
      font-family: "Segoe UI", system-ui, sans-serif;
      line-height: 1.5;
    }
    .wrap { max-width: 1040px; margin: 0 auto; }
    h1 { margin: 0; font-size: 1.6rem; }
    h2 { margin: 1.75rem 0 .75rem; color: var(--accent); font-size: 1.05rem; }
    h3 { margin: 0 0 .3rem; color: var(--muted); font-size: .72rem; text-transform: uppercase; letter-spacing: .05em; }
    p { margin: 0; }
    a { color: var(--accent); }
    .subtitle, .meta, .muted, footer { color: var(--muted); }
    .subtitle { margin-top: .35rem; font-size: .9rem; }
    .summary {
      margin-top: 1.4rem;
      padding: 1rem 1.1rem;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--card);
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(125px, 1fr));
      gap: .7rem;
      margin-top: 1rem;
    }
    .metric {
      padding: .8rem .9rem;
      border: 1px solid var(--border);
      border-radius: 9px;
      background: var(--card);
    }
    .metric-label { color: var(--muted); font-size: .68rem; text-transform: uppercase; letter-spacing: .04em; }
    .metric-value { margin-top: .15rem; font-size: 1.35rem; font-weight: 700; font-variant-numeric: tabular-nums; }
    .pr-list { display: grid; gap: .8rem; }
    .pr-card {
      break-inside: avoid;
      padding: 1rem;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--card);
    }
    .pr-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
    .pr-link { font-weight: 650; text-decoration: none; }
    .pr-link:hover { text-decoration: underline; }
    .meta { margin-top: .3rem; font-size: .76rem; }
    .status-wrap { display: flex; flex-direction: column; align-items: flex-end; gap: .25rem; flex-shrink: 0; }
    .badge { padding: .22rem .55rem; border: 1px solid; border-radius: 999px; font-size: .72rem; font-weight: 650; white-space: nowrap; }
    .badge.ok { color: var(--ok); border-color: #34d39966; background: #34d39918; }
    .badge.warning { color: var(--warning); border-color: #fbbf2466; background: #fbbf2418; }
    .badge.attention { color: var(--attention); border-color: #fb923c66; background: #fb923c18; }
    .badge.fail { color: var(--fail); border-color: #f8717166; background: #f8717118; }
    .badge.muted { color: #a1a1aa; border-color: #71717a66; background: #71717a18; }
    .badge.pending { color: var(--accent); border-color: #38bdf866; background: #38bdf818; }
    .verdict { color: var(--muted); font-size: .72rem; }
    .details { margin-top: .8rem; padding-top: .8rem; border-top: 1px solid var(--border); font-size: .86rem; }
    ul { margin: .15rem 0 0; padding-left: 1.1rem; }
    footer { margin-top: 2rem; font-size: .75rem; }
    @media (max-width: 700px) {
      .pr-head { flex-direction: column; }
      .status-wrap { align-items: flex-start; }
    }
    @media print {
      body { background: #fff; color: #111; padding: .6rem; }
      .metric, .summary, .pr-card { background: #fff; border-color: #ccc; }
      .subtitle, .meta, .muted, footer, .verdict, h3 { color: #555; }
      .pr-link, h2 { color: #0369a1; }
    }
  </style>
</head>
<body>
  <main class="wrap">
    <h1>Relatório de Curadoria da Base de Conhecimento</h1>
    <p class="subtitle">
      Repositório: <strong>${esc(repository)}</strong> · Gerado em ${esc(fmtDate(generatedAt))} · ${esc(author)}
      <br />Escopo: <strong>${esc(scopeLabel)}</strong> · ${records.length} PR(s)
    </p>

    <section class="summary">
      <strong>Situação atual</strong>
      <p style="margin-top:.35rem">${esc(automaticConclusion(metrics))}</p>
    </section>

    <section class="metrics" aria-label="Métricas">
      <div class="metric"><div class="metric-label">Escopo</div><div class="metric-value">${metrics.total}</div></div>
      <div class="metric"><div class="metric-label">Aguardando revisão</div><div class="metric-value">${metrics.awaitingReview}</div></div>
      <div class="metric"><div class="metric-label">Correções</div><div class="metric-value">${metrics.awaitingCorrection}</div></div>
      <div class="metric"><div class="metric-label">Re-revisar</div><div class="metric-value">${metrics.awaitingRereview}</div></div>
      <div class="metric"><div class="metric-label">Aprovadas</div><div class="metric-value">${metrics.approved}</div></div>
      <div class="metric"><div class="metric-label">Mescladas</div><div class="metric-value">${metrics.merged}</div></div>
      <div class="metric"><div class="metric-label">Bloqueadas</div><div class="metric-value">${metrics.blocked}</div></div>
      <div class="metric"><div class="metric-label">Fechadas</div><div class="metric-value">${metrics.closedUnmerged}</div></div>
      <div class="metric"><div class="metric-label">Conclusão</div><div class="metric-value">${metrics.completionPercent}%</div></div>
    </section>

    <h2>Situação por Pull Request</h2>
    <section class="pr-list">
      ${rows || `<p class="muted">Nenhuma PR registrada.</p>`}
    </section>

    <footer>
      QA Desk · relatório autônomo gerado a partir do estado registrado na Curadoria KB.
      Os títulos das PRs levam diretamente ao GitHub.
    </footer>
  </main>
</body>
</html>`;
}
