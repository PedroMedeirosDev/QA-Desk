/**
 * Contrato de campos do CT (caso de teste).
 *
 * Usado pela qa-desk (corretor / API) e como spec para IA ou N8N ao gerar fluxos.
 * Regra de ouro: description ≠ preconditions ≠ expectedResult.
 */

export type CtDraftFields = {
  title?: string;
  description?: string;
  preconditions?: string;
  expectedResult?: string;
  /** Resumo enxuto */
  steps?: string[];
  flowPath?: string;
  module?: string;
};

export type CtFieldWarning = {
  code:
    | "description_has_precondition"
    | "missing_preconditions"
    | "missing_expected_result"
    | "missing_description"
    | "missing_steps"
    | "missing_title";
  message: string;
};

export type NormalizeCtFieldsResult = {
  fields: Required<
    Pick<
      CtDraftFields,
      "title" | "description" | "preconditions" | "expectedResult" | "steps"
    >
  > &
    Pick<CtDraftFields, "flowPath" | "module">;
  warnings: CtFieldWarning[];
  fixed: string[];
};

/** Rótulos: Pré-requisito / Pre-requisito / Precondition / Requisito */
const PRECOND_LABEL = "(?:Pr[eé]-?requisitos?|Pre-?conditions?|Requisitos?)";
const PRECOND_IN_DESC = new RegExp(
  `(?:^|[.\\n])\\s*${PRECOND_LABEL}\\s*:\\s*(.+)\$`,
  "isu",
);
const PRECOND_INLINE = new RegExp(`\\s*${PRECOND_LABEL}\\s*:\\s*(.+)\$`, "iu");
const PRECOND_MENTION = new RegExp(PRECOND_LABEL, "i");

function trim(s: string | undefined): string {
  return (s ?? "").trim();
}

/**
 * Extrai trecho "Pré-requisito: …" da descrição e devolve { description, extracted }.
 */
export function splitPreconditionsFromDescription(description: string): {
  description: string;
  extracted: string;
} {
  const raw = trim(description);
  if (!raw) return { description: "", extracted: "" };

  const match = raw.match(PRECOND_IN_DESC);
  if (!match) {
    const inline = raw.match(PRECOND_INLINE);
    if (!inline || inline.index == null) return { description: raw, extracted: "" };
    const extracted = trim(inline[1]);
    const descriptionClean = trim(raw.slice(0, inline.index));
    return {
      description: descriptionClean.replace(/[.\s]+$/u, "").trim() || descriptionClean,
      extracted,
    };
  }

  const extracted = trim(match[1]);
  const descriptionClean = trim(raw.slice(0, match.index) + raw.slice(match.index! + match[0].length));
  return {
    description: descriptionClean.replace(/[.\s]+$/u, "").trim() || descriptionClean,
    extracted,
  };
}

function mergeParagraphs(a: string, b: string): string {
  const left = trim(a);
  const right = trim(b);
  if (!left) return right;
  if (!right) return left;
  if (left.includes(right) || right.includes(left)) return left.length >= right.length ? left : right;
  return `${left} ${right}`.replace(/\s+/g, " ").trim();
}

/** Valida rascunho sem mutar (só avisos). */
export function validateCtFields(input: CtDraftFields): CtFieldWarning[] {
  const warnings: CtFieldWarning[] = [];
  if (!trim(input.title)) {
    warnings.push({ code: "missing_title", message: "Título vazio." });
  }
  if (!trim(input.description)) {
    warnings.push({
      code: "missing_description",
      message: "Descrição vazia — deve explicar o objetivo do teste, sem pré-requisitos.",
    });
  } else if (PRECOND_MENTION.test(input.description ?? "")) {
    warnings.push({
      code: "description_has_precondition",
      message: "Descrição contém pré-requisito — mover para o campo Pré-condições.",
    });
  }
  if (!trim(input.preconditions)) {
    warnings.push({
      code: "missing_preconditions",
      message: "Pré-condições vazias — estado do app/dados necessário antes de executar.",
    });
  }
  if (!trim(input.expectedResult)) {
    warnings.push({
      code: "missing_expected_result",
      message: "Resultado esperado vazio — o que deve ser verdade ao final do CT.",
    });
  }
  if (!(input.steps?.filter((s) => trim(s)).length)) {
    warnings.push({
      code: "missing_steps",
      message: "Lista de passos vazia.",
    });
  }
  return warnings;
}

/**
 * Normaliza campos do CT: separa pré-requisito da descrição e aponta lacunas.
 * Não inventa resultado esperado — só avisa se faltar (IA/N8N ou humano preenche).
 */
export function normalizeCtFields(input: CtDraftFields): NormalizeCtFieldsResult {
  const fixed: string[] = [];
  let description = trim(input.description);
  let preconditions = trim(input.preconditions);

  const split = splitPreconditionsFromDescription(description);
  if (split.extracted) {
    description = split.description;
    preconditions = mergeParagraphs(preconditions, split.extracted);
    fixed.push("Pré-requisito removido da descrição → Pré-condições");
  }

  if (PRECOND_MENTION.test(description)) {
    const again = splitPreconditionsFromDescription(description);
    if (again.extracted) {
      description = again.description;
      preconditions = mergeParagraphs(preconditions, again.extracted);
      fixed.push("Segundo trecho de pré-requisito movido");
    }
  }

  const fields: NormalizeCtFieldsResult["fields"] = {
    title: trim(input.title),
    description,
    preconditions,
    expectedResult: trim(input.expectedResult),
    steps: (input.steps ?? []).map((s) => trim(s)).filter(Boolean),
    flowPath: input.flowPath,
    module: input.module,
  };

  return {
    fields,
    warnings: validateCtFields(fields),
    fixed,
  };
}

/** Prompt curto para LLM / nó AI no N8N. */
export const CT_FIELDS_LLM_SYSTEM_PROMPT = `Você gera metadados de caso de teste (CT) para QA mobile (Polygonus / Maestro).

Campos OBRIGATÓRIOS e disjuntos:
- title: nome curto do CT
- description: só o OBJETIVO do teste (o que valida). NUNCA inclua "Pré-requisito".
- preconditions: estado necessário ANTES de rodar (dados, perfil, fixtures, sessão)
- expectedResult: o que deve ser verdade AO FINAL (UI, lista, tela)
- steps: array de ações humanas RESUMIDAS (atalho QA), uma por item, sem numeração
- stepsDetailed (opcional, fora deste JSON mínimo): mesmo fluxo em detalhe + âncoras Maestro

Responda APENAS JSON válido no schema CtDraftFields.
Não misture pré-condição na description. Se expectedResult for incerto, escreva a melhor hipótese observável na UI.`;

/** Exemplo de payload para webhook N8N de geração. */
export const CT_DRAFT_EXAMPLE: CtDraftFields = {
  title: "Mural — editar comunicado",
  description:
    "Edita o comunicado mais recente em Enviadas e valida o texto novo na lista.",
  preconditions:
    "Ao menos 1 comunicado em Enviadas; sessão PHJESUS com perfil Coordenador.",
  expectedResult:
    "Texto “Teste Comunicado editado CT02” visível em Enviadas.",
  steps: [
    "Abrir Enviadas como coordenador",
    "Menu ⋮ do card mais recente → Editar",
    "Substituir texto e enviar",
    "Confirmar texto novo na lista",
  ],
  flowPath:
    "projects/polygonus/automation/maestro/flows/mural/01_1_comunicado_editar.yaml",
  module: "Comunicados",
};
