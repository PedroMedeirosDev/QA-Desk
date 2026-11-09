/**
 * Classificação de capturas (print/texto → bug, sugestão, demanda…).
 * A IA externa (Grok, xAI) só recebe texto depois de filtrarParaIaExterna — nunca a imagem.
 * Sem XAI_API_KEY cai nas regras locais. A decisão final é sempre do dono (botões no Slack).
 */
import { redactPii } from "./privacy/redact-pii.js";

export const TIPOS_CAPTURA = ["bug", "sugestao", "demanda", "duvida", "configuracao"] as const;
export type TipoCaptura = (typeof TIPOS_CAPTURA)[number];

export const TIPO_CAPTURA_LABELS: Record<TipoCaptura, string> = {
  bug: "Bug",
  sugestao: "Sugestão",
  demanda: "Demanda",
  duvida: "Dúvida de uso",
  configuracao: "Configuração",
};

export type Classificacao = {
  tipo: TipoCaptura;
  titulo: string;
  resumo: string;
  confianca: number;
  motivo: string;
  fonte: "ia" | "regras";
};

export const DEFINICOES_TIPOS = `Classifique o relato em UM tipo:
- bug: o sistema faz algo DIFERENTE do que deveria (erro, cálculo errado, tela quebrada, dado que some ou duplica). Exemplo: tarifa arredondada diferente do extrato; miniatura do vídeo não aparece.
- sugestao: o sistema funciona como foi feito, mas poderia ser melhor (melhoria, ideia, recurso novo). Exemplo: deixar a data da tarefa opcional.
- demanda: alguém pede um TRABALHO a ser feito, com dono e de preferência prazo (investigar, refazer, responder, homologar, treinar). Exemplo: refazer os lançamentos contábeis de uma unidade.
- duvida: o usuário não sabe usar algo que funciona. Exemplo: "onde fica a conciliação?".
- configuracao: funciona, mas está configurado errado no cliente. Exemplo: conta de cartão sem ajuste configurado.
Desempate bug × sugestão: existe regra, manual ou comportamento anterior dizendo que deveria ser diferente? Sim → bug; não → sugestao.
Se o relato traz um defeito E um pedido de trabalho, escolha o que motivou a mensagem e cite o outro no motivo.`;

/** Nomes de produto que podem aparecer capitalizados sem ser pessoa/escola. */
const TERMOS_PRODUTO = new Set(
  [
    "polygonus", "mural", "rotina", "diário", "diario", "chat", "portal", "gestão", "gestao", "financeiro",
    "contabilidade", "conciliação", "conciliacao", "bancária", "bancaria", "boleto", "boletos", "pix", "getnet",
    "santander", "android", "ios", "app", "web", "qa", "desk", "slack", "discord", "comunicado", "comunicados",
    "evento", "eventos", "tarefa", "tarefas", "frequência", "frequencia", "notas", "acadêmico", "academico",
    "plano", "categorias", "relatório", "relatorio", "extrato", "cartão", "cartao", "versão", "versao",
  ].map((t) => t.normalize("NFC")),
);

/** Começam frase com maiúscula sem ser nome. */
const PALAVRAS_DE_FRASE = new Set([
  "no", "na", "nos", "nas", "o", "a", "os", "as", "em", "de", "do", "da", "para", "pra", "com", "sem", "pelo", "pela",
  "hoje", "ontem", "amanhã", "agora", "ainda", "depois", "antes", "quando", "se", "mas", "e", "ou", "um", "uma",
  "segundo", "porque", "como", "onde", "também", "já", "então", "aqui", "ali", "esse", "essa", "este", "esta",
]);

const PALAVRA_MAIUSCULA = String.raw`\p{Lu}[\p{Ll}\p{M}]+`;
const SEQUENCIA_NOMES = new RegExp(
  String.raw`(?<![\p{L}\p{N}])${PALAVRA_MAIUSCULA}(?:\s+(?:(?:de|da|do|das|dos|e)\s+)?${PALAVRA_MAIUSCULA})+`,
  "gu",
);

