/**
 * Massa brasileira para Ficha Acadêmica (massa-br).
 * Nome sempre prefixado com "QA Desk " para achar/limpar na amostra.
 */
import { createGenerator } from "massa-br";

export type AlunoCompleto = {
  seed: string;
  nome: string;
  nomeSocial: string;
  dataNascimento: string;
  sexoLabel: "Masculino" | "Feminino";
  cpf: string;
  cpfDigits: string;
  rg: string;
  estadoCivilLabel: string;
  grauInstrucaoLabel: string;
  observacao: string;
  /** CEP conhecido (ViaCEP) — SP */
  cep: string;
  numero: string;
  complemento: string;
  referencia: string;
  telefone: string;
  email: string;
  /** Labels de selects do aluno (se visíveis) */
  sexo: "M" | "F";
  racaLabel: string;
  tipoSanguineoLabel: string;
  fatorRhLabel: string;
  resideComLabel: string;
  nis: string;
  setor: string;
  cargo: string;
  diagnostico: string;
  detalhesMedicos: string;
};

function stampCurto(d = new Date()): string {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function isoToBr(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "15/03/2010";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function digits(v: string) {
  return v.replace(/\D/g, "");
}

/** Aluno demo completo — seed opcional (reproduzível). */
export function buildAlunoCompleto(seed?: string): AlunoCompleto {
  const stamp = stampCurto();
  const s = seed?.trim() || `qa-desk-ficha-${stamp}`;
  const gen = createGenerator(s);
  const pessoa = gen.pessoa({ mask: true }) as {
    nome: string;
    cpf: string;
    email: string;
    celular: string;
    nascimento: string;
  };

  const sexo: "M" | "F" = digits(pessoa.cpf).charCodeAt(0) % 2 === 0 ? "M" : "F";
  const cpfMasked = gen.cpf({ mask: true }) as string;
  const celular = (gen.celular("SP") as string) || pessoa.celular;

  return {
    seed: s,
    nome: `QA Desk ${pessoa.nome} ${stamp}`.slice(0, 70),
    nomeSocial: `Social ${stamp}`.slice(0, 70),
    dataNascimento: isoToBr(pessoa.nascimento || "2010-03-15"),
    sexo,
    sexoLabel: sexo === "M" ? "Masculino" : "Feminino",
    cpf: cpfMasked,
    cpfDigits: digits(cpfMasked),
    rg: String(10_000_000 + (Number(digits(cpfMasked).slice(0, 8)) % 80_000_000)),
    estadoCivilLabel: "Solteiro(a)",
    grauInstrucaoLabel: "Fundamental",
    observacao: `Gerado pelo QA Desk (${s}) — excluir após E2E.`,
    // Av. Paulista — ViaCEP estável
    cep: "01310-100",
    numero: String(100 + (Number(digits(cpfMasked).slice(-3)) % 800)),
    complemento: "Apto QA",
    referencia: "Próximo à estação Trianon",
    telefone: celular,
    email: `qadesk.${stamp}@example.com`,
    racaLabel: "Parda",
    tipoSanguineoLabel: "O",
    fatorRhLabel: "Positivo",
    resideComLabel: "Pai e Mãe",
    nis: digits(cpfMasked).slice(0, 11),
    setor: "Estudante",
    cargo: "Aluno",
    diagnostico: "Sem laudo — massa QA Desk",
    detalhesMedicos: "Preenchido automaticamente pelo Playwright.",
  };
}

/** Shape enxuto usado pelo smoke FICHA-01. */
export function buildAlunoDemo(agora = new Date()) {
  const full = buildAlunoCompleto(`qa-smoke-${agora.toISOString()}`);
  return {
    nome: full.nome,
    dataNascimento: full.dataNascimento,
    cpf: full.cpfDigits,
    email: full.email,
    telefone: digits(full.telefone),
  };
}
