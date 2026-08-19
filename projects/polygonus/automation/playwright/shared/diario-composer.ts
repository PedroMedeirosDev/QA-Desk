/**
 * Notas + Conteúdo e Frequência (APP WEB Flutter).
 * Semantics canônicos em polygonus-mobile/lib/diario_de_classe.
 *
 * Escopo padrão (env override):
 *   TURMA_DIARIO=M3A26
 *   DISCIPLINA_DIARIO=Historia|História
 *   ALUNO_DIARIO=Ana Carolina Teixeira de Menezes
 *   AVALIACAO_DIARIO=AV1
 */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import path from "node:path";
import {
  FLUTTER_IFRAME,
  dismissContinuarOverlay,
  dismissFlutterCloseOverlay,
  flutterFrameLocator,
  logMissingSemantics,
  tapFlutterByAccessibleName,
  tapFlutterSemId,
  tapFlutterSemIdCompact,
} from "./flutter-comunicados";
import { ensureFlutterHome } from "./chat-composer";

const LOG = "[diario-web]";

export function resolveTurmaDiario(): string {
  // Amostra: label exibido é M3A2026 (ano); atalho M3A26 não bate como substring.
  return process.env.TURMA_DIARIO?.trim() || "M3A2026";
}

export function resolveDisciplinaDiario(): RegExp {
  const raw = process.env.DISCIPLINA_DIARIO?.trim() || "Hist[oó]ria";
  return new RegExp(raw, "i");
}

export function resolveAlunoDiario(): RegExp {
  const raw =
    process.env.ALUNO_DIARIO?.trim() ||
    "Ana\\s+Carolina\\s+Teixeira\\s+de\\s+Menezes";
  return new RegExp(raw, "i");
}

export function resolveAvaliacaoDiario(): RegExp {
  const raw = process.env.AVALIACAO_DIARIO?.trim() || "AV\\s*1|AV1";
  return new RegExp(raw, "i");
}

/** Nota 0–10 distinta a cada run (inteiro). Override: NOTA_DIARIO=7,5 */
export function resolveNotaDiario(): string {
  const env = process.env.NOTA_DIARIO?.trim();
  if (env) return env.replace(".", ",");
  return String(Date.now() % 11);
}

export function textoConteudoCanal(canal: "Web" | "Mobile"): string {
  return `Conteudo teste (${canal})`;
}

export function textoTarefaCanal(canal: "Web" | "Mobile"): string {
  return `Tarefas teste (${canal})`;
}

export function fixturesDiarioRoot(playwrightRoot: string): string {
  return path.resolve(playwrightRoot, "../maestro/fixtures");
}

async function scrollHomeAteCard(page: Page, cardId: string): Promise<void> {
  const frame = flutterFrameLocator(page);
  const box = await page.locator(FLUTTER_IFRAME).first().boundingBox();
  if (!box) return;
  for (let i = 0; i < 6; i++) {
    if (
      (await frame.locator(`[flt-semantics-identifier="${cardId}"]`).count()) >
      0
    ) {
      return;
    }
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.55);
    await page.mouse.wheel(0, 380);
    await page.waitForTimeout(350);
  }
}

async function abrirCardHome(page: Page, cardId: string): Promise<void> {
  await ensureFlutterHome(page);
  await scrollHomeAteCard(page, cardId);
  if (!(await tapFlutterSemIdCompact(page, cardId))) {
    if (!(await tapFlutterSemId(page, cardId))) {
      throw new Error(`Card ${cardId} não encontrado na home`);
    }
  }
  await page.waitForTimeout(1_200);
}

