/**
 * Helpers de preenchimento da Ficha Acadêmica (aba Dados Principais).
 */
import type { Locator, Page } from "@playwright/test";
import type { AlunoCompleto } from "../fixtures/massa";

export type CampoKey =
  | "nome"
  | "nomeSocial"
  | "dataNascimento"
  | "sexo"
  | "cpf"
  | "rg"
  | "estadoCivil"
  | "grauInstrucao"
  | "observacao"
  | "cep"
  | "numero"
  | "complemento"
  | "referencia"
  | "telefone"
  | "email"
  | "raca"
  | "tipoSanguineo"
  | "fatorRh"
  | "nis"
  | "setor"
  | "cargo"
  | "diagnostico";

function digits(v: string) {
  return v.replace(/\D/g, "");
}

export function inputAposLabel(page: Page, labelRe: RegExp): Locator {
  return page
    .locator("label")
    .filter({ hasText: labelRe })
    .locator(
      "xpath=following-sibling::*//input | following-sibling::input | following-sibling::*//textarea | following-sibling::textarea | following-sibling::*//select | following-sibling::select",
    );
}

export function selectAposLabel(page: Page, labelRe: RegExp): Locator {
  return page
    .locator("label")
    .filter({ hasText: labelRe })
    .locator("xpath=following-sibling::*//select | following-sibling::select");
}

