/**
 * Seed manual / isolado: ajusta DN do colaborador "Aniversariante".
 * Na suíte FILTRO, o seed roda sozinho via `garantirDnAniversariante` em
 * `filtros-extras.spec.ts` (antes de FILTRO-02 / 09).
 *
 *   npx playwright test mural/ajustar-dn-aniversariante.spec.ts
 *   SKIP_ANIVERSARIANTE_DN=1  — pula (já ajustado hoje)
 */
import { test } from "@playwright/test";
import path from "node:path";
import { garantirDnAniversariante } from "../shared/ajustar-dn-aniversariante";

const ROOT = path.join(__dirname, "..");

test.use({ storageState: { cookies: [], origins: [] } });

test("ajustar DN Aniversariante (dia/mês do teste)", async () => {
  test.setTimeout(240_000);
  await garantirDnAniversariante(ROOT, { force: true });
});