/** Abre dropdown por id do campo e escolhe opção pelo label (item_*). */
async function escolherDropdown(
  page: Page,
  campoId: string,
  itemId: string,
  opcao: RegExp,
): Promise<void> {
  console.log(`${LOG} dropdown ${campoId} → ${opcao}`);
  if (!(await tapFlutterSemIdCompact(page, campoId))) {
    if (!(await tapFlutterSemId(page, campoId))) {
      throw new Error(`Dropdown ${campoId} não encontrado`);
    }
  }
  await page.waitForTimeout(600);

  const byItem = await tapFlutterSemIdComLabel(page, itemId, opcao);
  if (byItem) {
    await page.waitForTimeout(700);
    return;
  }
  // Lista longa: scroll no overlay e tenta de novo
  const box = await page.locator(FLUTTER_IFRAME).first().boundingBox();
  if (box) {
    for (let i = 0; i < 4; i++) {
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.45);
      await page.mouse.wheel(0, 220);
      await page.waitForTimeout(250);
      if (await tapFlutterSemIdComLabel(page, itemId, opcao)) {
        await page.waitForTimeout(700);
        return;
      }
      if (await tapFlutterByAccessibleName(page, opcao)) {
        await page.waitForTimeout(700);
        return;
      }
    }
  }
  if (!(await tapFlutterByAccessibleName(page, opcao))) {
    throw new Error(
      `Opção ${opcao} não encontrada (campo=${campoId} item=${itemId})`,
    );
  }
  await page.waitForTimeout(700);
}

/** Clique no nó com identifier + aria-label/flt-semantics-label matching. */
async function tapFlutterSemIdComLabel(
  page: Page,
  identifier: string,
  labelRe: RegExp,
): Promise<boolean> {
  const frame = flutterFrameLocator(page);
  const hit = await frame.locator("body").evaluate(
    (body, args) => {
      const re = new RegExp(args.source, args.flags);
      let best: { x: number; y: number; w: number; h: number; area: number } | null =
        null;
      const walk = (node: Node | null) => {
        if (!node) return;
        if (node instanceof Element) {
          const id = node.getAttribute("flt-semantics-identifier") || "";
          if (id === args.id) {
            const label =
              node.getAttribute("aria-label") ||
              node.getAttribute("flt-semantics-label") ||
              (node as HTMLElement).innerText ||
              "";
            if (re.test(label)) {
              const r = node.getBoundingClientRect();
              const area = r.width * r.height;
              if (r.width >= 8 && r.height >= 8 && area < 400_000) {
                if (!best || area < best.area) {
                  best = { x: r.x, y: r.y, w: r.width, h: r.height, area };
                }
              }
            }
          }
          if (node.shadowRoot) walk(node.shadowRoot);
          for (const c of Array.from(node.children)) walk(c);
        }
      };
      walk(body);
      return best;
    },
    { id: identifier, source: labelRe.source, flags: labelRe.flags || "i" },
  );
  if (!hit) return false;
  const box = await page.locator(FLUTTER_IFRAME).first().boundingBox();
  if (!box) return false;
  await page.mouse.click(box.x + hit.x + hit.w / 2, box.y + hit.y + hit.h / 2);
  return true;
}

/**
 * Achado o tile do aluno (mesmo id em várias linhas), devolve o id do campo
 * de nota na mesma altura: `notas_aluno_<i>`.
 */
async function resolveCampoNotaAluno(
  page: Page,
  alunoRe: RegExp,
): Promise<string> {
  const frame = flutterFrameLocator(page);
  const campoId = await frame.locator("body").evaluate(
    (body, args) => {
      const re = new RegExp(args.source, args.flags);
      type NodeInfo = { id: string; label: string; y: number };
      const nodes: NodeInfo[] = [];
      const walk = (node: Node | null) => {
        if (!node) return;
        if (node instanceof Element) {
          const id = node.getAttribute("flt-semantics-identifier") || "";
          if (id) {
            const label =
              node.getAttribute("aria-label") ||
              node.getAttribute("flt-semantics-label") ||
              "";
            const r = node.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) {
              nodes.push({ id, label, y: r.y + r.height / 2 });
            }
          }
          if (node.shadowRoot) walk(node.shadowRoot);
          for (const c of Array.from(node.children)) walk(c);
        }
      };
      walk(body);
      const aluno = nodes.find(
        (n) => n.id === "notas_aluno_item" && re.test(n.label),
      );
      if (!aluno) return null;
      const campos = nodes
        .filter((n) => /^notas_aluno_\d+$/.test(n.id))
        .sort((a, b) => Math.abs(a.y - aluno.y) - Math.abs(b.y - aluno.y));
      return campos[0]?.id ?? null;
    },
    { source: alunoRe.source, flags: alunoRe.flags || "i" },
  );
  if (!campoId) {
    throw new Error(`Aluno ${alunoRe} / campo notas_aluno_* não encontrado`);
  }
  return campoId;
}