async function fillVerified(
  el: Locator,
  value: string,
  logLabel: string,
): Promise<boolean> {
  const ph = ((await el.getAttribute("placeholder").catch(() => "")) ?? "").toLowerCase();
  if (ph.includes("buscar pessoa")) {
    console.log(`[ficha] skip AppLookup conversão (${logLabel})`);
    return false;
  }
  try {
    await el.scrollIntoViewIfNeeded();
    await el.click({ timeout: 5_000 });
    await el.fill("");
    await el.fill(value);
    await el.press("Tab").catch(() => undefined);
    const got = await el.inputValue().catch(() => "");
    const ok =
      got === value ||
      digits(got) === digits(value) ||
      (digits(value).length >= 6 && digits(got).includes(digits(value))) ||
      got.includes(value.slice(0, Math.min(12, value.length)));
    if (!ok) {
      console.log(`[ficha] ${logLabel} divergiu got="${got}" want="${value}"`);
      return false;
    }
    console.log(`[ficha] preencheu ${logLabel}`);
    return true;
  } catch (err) {
    console.log(
      `[ficha] ${logLabel} falhou:`,
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

async function selectByLabelText(
  page: Page,
  labelRe: RegExp,
  optionLabel: string,
  logLabel: string,
): Promise<boolean> {
  const sel = selectAposLabel(page, labelRe).first();
  if (!(await sel.isVisible({ timeout: 2_000 }).catch(() => false))) {
    console.log(`[ficha] pulou ${logLabel} (select não visível)`);
    return false;
  }
  try {
    await sel.scrollIntoViewIfNeeded();
    await sel.selectOption({ label: optionLabel });
    console.log(`[ficha] selecionou ${logLabel}=${optionLabel}`);
    return true;
  } catch (err) {
    // tenta por value parcial / primeira opção útil
    try {
      const opts = await sel.locator("option").allTextContents();
      const hit = opts.find(
        (o) =>
          o.trim() === optionLabel ||
          o.toLowerCase().includes(optionLabel.toLowerCase()),
      );
      if (hit) {
        await sel.selectOption({ label: hit.trim() });
        console.log(`[ficha] selecionou ${logLabel}=${hit.trim()} (fuzzy)`);
        return true;
      }
    } catch {
      /* fallthrough */
    }
    console.log(
      `[ficha] ${logLabel} falhou:`,
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

export async function clickAba(page: Page, nome: string | RegExp) {
  const tab = page
    .getByRole("tab", { name: nome })
    .or(page.locator('[role="tab"]').filter({ hasText: nome }))
    .first();
  await tab.click({ timeout: 15_000 });
}

export async function preencherDadosPessoa(
  page: Page,
  dados: AlunoCompleto,
): Promise<{ filled: CampoKey[]; campos: Partial<Record<CampoKey, Locator>> }> {
  const filled: CampoKey[] = [];
  const campos: Partial<Record<CampoKey, Locator>> = {};

  const nome = page.getByPlaceholder("Nome completo", { exact: true }).first();
  if (await nome.isVisible({ timeout: 8_000 }).catch(() => false)) {
    if (await fillVerified(nome, dados.nome, "Nome")) {
      filled.push("nome");
      campos.nome = nome;
    }
  }

  const nomeSocial = inputAposLabel(page, /^Nome social$/i).first();
  if (await nomeSocial.isVisible({ timeout: 2_000 }).catch(() => false)) {
    if (await fillVerified(nomeSocial, dados.nomeSocial, "Nome social")) {
      filled.push("nomeSocial");
      campos.nomeSocial = nomeSocial;
    }
  }

  const dn = inputAposLabel(page, /Data de nascimento/i).first();
  if (await dn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    if (await fillVerified(dn, dados.dataNascimento, "Data Nascimento")) {
      filled.push("dataNascimento");
      campos.dataNascimento = dn;
    }
  }

  if (await selectByLabelText(page, /^Sexo$/i, dados.sexoLabel, "Sexo")) {
    filled.push("sexo");
  }

  const cpf = page.getByPlaceholder("000.000.000-00").first();
  if (await cpf.isVisible({ timeout: 3_000 }).catch(() => false)) {
    if (await fillVerified(cpf, dados.cpf, "CPF")) {
      filled.push("cpf");
      campos.cpf = cpf;
    }
  }

  const rg = inputAposLabel(page, /^R\.?G\.?$/i).first();
  if (await rg.isVisible({ timeout: 2_000 }).catch(() => false)) {
    if (await fillVerified(rg, dados.rg, "RG")) {
      filled.push("rg");
      campos.rg = rg;
    }
  }

  if (
    await selectByLabelText(
      page,
      /^Estado civil$/i,
      dados.estadoCivilLabel,
      "Estado civil",
    )
  ) {
    filled.push("estadoCivil");
  }

  if (
    await selectByLabelText(
      page,
      /Grau de instrução/i,
      dados.grauInstrucaoLabel,
      "Grau instrução",
    )
  ) {
    filled.push("grauInstrucao");
  }

  const obs = page
    .locator("label")
    .filter({ hasText: /^Observação$/i })
    .locator("xpath=following-sibling::*//textarea | following-sibling::textarea")
    .first();
  if (await obs.isVisible({ timeout: 2_000 }).catch(() => false)) {
    if (await fillVerified(obs, dados.observacao, "Observação")) {
      filled.push("observacao");
      campos.observacao = obs;
    }
  }

  return { filled, campos };
}

export async function preencherDadosAluno(
  page: Page,
  dados: AlunoCompleto,
): Promise<CampoKey[]> {
  const filled: CampoKey[] = [];

  // Selects condicionais (filtro_campo) — fail-soft
  if (await selectByLabelText(page, /^Raça$/i, dados.racaLabel, "Raça")) {
    filled.push("raca");
  }
  if (
    await selectByLabelText(
      page,
      /Tipo sanguíneo/i,
      dados.tipoSanguineoLabel,
      "Tipo sanguíneo",
    )
  ) {
    filled.push("tipoSanguineo");
  }
  if (
    await selectByLabelText(page, /Fator RH/i, dados.fatorRhLabel, "Fator RH")
  ) {
    filled.push("fatorRh");
  }

  // Reside com — tenta label; se falhar, primeira opção não vazia
  const reside = selectAposLabel(page, /Reside com/i).first();
  if (await reside.isVisible({ timeout: 1_500 }).catch(() => false)) {
    try {
      const opts = await reside.locator("option").allTextContents();
      const hit =
        opts.find((o) => /pais|pai|mãe|mae|ambos/i.test(o)) ||
        opts.find((o) => o.trim() && !/não informado|—|^$/i.test(o.trim()));
      if (hit) {
        await reside.selectOption({ label: hit.trim() });
        console.log(`[ficha] selecionou Reside com=${hit.trim()}`);
      }
    } catch {
      console.log("[ficha] pulou Reside com");
    }
  }

  const nis = inputAposLabel(page, /^N\.?I\.?S\.?$/i).first();
  if (await nis.isVisible({ timeout: 1_500 }).catch(() => false)) {
    if (await fillVerified(nis, dados.nis, "NIS")) filled.push("nis");
  }

  return filled;
}

export async function preencherEndereco(
  page: Page,
  dados: AlunoCompleto,
): Promise<CampoKey[]> {
  const filled: CampoKey[] = [];

  const cep = page.getByPlaceholder("00000-000").first();
  if (await cep.isVisible({ timeout: 5_000 }).catch(() => false)) {
    if (await fillVerified(cep, dados.cep, "CEP")) {
      filled.push("cep");
      await cep.blur();
      // ViaCEP
      await page
        .getByText(/Buscando CEP/i)
        .waitFor({ state: "hidden", timeout: 8_000 })
        .catch(() => undefined);
      await page.waitForTimeout(800);
    }
  }

  const numero = inputAposLabel(page, /^Número$/i).first();
  if (await numero.isVisible({ timeout: 2_000 }).catch(() => false)) {
    if (await fillVerified(numero, dados.numero, "Número")) filled.push("numero");
  }

  const complemento = inputAposLabel(page, /^Complemento$/i).first();
  if (await complemento.isVisible({ timeout: 1_500 }).catch(() => false)) {
    if (await fillVerified(complemento, dados.complemento, "Complemento")) {
      filled.push("complemento");
    }
  }

  const referencia = inputAposLabel(page, /^Referência$/i).first();
  if (await referencia.isVisible({ timeout: 1_500 }).catch(() => false)) {
    if (await fillVerified(referencia, dados.referencia, "Referência")) {
      filled.push("referencia");
    }
  }

  // Se ViaCEP não preencheu logradouro, completa manualmente
  const logradouro = inputAposLabel(page, /^Logradouro$/i).first();
  if (await logradouro.isVisible({ timeout: 1_500 }).catch(() => false)) {
    const v = await logradouro.inputValue().catch(() => "");
    if (!v.trim()) {
      await fillVerified(logradouro, "Avenida Paulista", "Logradouro");
    }
  }

  return filled;
}

export async function preencherContatos(
  page: Page,
  dados: AlunoCompleto,
): Promise<CampoKey[]> {
  const filled: CampoKey[] = [];

  const secao = page.locator("section, div").filter({ hasText: /^Contatos$/ }).first();
  // botão Contato no card
  const add = page.getByRole("button", { name: /^Contato$/i }).first();

  const nenhum = page.getByText(/Nenhum contato/i);
  if (await nenhum.isVisible({ timeout: 2_000 }).catch(() => false)) {
    if (await add.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await add.click({ timeout: 5_000 });
    }
  }

  const tel = page.getByPlaceholder("(00) 00000-0000").first();
  if (await tel.isVisible({ timeout: 5_000 }).catch(() => false)) {
    if (await fillVerified(tel, digits(dados.telefone), "Telefone")) {
      filled.push("telefone");
    }
  }

  // 2º contato: e-mail — muda Tipo antes de preencher
  if (await add.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await add.click({ timeout: 5_000 });
    const selects = page.locator("select").filter({
      has: page.locator('option:text-is("E-mail")'),
    });
    const tipoEmail = selects.last();
    if (await tipoEmail.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await tipoEmail.selectOption({ label: "E-mail" });
      await page.waitForTimeout(300);
      const email = page.getByPlaceholder("email@dominio.com.br").first();
      if (await email.isVisible({ timeout: 3_000 }).catch(() => false)) {
        if (await fillVerified(email, dados.email, "E-mail")) {
          filled.push("email");
        }
      }
    } else {
      console.log("[ficha] pulou E-mail (select Tipo não achado)");
    }
  }

  void secao;
  return filled;
}

export async function preencherProfissionais(
  page: Page,
  dados: AlunoCompleto,
): Promise<CampoKey[]> {
  const filled: CampoKey[] = [];
  const setor = inputAposLabel(page, /^Setor$/i).first();
  if (await setor.isVisible({ timeout: 2_000 }).catch(() => false)) {
    if (await fillVerified(setor, dados.setor, "Setor")) filled.push("setor");
  }
  const cargo = inputAposLabel(page, /^Cargo$/i).first();
  if (await cargo.isVisible({ timeout: 1_500 }).catch(() => false)) {
    if (await fillVerified(cargo, dados.cargo, "Cargo")) filled.push("cargo");
  }
  return filled;
}

export async function preencherAvaliacaoMedica(
  page: Page,
  dados: AlunoCompleto,
): Promise<CampoKey[]> {
  const filled: CampoKey[] = [];
  const diag = inputAposLabel(page, /^Diagnóstico$/i).first();
  if (await diag.isVisible({ timeout: 2_000 }).catch(() => false)) {
    if (await fillVerified(diag, dados.diagnostico, "Diagnóstico")) {
      filled.push("diagnostico");
    }
  }
  const detalhes = page
    .locator("label")
    .filter({ hasText: /Detalhes do caso/i })
    .locator("xpath=following-sibling::*//textarea | following-sibling::textarea")
    .first();
  if (await detalhes.isVisible({ timeout: 1_500 }).catch(() => false)) {
    await fillVerified(detalhes, dados.detalhesMedicos, "Detalhes médicos");
  }
  return filled;
}

/** Fill completo da aba Dados Principais (sem Gravar). */
export async function preencherAlunoCompleto(
  page: Page,
  dados: AlunoCompleto,
): Promise<{ filled: CampoKey[]; campos: Partial<Record<CampoKey, Locator>> }> {
  const a = await preencherDadosPessoa(page, dados);
  const b = await preencherDadosAluno(page, dados);
  const c = await preencherAvaliacaoMedica(page, dados);
  const d = await preencherEndereco(page, dados);
  const e = await preencherContatos(page, dados);
  const f = await preencherProfissionais(page, dados);

  return {
    filled: [...a.filled, ...b, ...c, ...d, ...e, ...f],
    campos: a.campos,
  };
}

/** Smoke enxuto (compat FICHA-01). */
export async function preencherAlunoDemo(
  page: Page,
  dados: { nome: string; dataNascimento: string; cpf: string; telefone: string },
): Promise<{ filled: CampoKey[]; campos: Partial<Record<CampoKey, Locator>> }> {
  const filled: CampoKey[] = [];
  const campos: Partial<Record<CampoKey, Locator>> = {};

  const nome = page.getByPlaceholder("Nome completo", { exact: true }).first();
  if (await nome.isVisible({ timeout: 8_000 }).catch(() => false)) {
    if (await fillVerified(nome, dados.nome, "Nome")) {
      filled.push("nome");
      campos.nome = nome;
    }
  }

  const dn = inputAposLabel(page, /Data de nascimento/i).first();
  if (await dn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    if (await fillVerified(dn, dados.dataNascimento, "Data Nascimento")) {
      filled.push("dataNascimento");
      campos.dataNascimento = dn;
    }
  }

  const cpf = page.getByPlaceholder("000.000.000-00").first();
  if (await cpf.isVisible({ timeout: 3_000 }).catch(() => false)) {
    if (await fillVerified(cpf, dados.cpf, "CPF")) {
      filled.push("cpf");
      campos.cpf = cpf;
    }
  }

  const nenhum = page.getByText(/Nenhum contato/i);
  if (await nenhum.isVisible({ timeout: 2_000 }).catch(() => false)) {
    const add = page.getByRole("button", { name: /^Contato$/i });
    if (await add.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await add.click({ timeout: 5_000 });
      const tel = page.getByPlaceholder("(00) 00000-0000").first();
      if (await tel.isVisible({ timeout: 5_000 }).catch(() => false)) {
        if (await fillVerified(tel, digits(dados.telefone), "Telefone")) {
          filled.push("telefone");
          campos.telefone = tel;
        }
      }
    }
  }

  return { filled, campos };
}

export async function gravarAluno(page: Page) {
  const gravar = page.getByRole("button", { name: /^Gravar$/i }).first();
  await gravar.click({ timeout: 15_000 });
  await page
    .getByText(/Aluno gravado/i)
    .waitFor({ state: "visible", timeout: 60_000 })
    .catch(() => undefined);
  await page.waitForURL(/\/academico\/alunos\/\d+/i, { timeout: 60_000 });
}

/**
 * Exclui o aluno aberto na ficha (escopo "tudo").
 * No-op se botão Excluir não existir. Respeita PLAYWRIGHT_FICHA_KEEP=1.
 */
export async function excluirAlunoSeAberto(page: Page, logPrefix = "[ficha]") {
  if (process.env.PLAYWRIGHT_FICHA_KEEP === "1") {
    console.log(`${logPrefix} PLAYWRIGHT_FICHA_KEEP=1 — não exclui`);
    return;
  }
  const excluir = page.getByRole("button", { name: /^Excluir$/i }).first();
  if (!(await excluir.isVisible({ timeout: 5_000 }).catch(() => false))) {
    console.log(`${logPrefix} Excluir não visível — URL=${page.url()}`);
    return;
  }
  await excluir.click();
  const dialog = page.getByRole("dialog").or(page.locator('[role="alertdialog"]'));
  await dialog.waitFor({ state: "visible", timeout: 10_000 }).catch(() => undefined);
  const tudo = page.getByText(/De todos os cadastros/i).first();
  if (await tudo.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await tudo.click();
  }
  const confirmar = page
    .getByRole("button", { name: /^Excluir$/i })
    .last();
  await confirmar.click({ timeout: 10_000 });
  await page
    .getByText(/excluíd/i)
    .waitFor({ state: "visible", timeout: 45_000 })
    .catch(() => undefined);
  console.log(`${logPrefix} aluno excluído (cleanup)`);
}

/** Seleciona 1ª opção clicável numa lista CampoSelecaoAcademica. */
export async function selecionarPrimeiraOpcaoAcademica(
  page: Page,
  label: string,
  campoId?: string,
): Promise<string | undefined> {
  let card: Locator;
  if (campoId) {
    const anyInput = page.locator(`[id^="${campoId}-"]`).first();
    card = anyInput.locator(
      "xpath=ancestor::*[@data-campo-selecao-card='true'][1]",
    );
    if (!(await card.isVisible({ timeout: 5_000 }).catch(() => false))) {
      card = page
        .locator("[data-campo-selecao-card='true']")
        .filter({ hasText: new RegExp(label.replace(/\s*\*$/, ""), "i") })
        .first();
    }
  } else {
    card = page
      .locator("[data-campo-selecao-card='true']")
      .filter({ hasText: new RegExp(label.replace(/\s*\*$/, ""), "i") })
      .first();
  }

  if (!(await card.isVisible({ timeout: 5_000 }).catch(() => false))) {
    console.log(`[ficha] matrícula ${label}: card não encontrado`);
    return undefined;
  }
  return selecionarNoCard(card, label);
}

async function selecionarNoCard(
  card: Locator,
  label: string,
): Promise<string | undefined> {
  const empty = card.getByText(/Sem opções|Carregando/i);
  if (await empty.isVisible({ timeout: 800 }).catch(() => false)) {
    console.log(`[ficha] matrícula ${label}: ${(await empty.textContent())?.trim()}`);
    return undefined;
  }
  const firstOpt = card
    .locator("label")
    .filter({ hasNotText: /Todos|Todas|Filtrar/i })
    .first();
  if (await firstOpt.isVisible({ timeout: 3_000 }).catch(() => false)) {
    const text = ((await firstOpt.textContent()) || "").replace(/\s+/g, " ").trim();
    await firstOpt.click();
    console.log(`[ficha] matrícula ${label} → ${text}`);
    return text || undefined;
  }
  console.log(`[ficha] matrícula ${label}: nenhuma opção`);
  return undefined;
}

export async function exercitarCascataMatricula(page: Page) {
  await clickAba(page, /Matrícula/i);
  await page
    .getByText(/Nova matrícula|Alterar matrícula|Matrículas de/i)
    .first()
    .waitFor({ state: "visible", timeout: 30_000 });

  const passos: Array<{ label: string; id: string }> = [
    { label: "Curso", id: "matr-curso" },
    { label: "Grade *", id: "matr-grade" },
    { label: "Período *", id: "matr-periodo" },
    { label: "Turma", id: "matr-turma" },
    { label: "Turno *", id: "matr-turno" },
  ];
  for (const p of passos) {
    await selecionarPrimeiraOpcaoAcademica(page, p.label, p.id);
    await page.waitForTimeout(500);
  }
}
