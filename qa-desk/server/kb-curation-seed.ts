import type { KbCurationCatalog, KbCurationRecord } from "../src/types/kb-curation.js";
import type { ProjectSlug } from "./types.js";

const REPOSITORY = "polygonus-br/polygonus-suporte-kb";
const REVIEWED_AT = "2026-07-21T13:00:00.000Z";
const REVIEW_SENT_AT = "2026-07-21T16:20:00.000Z";

type SeedInput = Pick<
  KbCurationRecord,
  "prNumber" | "title" | "status" | "verdict" | "summary"
> & {
  corrections?: string[];
  mergedAt?: string;
  reviewSentAt?: string;
};

/**
 * Status de fluxo (GitHub):
 * - aguardando_revisao → ainda não enviamos review
 * - aguardando_correcao → review enviada (request changes), aguardando autor
 * - aprovada / mesclada / bloqueada → estados finais ou de trava
 */
const INPUTS: SeedInput[] = [
  {
    prNumber: 28,
    title: 'NFS-e retorna erro por "Opção simples" errada',
    status: "mesclada",
    verdict: "precisa_correcao",
    summary: "Mesclada por Hitgart com Changes Requested aberta (id livre + tabela MEI×ME/EPP).",
    corrections: ["Usar ID livre (ex. fin-012)", "Precisar tabela MEI × ME/EPP (pTotTribSN só no ME/EPP)"],
    mergedAt: "2026-07-21T20:23:16.000Z",
    reviewSentAt: "2026-07-21T16:06:55.000Z",
  },
  {
    prNumber: 29,
    title: "Baixa pelo retorno sem tarifa",
    status: "mesclada",
    verdict: "precisa_correcao",
    summary: "Mesclada por Hitgart com Changes Requested aberta (rebase sem #28 + SICREDI operacional).",
    corrections: ["Rebasear sem o artigo do PR #28", "Qualificar tese SICREDI/QR como relato operacional"],
    mergedAt: "2026-07-21T20:23:58.000Z",
    reviewSentAt: "2026-07-21T16:20:43.000Z",
  },
  {
    prNumber: 30,
    title: "Relatório de inadimplência e competência da baixa",
    status: "bloqueada",
    verdict: "bloqueado",
    summary: "Texto da solução é útil, mas o PR está conflitante e mistura tooling fora do escopo.",
    corrections: ["Resolver conflito", "Separar tooling Opus em outro PR"],
  },
  {
    prNumber: 34,
    title: "Diário de Classe com coordenador da turma",
    status: "mesclada",
    verdict: "precisa_correcao",
    summary:
      "Mesclada por Hitgart com review Changes Requested aberta (id aca-008 colidindo + baseURL).",
    corrections: [
      "Usar ID livre (aca-008 colidia no master)",
      "Reverter ou parametrizar baseURL do Playwright",
    ],
    mergedAt: "2026-07-21T20:27:42.000Z",
    reviewSentAt: "2026-07-21T16:54:24.000Z",
  },
  {
    prNumber: 35,
    title: "Histórico Escolar: onde lançar observações",
    status: "aguardando_revisao",
    verdict: "precisa_correcao",
    summary: "Solução coerente; precisa alinhar captions e condições de exibição.",
    corrections: ["Usar ID livre", "Corrigir captions", "Explicar ind_obs_destaque"],
  },
  {
    prNumber: 36,
    title: "NFS-e rejeitada por telefone do prestador",
    status: "mesclada",
    verdict: "aprovavel",
    summary: "Correção aplicada: Excluir D.P.S. Local → Excluir RPS local.",
    mergedAt: "2026-07-21T13:41:43.000Z",
  },
  {
    prNumber: 37,
    title: "Criar perfil de acesso Web para novo cargo",
    status: "aguardando_revisao",
    verdict: "precisa_correcao",
    summary: "Passo a passo omite Função obrigatória e atribui vínculo à aba Usuários.",
    corrections: ["Corrigir fluxo da aba Usuários", "Incluir Função", "Reutilizar mapa existente"],
  },
  {
    prNumber: 38,
    title: "Dispensar aprovação de envios por perfil",
    status: "aguardando_revisao",
    verdict: "precisa_correcao",
    summary: "Orientação atual pode alterar autorização global; deve apontar para o perfil do cargo.",
    corrections: ["Usar Função do perfil", "Alertar impacto de tip_usuario"],
  },
  {
    prNumber: 39,
    title: "Botão de gravar ausente no App",
    status: "aguardando_revisao",
    verdict: "precisa_correcao",
    summary: "Notas ficam read-only; em conteúdo/tarefa o FAB some. Texto precisa distinguir.",
    corrections: ["Usar ID livre", "Separar comportamento por tela", "Desacoplar do PR #37"],
  },
  {
    prNumber: 40,
    title: "Múltiplos logins e boletos no App",
    status: "mesclada",
    verdict: "aprovavel",
    summary: "Solução confirmada no fluxo de unidades do usuário.",
    mergedAt: "2026-07-21T13:56:00.000Z",
  },
  {
    prNumber: 41,
    title: "Conversas duplicadas no Fale Conosco v1 × Chat v2",
    status: "mesclada",
    verdict: "aprovavel",
    summary: "Diferença de deduplicação entre v1 e v2 confirmada.",
    mergedAt: "2026-07-21T13:56:04.000Z",
  },
  {
    prNumber: 42,
    title: "Declaração de IR abate devoluções",
    status: "mesclada",
    verdict: "precisa_correcao",
    summary: "Mesclada por Hitgart com Changes Requested aberta (id livre + precisão do motor).",
    corrections: ["Usar ID livre", "Qualificar escopo do motor de carta"],
    mergedAt: "2026-07-21T20:29:54.000Z",
    reviewSentAt: "2026-07-21T17:51:28.000Z",
  },
  {
    prNumber: 43,
    title: "Controle não aparece por perfis indevidos",
    status: "aguardando_revisao",
    verdict: "precisa_correcao",
    summary: "Distinguir botão desabilitado de aba oculta e qualificar precedência.",
    corrections: ["Usar ID livre", "Corrigir Enabled × Visible", "Qualificar Negado prevalece"],
  },
  {
    prNumber: 44,
    title: "Configurar acesso do colaborador ao App",
    status: "aguardando_revisao",
    verdict: "precisa_correcao",
    summary: "Sobrepõe artigo já existente e repete seg-001.",
    corrections: ["Fundir ou diferenciar artigos", "Usar ID livre", "Renomear spec"],
  },
  {
    prNumber: 45,
    title: "Boletim infantil: conceitos e professor Regente",
    status: "mesclada",
    verdict: "aprovavel",
    summary: "Solução aprovada; paginação e ausência de conceitos são cenários distintos.",
    mergedAt: "2026-07-21T14:12:33.000Z",
  },
  {
    prNumber: 46,
    title: "Tipos/termos de ocorrência não aparecem no App",
    status: "mesclada",
    verdict: "aprovavel",
    summary: "Correção do perfil/Objetos aplicada pelo autor; PR mesclado.",
    mergedAt: "2026-07-21T16:06:57.000Z",
    reviewSentAt: "2026-07-21T15:12:36.000Z",
  },
  {
    prNumber: 72,
    title: "Conceitos de anos anteriores no Histórico Web",
    status: "aguardando_revisao",
    verdict: "precisa_correcao",
    summary: "Causa confirmada; falta usar ID livre.",
    corrections: ["Usar ID livre", "Alertar para conferir escala/apuração antes de copiar fórmula"],
  },
  {
    prNumber: 73,
    title: "NFS-e: competência × data de emissão",
    status: "aguardando_revisao",
    verdict: "precisa_correcao",
    summary: "Texto generaliza a trava; implementação compara MonthOf sem ano.",
    corrections: ["Descrever comparação MonthOf literalmente", "Marcar IPM como relato operacional"],
  },
  {
    prNumber: 74,
    title: "Visualizar comunicados enviados por outros usuários",
    status: "aguardando_revisao",
    verdict: "aprovavel",
    summary: "Enriquecimento aditivo e coerente; risco de conflito com PR #83.",
  },
  {
    prNumber: 75,
    title: "Mural/Rotina é feed cronológico cumulativo",
    status: "aguardando_revisao",
    verdict: "aprovavel",
    summary: "Comportamento confirmado no App e backend.",
  },
  {
    prNumber: 76,
    title: "Competência na impressão da escrita contábil",
    status: "aguardando_revisao",
    verdict: "aprovavel",
    summary: "Origem do mês de competência confirmada ponta a ponta.",
  },
];

