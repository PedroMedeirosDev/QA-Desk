/**
 * Probe de sessão — monitora JWT, renovação legado e redirect para login.
 * Usado pelos specs em legado/ (histórico escolar, biblioteca…).
 */
import type { Page } from "@playwright/test";
import { menuGeral } from "./gestao-auth";

export type SessaoProbeEvento = {
  at: number;
  kind: string;
  url: string;
  status?: number;
  method?: string;
};

export type SessaoProbeStats = {
  startedAt: number;
  tokenRefresh: number;
  renovarLegado: number;
  auth401: number;
  acropoly: number;
  loginRedirects: number;
  eventos: SessaoProbeEvento[];
};

const MAX_EVENTOS = 40;

function pushEvento(stats: SessaoProbeStats, ev: SessaoProbeEvento) {
  stats.eventos.push(ev);
  if (stats.eventos.length > MAX_EVENTOS) stats.eventos.shift();
}

export function installSessaoProbe(page: Page): SessaoProbeStats {
  const stats: SessaoProbeStats = {
    startedAt: Date.now(),
    tokenRefresh: 0,
    renovarLegado: 0,
    auth401: 0,
    acropoly: 0,
    loginRedirects: 0,
    eventos: [],
  };

  page.on("response", (res) => {
    const url = res.url();
    const status = res.status();
    const method = res.request().method();

    if (/\/auth\/token/i.test(url)) {
      stats.tokenRefresh++;
      pushEvento(stats, { at: Date.now(), kind: "auth/token", url, status, method });
    }
    if (/renovar_sessao_legado/i.test(url)) {
      stats.renovarLegado++;
      pushEvento(stats, {
        at: Date.now(),
        kind: "renovar_sessao_legado",
        url,
        status,
        method,
      });
    }
    if (status === 401) {
      stats.auth401++;
      pushEvento(stats, { at: Date.now(), kind: "401", url, status, method });
    }
    if (/acropolymodule\.dll/i.test(url)) {
      stats.acropoly++;
      if (status >= 400) {
        pushEvento(stats, {
          at: Date.now(),
          kind: "acropoly-erro",
          url: url.slice(0, 180),
          status,
          method,
        });
      }
    }
  });

  page.on("framenavigated", (frame) => {
    if (frame !== page.mainFrame()) return;
    const url = frame.url();
    if (/\/gestao\/login|\/login\b/i.test(url)) {
      stats.loginRedirects++;
      pushEvento(stats, { at: Date.now(), kind: "redirect-login", url });
    }
  });

  return stats;
}

export function formatProbeStats(stats: SessaoProbeStats, elapsedMin: number) {
  const linhas = [
    `[sessao-probe] +${elapsedMin.toFixed(1)} min`,
  ];
  linhas.push(
    `  token=${stats.tokenRefresh} renovarLegado=${stats.renovarLegado} 401=${stats.auth401} acropoly=${stats.acropoly} loginRedirect=${stats.loginRedirects}`,
  );
  const recentes = stats.eventos.slice(-5);
  if (recentes.length) {
    linhas.push("  últimos eventos:");
    for (const ev of recentes) {
      const st = ev.status != null ? ` ${ev.status}` : "";
      linhas.push(`    - ${ev.kind}${st} ${ev.url.slice(0, 120)}`);
    }
  }
  return linhas.join("\n");
}

export async function sessaoAindaViva(page: Page): Promise<boolean> {
  const url = page.url();
  if (/\/gestao\/login|\/login\b/i.test(url)) return false;
  const legado = page.locator(
    'iframe[src*="acropolymodule"], iframe[src*="/acropoly/"]',
  );
  if (await legado.first().isVisible().catch(() => false)) return true;
  if (await menuGeral(page).isVisible().catch(() => false)) return true;
  return page
    .getByText(/Histórico escolar|Biblioteca|Obra|Acervo|Notas/i)
    .first()
    .isVisible()
    .catch(() => false);
}

export function probeMinutos(): number {
  const raw = process.env.PLAYWRIGHT_SESSAO_PROBE_MIN?.trim();
  const n = raw ? Number(raw) : 30;
  return Number.isFinite(n) && n > 0 ? n : 30;
}

export function probeTickSegundos(): number {
  const raw = process.env.PLAYWRIGHT_SESSAO_PROBE_TICK_SEC?.trim();
  const n = raw ? Number(raw) : 60;
  return Number.isFinite(n) && n > 0 ? n : 60;
}

/** Aluna padrão da massa CQ (notas parciais / diário). */
export function resolveAlunoProbe(): string {
  return (
    process.env.PLAYWRIGHT_ALUNO_HIST?.trim() ||
    process.env.ALUNO_DIARIO?.trim() ||
    "Ana Carolina Teixeira de Menezes"
  );
}

/** Busca aluno na ListaAlunos (React) e abre a ficha. */
export async function buscarAlunoNaLista(
  page: Page,
  nome: string,
  logPrefix: string,
) {
  const reNome = new RegExp(nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const termo =
    process.env.PLAYWRIGHT_ALUNO_BUSCA?.trim() ||
    (nome.length > 24 ? nome.slice(0, 24) : nome);

  const busca = page
    .getByPlaceholder(/buscar|pesquisar|procurar|nome do aluno|aluno/i)
    .or(page.getByRole("searchbox"))
    .or(page.locator('input[type="search"]'))
    .first();

  if (await busca.isVisible({ timeout: 15_000 }).catch(() => false)) {
    await busca.click();
    await busca.fill("");
    await busca.pressSequentially(termo, { delay: 45 });
    await page.waitForTimeout(1_500);
    console.log(`${logPrefix} buscou "${termo}"`);
  } else {
    console.log(
      `${logPrefix} aviso: campo de busca não visível — procura o nome na lista`,
    );
  }

  const linha = page
    .getByRole("row", { name: reNome })
    .or(page.getByRole("button", { name: reNome }))
    .or(page.getByText(reNome))
    .first();

  await linha.waitFor({ state: "visible", timeout: 45_000 });
  await linha.click();
  console.log(`${logPrefix} aluno selecionado: ${nome}`);
}

/** Espera N minutos logando snapshot; falha se cair para login. */
export async function aguardarProbeIdle(
  page: Page,
  stats: SessaoProbeStats,
  logPrefix: string,
) {
  const totalMin = probeMinutos();
  const tickSec = probeTickSegundos();
  const fim = Date.now() + totalMin * 60_000;

  console.log(
    `${logPrefix} probe idle por ${totalMin} min (tick ${tickSec}s) — PLAYWRIGHT_SESSAO_PROBE_MIN para mudar`,
  );

  while (Date.now() < fim) {
    await page.waitForTimeout(tickSec * 1000);
    const elapsedMin = (Date.now() - stats.startedAt) / 60_000;
    console.log(formatProbeStats(stats, elapsedMin));

    const viva = await sessaoAindaViva(page);
    if (!viva) {
      throw new Error(
        `${logPrefix} sessão caiu após ${elapsedMin.toFixed(1)} min (redirect login ou shell sumiu)`,
      );
    }
  }

  const elapsedMin = (Date.now() - stats.startedAt) / 60_000;
  console.log(
    `${logPrefix} probe concluído — ${elapsedMin.toFixed(1)} min sem logout. ` +
      `token=${stats.tokenRefresh} renovarLegado=${stats.renovarLegado}`,
  );
}
