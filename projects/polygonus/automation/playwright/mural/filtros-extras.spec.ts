/**
 * FILTRO-01..09 (WEB) — Composer funil extras.
 * Espelho: maestro/flows/mural/01_1_comunicado_filtro_*.yaml
 *
 * "Limpar filtro" no funil NÃO é CT — só desmarca filtros especiais (helper
 * `limparFiltroExtrasComposer` se precisar no meio de um fluxo).
 *
 * Aniversariantes (02/09): rode antes `ajustar-dn-aniversariante.spec.ts` se precisar receptor.
 *
 *   npx playwright test mural/filtros-extras.spec.ts
 */
import { test } from "@playwright/test";
import path from "node:path";
import { textoComunicadoPlaywright } from "../shared/assinatura-teste";
import { openComunicadosSession } from "../shared/comunicados-session";
import {
  assertTextoNaLista,
  filtrarEnviadas,
  publicarComunicadoComFiltroExtras,
} from "../shared/mural-composer";

const ROOT = path.join(__dirname, "..");

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ timeout: 360_000 });

const FILTROS: { id: string; label: string | RegExp; rotulo: string }[] = [
  { id: "FILTRO-01", label: /Inadimplentes|Inadimplente/i, rotulo: "inadimplentes" },
  { id: "FILTRO-02", label: /Aniversariantes do dia|Aniversariante.*dia/i, rotulo: "aniversariantes-dia" },
  { id: "FILTRO-03", label: /Bolsista 100|100%/i, rotulo: "bolsista-100" },
  { id: "FILTRO-04", label: /Bolsista 50|50%/i, rotulo: "bolsista-50" },
  { id: "FILTRO-05", label: /Todos os bolsistas|Bolsistas/i, rotulo: "todos-bolsistas" },
  { id: "FILTRO-06", label: /Pagantes|Pagante/i, rotulo: "pagantes" },
  { id: "FILTRO-07", label: /Situa[cç][aã]o/i, rotulo: "situacao" },
  { id: "FILTRO-08", label: /^Sexo$/i, rotulo: "sexo" },
  { id: "FILTRO-09", label: /Aniversariantes do m[eê]s|Aniversariante.*m[eê]s/i, rotulo: "aniversariantes-mes" },
];

for (const f of FILTROS) {
  test(`${f.id} WEB: filtro ${f.rotulo}`, async () => {
    const log = `[${f.id.toLowerCase()}-web]`;
    const { context, page } = await openComunicadosSession(ROOT, log);
    const texto = textoComunicadoPlaywright(`${f.id} ${f.rotulo}`);
    try {
      await publicarComunicadoComFiltroExtras(page, texto, f.label);
      await filtrarEnviadas(page);
      await assertTextoNaLista(page, "Teste Playwright Chrome");
      console.log(`${log} ok`);
    } finally {
      await context.close();
    }
  });
}
