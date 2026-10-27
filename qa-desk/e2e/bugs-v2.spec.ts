import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * Bug v2 (docs/BUG_V2.md) + acessibilidade. A massa é criada pela API no
 * projeto `anihype` (sem dados no repositório), então roda igual no PC e no CI.
 * O `desk` não serve: só tem a tela da Suite API.
 */
const API = "http://127.0.0.1:3011";
const PROJECT = "anihype";

type Massa = { stamp: string; testeId: string; testeTitulo: string; bugTitulo: string };

async function criarMassa(request: APIRequestContext): Promise<Massa> {
  // Base 36: o servidor mascara sequências longas de dígitos como telefone (redact-pii).
  const stamp = Date.now().toString(36);
  const testeTitulo = `E2E CT envio de comunicado ${stamp}`;
  const teste = await request.post(`${API}/api/projects/${PROJECT}/tests`, {
    data: {
      title: testeTitulo,
      recordType: "teste",
      status: "rascunho",
      scenario:
        "Funcionalidade: Mural\n\n  Cenário: Coordenador envia comunicado com PDF\n    Dado que estou logado como coordenador\n    Quando envio um comunicado com o anexo \"pauta.pdf\"\n    Então o comunicado aparece em \"Enviadas\" com o anexo",
    },
  });
  expect(teste.status()).toBe(201);
  const testeId = (await teste.json()).id as string;

  const bugTitulo = `E2E Mural — anexo PDF some após enviar ${stamp}`;
  const bug = await request.post(`${API}/api/projects/${PROJECT}/tests`, {
    data: {
      title: bugTitulo,
      recordType: "bug",
      status: "em_reteste",
      platform: "web",
      description: "O anexo não aparece no comunicado enviado.",
      steps: ["Escrever comunicado", "Anexar pauta.pdf", "Enviar"],
      expectedResult: "Comunicado em Enviadas com o anexo",
      actualResult: "Comunicado em Enviadas sem o anexo",
      severity: "alta",
      priority: "media",
      reproducibility: "intermitente",
      linkedTestId: testeId,
      linkedRunAt: new Date().toISOString(),
    },
  });
  expect(bug.status()).toBe(201);
  return { stamp, testeId, testeTitulo, bugTitulo };
}

async function violacoesGraves(page: import("@playwright/test").Page, testInfo: import("@playwright/test").TestInfo, nome: string) {
  const resultado = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  await testInfo.attach(`axe-${nome}.json`, {
    body: JSON.stringify(resultado.violations, null, 2),
    contentType: "application/json",
  });
  return resultado.violations
    .filter((v) => v.impact === "critical" || v.impact === "serious")
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} elemento(s): ${v.nodes
          .slice(0, 4)
          .map((n) => n.target.join(" "))
          .join(" | ")}`,
    );
}

test.describe("Bug v2", () => {
  let massa: Massa;

  test.beforeAll(async ({ request }) => {
    massa = await criarMassa(request);
  });

  test("cartão resumido mostra impacto, status e rastreabilidade", async ({ page }) => {
    await page.goto(`/projects/${PROJECT}/bugs`);
    const cartao = page.getByRole("listitem").filter({ hasText: massa.bugTitulo });

    await expect(cartao.getByText("Severidade alta")).toBeVisible();
    await expect(cartao.getByText("Prioridade média")).toBeVisible();
    await expect(cartao.getByText("Em reteste")).toBeVisible();
    await expect(cartao.getByText(/^Falhou no /)).toBeVisible();
  });

  test("cartão expandido traz esperado × obtido e o teste vinculado", async ({ page }) => {
    await page.goto(`/projects/${PROJECT}/bugs`);
    const cartao = page.getByRole("listitem").filter({ hasText: massa.bugTitulo });
    await cartao.getByRole("button", { expanded: false }).click();

    await expect(cartao.getByText("Comunicado em Enviadas sem o anexo")).toBeVisible();
    await expect(cartao.getByText("Reprodutibilidade: Intermitente")).toBeVisible();
    await expect(cartao.getByRole("link", { name: new RegExp(massa.testeTitulo) })).toBeVisible();
    await expect(cartao.getByText(/Dado que estou logado como coordenador/)).toBeVisible();
  });

  test("filtro de severidade esconde o que não bate", async ({ page }) => {
    await page.goto(`/projects/${PROJECT}/bugs`);
    await expect(page.getByText(massa.bugTitulo)).toBeVisible();

    await page.getByLabel("Severidade").selectOption("baixa");
    await expect(page.getByText(massa.bugTitulo)).toHaveCount(0);

    await page.getByLabel("Severidade").selectOption("alta");
    await expect(page.getByText(massa.bugTitulo)).toBeVisible();
  });
});

test.describe("Acessibilidade (axe, WCAG 2 A/AA)", () => {
  let massa: Massa;

  test.beforeAll(async ({ request }) => {
    massa = await criarMassa(request);
  });

  // Cada página tem uma âncora de conteúdo: sem ela, o axe poderia "passar"
  // olhando outra tela (ex.: o login, se o modo mock não subir).
  const paginas = [
    { nome: "lista-de-bugs", rota: `/projects/${PROJECT}/bugs`, ancora: () => massa.bugTitulo },
    { nome: "lista-de-testes", rota: `/projects/${PROJECT}`, ancora: () => massa.testeTitulo },
  ];

  for (const { nome, rota, ancora } of paginas) {
    test(`${nome} sem violações críticas ou graves`, async ({ page }, testInfo) => {
      await page.goto(rota);
      await expect(page.getByText(ancora()).first()).toBeVisible();
      expect(await violacoesGraves(page, testInfo, nome)).toEqual([]);
    });
  }
});