export function initialKbCurationCatalog(project: ProjectSlug): KbCurationCatalog {
  const pullRequests = project === "polygonus"
    ? INPUTS.map<KbCurationRecord>((input) => {
        const history: KbCurationRecord["history"] = [
          {
            at: REVIEWED_AT,
            actor: "Pedro",
            action: "kb_pr_triaged",
            detail: `${input.verdict}: ${input.summary}`,
          },
        ];
        if (input.reviewSentAt) {
          history.push({
            at: input.reviewSentAt,
            actor: "Pedro",
            action: "kb_pr_review_sent",
            detail: "Review enviada no GitHub → aguardando correção",
          });
        }
        if (input.mergedAt) {
          history.push({
            at: input.mergedAt,
            actor: "Pedro",
            action: "kb_pr_merged",
            detail: `PR #${input.prNumber} mesclado`,
          });
        }
        return {
          id: `${REPOSITORY}#${input.prNumber}`,
          project,
          repository: REPOSITORY,
          prNumber: input.prNumber,
          title: input.title,
          url: `https://github.com/${REPOSITORY}/pull/${input.prNumber}`,
          githubState: input.mergedAt ? "merged" : "open",
          status: input.status,
          verdict: input.verdict,
          summary: input.summary,
          solutionReview: input.summary,
          corrections: input.corrections ?? [],
          reviewer: "Pedro",
          reviewedAt: input.reviewSentAt ?? (input.mergedAt ? input.mergedAt : undefined),
          mergedAt: input.mergedAt,
          history,
        };
      })
    : [];

  return {
    meta: {
      version: "1.1.0",
      updatedAt: "2026-07-21",
      project,
      repository: REPOSITORY,
    },
    pullRequests,
  };
}