async function resolveFrequenciaCheckAluno(
  page: Page,
  alunoRe: RegExp,
): Promise<string> {
  const frame = flutterFrameLocator(page);
  const checkId = await frame.locator("body").evaluate(
    (body, args) => {
      const re = new RegExp(args.source, args.flags);
      type NodeInfo = { id: string; label: string; y: number };
      const nodes: NodeInfo[] = [];
      const walk = (node: Node | null) => {
        if (!node) return;
        if (node instanceof Element) {
          const id = node.getAttribute("flt-semantics-identifier") || "";
          if (id) {
            const label =
              node.getAttribute("aria-label") ||
              node.getAttribute("flt-semantics-label") ||
              "";
            const r = node.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) {
              nodes.push({ id, label, y: r.y + r.height / 2 });
            }
          }
          if (node.shadowRoot) walk(node.shadowRoot);
          for (const c of Array.from(node.children)) walk(c);
        }
      };
      walk(body);
      const aluno = nodes.find(
        (n) => n.id === "diario_aluno_item" && re.test(n.label),
      );
      if (!aluno) return null;
      const checks = nodes
        .filter((n) => /^frequencia_aluno_\d+$/.test(n.id))
        .sort((a, b) => Math.abs(a.y - aluno.y) - Math.abs(b.y - aluno.y));
      return checks[0]?.id ?? null;
    },
    { source: alunoRe.source, flags: alunoRe.flags || "i" },
  );
  if (!checkId) {
    throw new Error(
      `Aluno ${alunoRe} / check frequencia_aluno_* não encontrado`,
    );
  }
  return checkId;
}

async function preencherTextFieldId(
  page: Page,
  id: string,
  texto: string,
): Promise<void> {
  if (!(await tapFlutterSemIdCompact(page, id))) {
    if (!(await tapFlutterSemId(page, id))) {
      throw new Error(`Campo ${id} não encontrado`);
    }
  }
  await page.waitForTimeout(400);
  // Flutter WEB: precisa foco real + onChanged para DirtyController
  await page.keyboard.press("Control+A").catch(() => undefined);
  await page.keyboard.press("Backspace").catch(() => undefined);
  await page.keyboard.type(texto, { delay: 40 });
  await page.keyboard.press("Tab").catch(() => undefined);
  await page.waitForTimeout(500);
}

/** Confirma o diálogo "Selecione o horário" (AulaDropdown). */
async function confirmarHorarioAula(page: Page): Promise<void> {
  const frame = flutterFrameLocator(page);
  const dialogVisivel = async () =>
    (await frame.getByText(/Selecione o hor[aá]rio/i).count()) > 0 ||
    (await page.getByText(/Selecione o hor[aá]rio/i).count()) > 0;

  if (!(await dialogVisivel())) {
    // tenta abrir
    await tapFlutterSemIdCompact(page, "frequencia_aula");
    await page.waitForTimeout(700);
  }

  await expect
    .poll(async () => dialogVisivel(), {
      timeout: 10_000,
      message: "Diálogo Selecione o horário não abriu",
    })
    .toBe(true);

  // Já vem um item destacado (ex. 14/ago - 3ª aula) — só OK
  const ok =
    (await tapFlutterByAccessibleName(page, /^OK$/i)) ||
    (await frame.getByRole("button", { name: /^OK$/i }).click().then(() => true).catch(() => false));
  if (!ok) {
    await page.getByRole("button", { name: /^OK$/i }).click({ timeout: 5_000 });
  }
  await page.waitForTimeout(800);
}

