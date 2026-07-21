/** Limite do painel ao vivo (linhas). Histórico no servidor usa ~512 KB de texto. */
export const MAX_LIVE_MAESTRO_LINES = 5_000;

/** Corrige saída do Maestro no Windows (UTF-8 lido como Latin-1 / CP1252). */
export function normalizeMaestroOutput(text: string): string {
  let s = text.replace(/\r\n/g, "\n");

  if (/[\uFFFD]|Ã[£©ªº]|VersÃ|OpÃ|ColÃ|CARDÃ|Ã§|Ã£|Ã¡|Ã©/i.test(s)) {
    try {
      s = Buffer.from(s, "latin1").toString("utf8");
    } catch {
      /* mantém original */
    }
  }

  return s
    .replace(/\uFFFD/g, "")
    .replace(/Opao/gi, "Opção")
    .replace(/Versao:/g, "Versão:")
    .replace(/CARDAPIO/g, "CARDÁPIO")
    .replace(/Colgio/g, "Colégio");
}

/**
 * Vista limpa: fases qa-desk, flows, falhas/avisos.
 * Omite COMPLETED miúdo e agrupa SKIPPED consecutivos.
 */
export function curateMaestroLogLines(lines: string[]): string[] {
  const out: string[] = [];
  let skippedStreak = 0;

  const flushSkipped = () => {
    if (skippedStreak <= 0) return;
    out.push(
      skippedStreak === 1
        ? "  … 1 passo SKIPPED"
        : `  … ${skippedStreak} passos SKIPPED`,
    );
    skippedStreak = 0;
  };

  for (const raw of lines) {
    const t = raw.replace(/\u001b\[[0-9;]*m/g, "").replace(/\r/g, "").trim();
    if (!t) continue;
    if (/^={3,}/.test(t) || /Debug tests faster/i.test(t)) continue;

    if (/^\[qa-desk\]/i.test(t) || /^\[spawn error\]/i.test(t)) {
      flushSkipped();
      out.push(t);
      continue;
    }

    if (/^>\s*Flow\s+/i.test(t) || /^Running on\s+/i.test(t)) {
      flushSkipped();
      out.push(t);
      continue;
    }

    const run = /^\s*Run\s+(.+?)(?:\.\.\.\s*(COMPLETED|FAILED|SKIPPED|WARNED))?\s*$/i.exec(t);
    if (run) {
      flushSkipped();
      const flow = run[1].trim().replace(/\\/g, "/");
      const st = (run[2] ?? "").toUpperCase();
      const short = flow.split("/").pop() ?? flow;
      if (!st) {
        out.push(`▶ ${short}`);
      } else if (st === "FAILED") {
        out.push(`✗ ${short} — FAILED`);
      } else if (st === "WARNED") {
        out.push(`⚠ ${short} — WARNED`);
      } else if (st === "SKIPPED") {
        out.push(`⊘ ${short} — SKIPPED`);
      } else {
        out.push(`✓ ${short}`);
      }
      continue;
    }

    const step = /^\s*(.+?)\.\.\.\s*(COMPLETED|FAILED|WARNED|SKIPPED)\s*$/i.exec(t);
    if (step && !/^Run\s+/i.test(step[1].trim())) {
      const st = step[2].toUpperCase();
      if (st === "SKIPPED") {
        skippedStreak += 1;
        continue;
      }
      if (st === "COMPLETED") {
        // ruído miúdo (Tap/Assert) — só flush skip
        continue;
      }
      flushSkipped();
      const action = step[1].trim();
      out.push(st === "FAILED" ? `✗ ${action}` : `⚠ ${action}`);
      continue;
    }

    if (
      /Element not found|Assertion is false|Assertion '|Unknown Property|Flow path does not exist|FAILED|Error:|Exception/i.test(
        t,
      )
    ) {
      flushSkipped();
      out.push(t.length > 220 ? `${t.slice(0, 220)}…` : t);
      continue;
    }
  }

  flushSkipped();
  return out;
}
