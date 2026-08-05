/**
 * Catálogo de implantações (anotações operacionais por tipo).
 * Persistência JSON em data/projects/{slug}/implantacoes.json.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ProjectSlug } from "./types.js";

export type ImplantacaoRequisitoTipo =
  | "sql"
  | "config"
  | "manual"
  | "aviso"
  | "outro";

export type ImplantacaoExecutor = "dba" | "suporte" | "qa" | "dev" | "outro";

export type ImplantacaoStatus = "ativo" | "arquivado";

export interface ImplantacaoRequisito {
  id: string;
  ordem: number;
  titulo: string;
  detalhe: string;
  tipo: ImplantacaoRequisitoTipo;
  executor: ImplantacaoExecutor;
  obrigatorio: boolean;
  fonte?: string;
  fonteEm?: string;
  notas?: string;
}

export interface ImplantacaoTipo {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: ImplantacaoStatus;
  requisitos: ImplantacaoRequisito[];
  createdAt: string;
  updatedAt: string;
}

export interface ImplantacaoCatalog {
  meta: { project: ProjectSlug; updatedAt: string };
  tipos: ImplantacaoTipo[];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.join(__dirname, "../data/projects");

function catalogPath(project: ProjectSlug) {
  return path.join(DATA_ROOT, project, "implantacoes.json");
}

function slugify(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function nextId(tipos: ImplantacaoTipo[]): string {
  const max = tipos.reduce((acc, t) => {
    const n = Number(t.id.replace(/\D/g, ""));
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 0);
  return `IMP-${String(max + 1).padStart(3, "0")}`;
}

function nextReqId(reqs: ImplantacaoRequisito[]): string {
  const max = reqs.reduce((acc, r) => {
    const n = Number(r.id.replace(/\D/g, ""));
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 0);
  return `req-${max + 1}`;
}

function seedPolygonus(): ImplantacaoCatalog {
  const now = new Date().toISOString();
  return {
    meta: { project: "polygonus", updatedAt: now.slice(0, 10) },
    tipos: [
      {
        id: "IMP-001",
        slug: "chat-nova-unidade",
        title: "Chat em nova unidade",
        description:
          "Checklist na implantação do chat em unidade nova. QA anota e escala; não executa SQL.",
        status: "ativo",
        createdAt: now,
        updatedAt: now,
        requisitos: [
          {
            id: "req-1",
            ordem: 1,
            titulo: "Backfill migração chat novo",
            detalhe:
              "Na implantação do chat em nova unidade, rodar o script chat_backfill_migracao_chat_novo.sql",
            tipo: "sql",
            executor: "dba",
            obrigatorio: true,
            fonte: "Moacir Schmidt",
            fonteEm: "2026-08-05",
            notas:
              "Pedido no chat interno após homologação. QA não tem permissão de SQL — escalar DBA / quem implantar.",
          },
        ],
      },
    ],
  };
}

function emptyCatalog(project: ProjectSlug): ImplantacaoCatalog {
  return {
    meta: {
      project,
      updatedAt: new Date().toISOString().slice(0, 10),
    },
    tipos: [],
  };
}

export function readImplantacaoCatalog(project: ProjectSlug): ImplantacaoCatalog {
  const file = catalogPath(project);
  fs.mkdirSync(path.dirname(file), { recursive: true });

  if (!fs.existsSync(file)) {
    if (project === "polygonus") {
      const seeded = seedPolygonus();
      writeImplantacaoCatalog(project, seeded);
      return seeded;
    }
    return emptyCatalog(project);
  }

  return JSON.parse(fs.readFileSync(file, "utf8")) as ImplantacaoCatalog;
}

export function writeImplantacaoCatalog(
  project: ProjectSlug,
  catalog: ImplantacaoCatalog,
) {
  catalog.meta.project = project;
  catalog.meta.updatedAt = new Date().toISOString().slice(0, 10);
  const file = catalogPath(project);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
}

export function findImplantacaoBySlug(
  catalog: ImplantacaoCatalog,
  slug: string,
): ImplantacaoTipo | undefined {
  return catalog.tipos.find((t) => t.slug === slug);
}

export function createImplantacaoTipo(
  catalog: ImplantacaoCatalog,
  input: {
    title: string;
    description?: string;
    slug?: string;
  },
): ImplantacaoTipo {
  const now = new Date().toISOString();
  let slug = (input.slug?.trim() || slugify(input.title)).slice(0, 64);
  const taken = new Set(catalog.tipos.map((t) => t.slug));
  if (taken.has(slug)) {
    let i = 2;
    while (taken.has(`${slug}-${i}`)) i++;
    slug = `${slug}-${i}`;
  }
  const tipo: ImplantacaoTipo = {
    id: nextId(catalog.tipos),
    slug,
    title: input.title.trim(),
    description: (input.description ?? "").trim(),
    status: "ativo",
    requisitos: [],
    createdAt: now,
    updatedAt: now,
  };
  catalog.tipos.unshift(tipo);
  return tipo;
}

export function addRequisito(
  tipo: ImplantacaoTipo,
  input: Omit<ImplantacaoRequisito, "id" | "ordem"> & { ordem?: number },
): ImplantacaoRequisito {
  const ordem =
    input.ordem ??
    (tipo.requisitos.reduce((m, r) => Math.max(m, r.ordem), 0) + 1 || 1);
  const req: ImplantacaoRequisito = {
    id: nextReqId(tipo.requisitos),
    ordem,
    titulo: input.titulo.trim(),
    detalhe: input.detalhe.trim(),
    tipo: input.tipo,
    executor: input.executor,
    obrigatorio: input.obrigatorio,
    fonte: input.fonte?.trim() || undefined,
    fonteEm: input.fonteEm?.trim() || undefined,
    notas: input.notas?.trim() || undefined,
  };
  tipo.requisitos.push(req);
  tipo.requisitos.sort((a, b) => a.ordem - b.ordem);
  tipo.updatedAt = new Date().toISOString();
  return req;
}