async function anexarViaConteudoAnexo(
  page: Page,
  filePath: string,
): Promise<void> {
  console.log(`${LOG} anexar ${path.basename(filePath)}`);
  const chooserPromise = page.waitForEvent("filechooser", { timeout: 20_000 });
  if (!(await tapFlutterSemId(page, "conteudo_anexo"))) {
    if (!(await tapFlutterByAccessibleName(page, /Inserir Anexo/i))) {
      throw new Error("conteudo_anexo / Inserir Anexo não encontrado");
    }
  }
  const chooser = await chooserPromise.catch(() => null);
  if (!chooser) {
    throw new Error(
      "filechooser não abriu em conteudo_anexo (APP WEB — anotar Semantics se falhar de novo)",
    );
  }
  await chooser.setFiles(filePath);
  await page.waitForTimeout(2_000);
}

/**
 * CT Notas: home → Notas → turma → disciplina → AV1 → nota na Ana → enviar.
 * Retorna a nota lançada (para log/assert).
 */
export async function lancarNotaHistoria(
  page: Page,
  opts?: { nota?: string },
): Promise<string> {
  const turma = resolveTurmaDiario();
  const disciplina = resolveDisciplinaDiario();
  const aluno = resolveAlunoDiario();
  const avaliacao = resolveAvaliacaoDiario();
  const nota = opts?.nota ?? resolveNotaDiario();

  console.log(
    `${LOG} notas turma=${turma} disc=${disciplina} aluno=${aluno} aval=${avaliacao} nota=${nota}`,
  );

  await abrirCardHome(page, "home_card_notas");
  await expect
    .poll(
      async () =>
        (await flutterFrameLocator(page)
          .locator('[flt-semantics-identifier="notas_turma"]')
          .count()) > 0,
      { timeout: 25_000, message: "Tela Notas (notas_turma) não abriu" },
    )
    .toBe(true);

  await logMissingSemantics(
    page,
    [
      "notas_turma",
      "notas_disciplina",
      "notas_avaliacao",
      "notas_enviar",
      "notas_aluno_item",
    ],
    LOG,
  );

  await escolherDropdown(page, "notas_turma", "notas_turma_item", new RegExp(turma, "i"));
  await escolherDropdown(page, "notas_disciplina", "notas_disciplina_item", disciplina);
  await escolherDropdown(page, "notas_avaliacao", "notas_avaliacao_item", avaliacao);

  await page.waitForTimeout(1_000);
  const campoId = await resolveCampoNotaAluno(page, aluno);
  console.log(`${LOG} campo nota = ${campoId}`);
  // Garante dirty: se já tinha a mesma nota, troca e volta
  const alt = nota === "0" ? "1" : "0";
  await preencherTextFieldId(page, campoId, alt);
  await preencherTextFieldId(page, campoId, nota);

  // FAB só existe com DirtyController.isDirty
  await expect
    .poll(
      async () => {
        if (await tapFlutterSemId(page, "notas_enviar")) return true;
        if (await tapFlutterByAccessibleName(page, /^Enviar$/i)) return true;
        if (
          await tapFlutterByAccessibleName(
            page,
            /Enviar lan[cç]amentos para o servidor/i,
          )
        ) {
          return true;
        }
        return (
          (await flutterFrameLocator(page)
            .locator('[flt-semantics-identifier="notas_enviar"]')
            .count()) > 0
        );
      },
      {
        timeout: 12_000,
        message:
          "notas_enviar não apareceu (dirty?) — digitação pode não ter disparado onChanged",
      },
    )
    .toBe(true);

  if (!(await tapFlutterSemId(page, "notas_enviar"))) {
    if (!(await tapFlutterByAccessibleName(page, /^Enviar$/i))) {
      throw new Error("notas_enviar não encontrado após dirty");
    }
  }
  await page.waitForTimeout(2_000);
  console.log(`${LOG} nota enviada (${nota})`);
  return nota;
}

/**
 * CT Conteúdo e Frequência: turma/disciplina → falta na Ana → conteúdo+tarefa+PDF+vídeo.
 */