function termosExtras(): string[] {
  return (process.env.IA_OCULTAR_TERMOS ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
}

function escaparRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Filtro rígido antes de qualquer IA externa: além de CPF/CNPJ/telefone/e-mail,
 * oculta links, nomes (sequências capitalizadas, menções, saudações, autor de chat),
 * valores, números longos e os termos de IA_OCULTAR_TERMOS.
 */
export function filtrarParaIaExterna(texto: string, extras: string[] = termosExtras()): string {
  let out = redactPii(texto.normalize("NFC"));
  out = out.replace(/https?:\/\/[^\s<>"')\]]+/g, "[LINK]");
  for (const termo of extras) out = out.replace(new RegExp(escaparRegex(termo), "giu"), "[OCULTO]");
  out = out.replace(/R\$\s*[\d.,]+/g, "[VALOR]");
  out = out.replace(/@[\p{L}][\p{L}\p{N}._-]*/gu, "[NOME]");
  out = out.replace(
    /((?:Oi|Olá|Ola|Bom dia|Boa tarde|Boa noite|Obrigad[oa]|Prezad[oa])[,!]?\s+)\p{Lu}[\p{Ll}\p{M}]+/gu,
    "$1[NOME]",
  );
  out = out.replace(SEQUENCIA_NOMES, (seq) => {
    // "No Discord", "Hoje Moacir": a palavra comum do início da frase fica; o resto é avaliado.
    const [primeira, ...resto] = seq.split(/\s+/);
    const inicio = PALAVRAS_DE_FRASE.has(primeira.toLowerCase()) ? `${primeira} ` : "";
    const candidatas = (inicio ? resto : [primeira, ...resto]).filter((p) => !/^(de|da|do|das|dos|e)$/.test(p));
    if (candidatas.every((p) => TERMOS_PRODUTO.has(p.toLowerCase()))) return seq;
    return `${inicio}[NOME]`;
  });
  out = out.replace(/^(\s*)\p{Lu}[\p{Ll}\p{M}]+(?=\s+\d{1,2}:\d{2}\b)/gmu, "$1[NOME]");
  out = out.replace(/\d{5,}/g, "[NUM]");
  return out.slice(0, 4000);
}

const REGRAS: Array<[TipoCaptura, RegExp]> = [
  ["bug", /\b(erro|bug|falh|quebr|trav|n[aã]o (funciona|aparece|carrega|abre|salva)|incorret|errad|diverg|duplic|sumiu|exception)/giu],
  ["sugestao", /\b(sugest|seria bom|poderia|melhori|ideia|que tal|gostaria que|opcional|implementar|novo recurso)/giu],
  ["duvida", /\b(como fa[çz]|onde fica|onde encontr|d[uú]vida|consigo|existe (uma|alguma) forma)/giu],
  ["demanda", /\b(preciso que|pode (fazer|ver|rodar|verificar)|por favor|at[eé] (amanh[aã]|sexta|segunda|dia)|prazo|verificar|refazer|homolog|treinamento)/giu],
  ["configuracao", /\b(configur|par[aâ]metr|permiss[aã]o|habilitar|desabilitar)/giu],
];

export function tituloCurto(texto: string, max = 80): string {
  const linha = texto.split("\n").map((l) => l.trim()).find((l) => l.length >= 4) ?? "";
  return linha.length > max ? `${linha.slice(0, max - 1).trimEnd()}…` : linha;
}

/** Fallback sem IA: conta indícios de cada tipo; empate ou nada → demanda. */
export function classificarPorRegras(texto: string): Classificacao {
  const pontos = REGRAS.map(([tipo, re]) => [tipo, texto.match(re)?.length ?? 0] as const);
  const [tipo, n] = pontos.reduce((melhor, atual) => (atual[1] > melhor[1] ? atual : melhor), ["demanda", 0] as const);
  return {
    tipo,
    titulo: tituloCurto(texto),
    resumo: "",
    confianca: n === 0 ? 0.2 : Math.min(0.6, 0.3 + n * 0.1),
    motivo: n === 0 ? "Sem indícios claros: confira o tipo." : `Regras locais: ${n} indício(s) de ${TIPO_CAPTURA_LABELS[tipo].toLowerCase()}.`,
    fonte: "regras",
  };
}

/** Resposta do Grok (JSON do esquema) → Classificacao; qualquer desvio → null. */
export function interpretarRespostaIa(conteudo: string): Classificacao | null {
  try {
    const j = JSON.parse(conteudo) as Record<string, unknown>;
    if (!TIPOS_CAPTURA.includes(j.tipo as TipoCaptura)) return null;
    const titulo = String(j.titulo ?? "").trim();
    if (!titulo) return null;
    const confianca = Number(j.confianca);
    return {
      tipo: j.tipo as TipoCaptura,
      titulo: titulo.slice(0, 100),
      resumo: String(j.resumo ?? "").trim().slice(0, 400),
      confianca: Number.isFinite(confianca) ? Math.max(0, Math.min(1, confianca)) : 0.5,
      motivo: String(j.motivo ?? "").trim().slice(0, 300),
      fonte: "ia",
    };
  } catch {
    return null;
  }
}

const ESQUEMA = {
  type: "object",
  properties: {
    tipo: { type: "string", enum: [...TIPOS_CAPTURA] },
    titulo: { type: "string", description: "Título curto em português, até 80 caracteres" },
    resumo: { type: "string", description: "Uma ou duas frases em português" },
    confianca: { type: "number", description: "0 a 1" },
    motivo: { type: "string", description: "Por que esse tipo, em uma frase" },
  },
  required: ["tipo", "titulo", "resumo", "confianca", "motivo"],
  additionalProperties: false,
};

async function classificarComGrok(textoFiltrado: string, chave: string): Promise<Classificacao | null> {
  const resp = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${chave}` },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      model: process.env.XAI_MODEL?.trim() || "grok-4.7",
      messages: [
        {
          role: "system",
          content: `Você organiza o trabalho de um QA de software educacional. ${DEFINICOES_TIPOS}\nDados sensíveis já foram ocultados como [NOME], [CPF], [VALOR], [LINK]: não tente deduzi-los e não os repita no título.`,
        },
        { role: "user", content: textoFiltrado },
      ],
      response_format: { type: "json_schema", json_schema: { name: "classificacao", schema: ESQUEMA, strict: true } },
    }),
  });
  if (!resp.ok) throw new Error(`xAI respondeu ${resp.status}`);
  const j = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return interpretarRespostaIa(j.choices?.[0]?.message?.content ?? "");
}

/** Classifica com o Grok quando há XAI_API_KEY; falha ou resposta inválida → regras locais. */
export async function classificarTexto(texto: string): Promise<Classificacao> {
  const filtrado = filtrarParaIaExterna(texto);
  const chave = process.env.XAI_API_KEY?.trim();
  if (chave && filtrado.trim()) {
    try {
      const ia = await classificarComGrok(filtrado, chave);
      if (ia) return ia;
      console.warn("[classificacao] resposta do Grok fora do esquema; usando regras");
    } catch (err) {
      console.warn("[classificacao] Grok indisponível; usando regras:", err instanceof Error ? err.message : err);
    }
  }
  return { ...classificarPorRegras(filtrado), titulo: tituloCurto(filtrado) || tituloCurto(texto) };
}

/** Pedido no canal de revisão: só texto já filtrado + formato que o QA Desk sabe ler. */
export function pedidoRevisao(textoFiltrado: string, tipo: TipoCaptura, tituloFiltrado: string): string {
  const citado = textoFiltrado
    .slice(0, 1500)
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");
  return [
    "*Revisão pedida pelo QA Desk* (texto já sem dados pessoais)",
    `Proposta: *${TIPO_CAPTURA_LABELS[tipo]}* · ${tituloFiltrado}`,
    citado,
    "Para revisar, responda nesta conversa marcando o Grok: `@Grok revise`",
    "Formato: `TIPO: bug|sugestao|demanda|duvida|configuracao | TITULO: … | FALTA: …`",
  ].join("\n");
}

export type RevisaoGrok = { tipo?: TipoCaptura; titulo?: string; falta?: string };

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

const TIPO_POR_PALAVRA: Array<[RegExp, TipoCaptura]> = [
  [/\bbug\b/, "bug"],
  [/\bsugest/, "sugestao"],
  [/\bdemanda\b/, "demanda"],
  [/\bduvida\b/, "duvida"],
  [/\bconfigura/, "configuracao"],
];

/** Lê "TIPO: x | TITULO: y | FALTA: z"; sem o formato, pega o primeiro tipo citado. */
export function interpretarRevisaoGrok(texto: string): RevisaoGrok {
  const limpo = texto.replace(/[*_`]/g, "");
  const campo = (nome: RegExp) => limpo.match(new RegExp(`${nome.source}\\s*:\\s*([^|\\n]+)`, "i"))?.[1]?.trim();
  const tipoTexto = semAcento(campo(/tipo/) ?? limpo.slice(0, 200));
  const tipo = TIPO_POR_PALAVRA.find(([re]) => re.test(tipoTexto))?.[1];
  const titulo = campo(/t[ií]tulo/)?.slice(0, 100);
  const falta = campo(/falta/)?.slice(0, 300);
  return {
    ...(tipo ? { tipo } : {}),
    ...(titulo ? { titulo } : {}),
    ...(falta && !/^(nada|nenhum|-|—)\.?$/i.test(falta) ? { falta } : {}),
  };
}

const PALAVRAS_VAZIAS = new Set(["para", "como", "quando", "esta", "este", "isso", "mais", "pelo", "pela", "sobre", "texto", "lido", "print", "nome"]);

function palavras(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .split(/[^a-z0-9]+/)
      .filter((p) => p.length >= 4 && !PALAVRAS_VAZIAS.has(p)),
  );
}

/** Registros já existentes com título parecido — para evitar duplicidade antes de confirmar. */
export function parecidos(
  texto: string,
  itens: Array<{ codigo: string; titulo: string }>,
  limite = 3,
): Array<{ codigo: string; titulo: string }> {
  const alvo = palavras(texto);
  if (!alvo.size) return [];
  return itens
    .map((item) => {
      const p = palavras(item.titulo);
      const comuns = [...p].filter((x) => alvo.has(x)).length;
      return { item, comuns, nota: p.size ? comuns / p.size : 0 };
    })
    .filter((x) => x.comuns >= 2 && x.nota >= 0.6)
    .sort((a, b) => b.nota - a.nota || b.comuns - a.comuns)
    .slice(0, limite)
    .map((x) => x.item);
}
