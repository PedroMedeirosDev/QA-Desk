import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

/**
 * Smoke: app sobe em modo mock, lista de testes do Polygonus App carrega.
 * Não dispara Maestro (QA_AUTOMATION_RUN=0 no webServer).
 */
test.describe("QA Desk — smoke", () => {
  test("abre a lista de testes do Polygonus App (mock)", async ({ page }) => {
    await page.goto("/projects/polygonus/app");

    await expect(page.getByText("REGISTRO DE TESTES")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Polygonus/i })).toBeVisible();
    await expect(page.getByText("Mural", { exact: true }).first()).toBeVisible();

    // fetch no browser → Vite proxy → API E2E (não usa page.request isolado)
    const health = await page.evaluate(async () => {
      const res = await fetch("/api/health");
      return res.json();
    });
    expect(health).toMatchObject({
      ok: true,
      auth: "mock",
      automationRun: false,
    });
  });

  test("abre Curadoria KB com métricas e PRs rastreados", async ({ page }) => {
    await page.goto("/projects/polygonus/curadoria-kb");

    await expect(
      page.getByRole("heading", { name: "Rastreabilidade da base de conhecimento" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Curadoria KB" })).toBeVisible();
    await expect(page.getByText("Escopo", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /#36/ })).toBeVisible();
    await expect(
      page.locator("tbody").getByText("Mesclada", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Sincronizar GitHub" })).toBeEnabled();

    await page
      .getByRole("combobox", { name: "Situação do relatório" })
      .selectOption("mesclada");
    const reportButton = page.getByRole("button", {
      name: /Relatório HTML \(\d+\)/,
    });
    await expect(reportButton).toBeEnabled();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      reportButton.click(),
    ]);
    expect(download.suggestedFilename()).toMatch(
      /^Curadoria-KB-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.html$/,
    );
    const downloadedPath = await download.path();
    expect(downloadedPath).toBeTruthy();
    const html = await readFile(downloadedPath!, "utf8");
    expect(html).toContain("Escopo: <strong>Mesclada</strong>");
    expect(html).toContain("PR #36");
    expect(html).not.toContain("PR #28");
  });

  test("toggle Emulador/Maestro × Web/Playwright nas suítes do App", async ({ page }) => {
    await page.goto("/projects/polygonus/app");
    await expect(page.getByText("REGISTRO DE TESTES")).toBeVisible();

    const toggle = page.getByRole("group", { name: "Executor da suíte" }).first();
    await expect(toggle).toBeVisible({ timeout: 15_000 });

    const maestroBtn = toggle.getByRole("button", { name: "Maestro" });
    const playwrightBtn = toggle.getByRole("button", { name: "Playwright" });
    await expect(maestroBtn).toHaveAttribute("aria-pressed", "true");

    await playwrightBtn.click();
    await expect(playwrightBtn).toHaveAttribute("aria-pressed", "true");
    await expect(maestroBtn).toHaveAttribute("aria-pressed", "false");

    // Cabeçalho da suíte mostra ausência de Playwright (CTs não somem)
    await expect(page.getByText("Sem Playwright").first()).toBeVisible();

    // Expande a suíte do toggle e confirma aviso nos itens
    await toggle.locator("xpath=ancestor::tr[1]").getByRole("button").first().click();
    await expect(page.getByText(/Playwright não configurado/).first()).toBeVisible();

    await maestroBtn.click();
    await expect(maestroBtn).toHaveAttribute("aria-pressed", "true");
  });
});