export async function lancarConteudoEFrequencia(
  page: Page,
  playwrightRoot: string,
  canal: "Web" | "Mobile" = "Web",
): Promise<void> {
  const turma = resolveTurmaDiario();
  const disciplina = resolveDisciplinaDiario();
  const aluno = resolveAlunoDiario();
  const fixtures = fixturesDiarioRoot(playwrightRoot);
  const pdfPath = path.join(fixtures, "PDF_TESTE.pdf");
  const videoPath = path.join(fixtures, "Video_teste.mp4");
  const textoConteudo = textoConteudoCanal(canal);
  const textoTarefa = textoTarefaCanal(canal);

  console.log(
    `${LOG} freq+conteudo turma=${turma} disc=${disciplina} aluno=${aluno} canal=${canal}`,
  );

  await abrirCardHome(page, "home_card_conteudo_frequencia");
  await expect
    .poll(
      async () =>
        (await flutterFrameLocator(page)
          .locator('[flt-semantics-identifier="frequencia_turma"]')
          .count()) > 0,
      {
        timeout: 25_000,
        message: "Tela Conteúdo e Frequência (frequencia_turma) não abriu",
      },
    )
    .toBe(true);

  await logMissingSemantics(
    page,
    [
      "frequencia_turma",
      "frequencia_disciplina",
      "frequencia_aula",
      "frequencia_materia",
      "diario_aluno_item",
    ],
    LOG,
  );

  await escolherDropdown(
    page,
    "frequencia_turma",
    "frequencia_turma_item",
    new RegExp(turma, "i"),
  );
  await escolherDropdown(
    page,
    "frequencia_disciplina",
    "frequencia_disciplina_item",
    disciplina,
  );

  // Data/aula abre dialog "Selecione o horário" → OK
  await confirmarHorarioAula(page);

  // Lista de alunos pode precisar scroll até a Ana
  const box = await page.locator(FLUTTER_IFRAME).first().boundingBox();
  if (box) {
    for (let i = 0; i < 3; i++) {
      const found = await flutterFrameLocator(page)
        .locator("body")
        .evaluate(
          (body, source) => {
            const re = new RegExp(source, "i");
            const walk = (node: Node | null): boolean => {
              if (!node) return false;
              if (node instanceof Element) {
                const label =
                  node.getAttribute("aria-label") ||
                  node.getAttribute("flt-semantics-label") ||
                  "";
                if (re.test(label)) return true;
                if (node.shadowRoot && walk(node.shadowRoot)) return true;
                for (const c of Array.from(node.children)) {
                  if (walk(c)) return true;
                }
              }
              return false;
            };
            return walk(body);
          },
          aluno.source,
        );
      if (found) break;
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.7);
      await page.mouse.wheel(0, 280);
      await page.waitForTimeout(300);
    }
  }

  const checkId = await resolveFrequenciaCheckAluno(page, aluno);
  console.log(`${LOG} marcar falta = ${checkId}`);
  if (!(await tapFlutterSemId(page, checkId))) {
    throw new Error(`Não conseguiu tocar ${checkId}`);
  }
  await page.waitForTimeout(800);

  // Abre tela Conteúdo / Tarefas
  if (!(await tapFlutterSemId(page, "frequencia_materia"))) {
    if (
      !(await tapFlutterByAccessibleName(
        page,
        /Conte[uú]do|Lecionado|Tarefa/i,
      ))
    ) {
      throw new Error("frequencia_materia não abriu");
    }
  }
  await page.waitForTimeout(1_000);

  await expect
    .poll(
      async () =>
        (await flutterFrameLocator(page)
          .locator('[flt-semantics-identifier="conteudo_descricao"]')
          .count()) > 0,
      { timeout: 15_000, message: "conteudo_descricao não apareceu" },
    )
    .toBe(true);

  await preencherTextFieldId(page, "conteudo_descricao", textoConteudo);
  await preencherTextFieldId(page, "conteudo_tarefa", textoTarefa);

  await anexarViaConteudoAnexo(page, pdfPath);
  await anexarViaConteudoAnexo(page, videoPath);

  if (!(await tapFlutterSemId(page, "conteudo_confirmar"))) {
    if (!(await tapFlutterByAccessibleName(page, /^Confirmar$/i))) {
      throw new Error("conteudo_confirmar não encontrado");
    }
  }
  await page.waitForTimeout(2_000);

  const frame = flutterFrameLocator(page);
  await dismissContinuarOverlay(page, frame);
  await dismissFlutterCloseOverlay(page, frame);
  console.log(`${LOG} conteúdo+frequência ok`);
}
