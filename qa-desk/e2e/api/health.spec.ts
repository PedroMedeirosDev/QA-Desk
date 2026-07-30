import { expect, test } from "@playwright/test";

test.describe("API health", () => {
  test("GET /api/health em modo E2E mock", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      auth: "mock",
      automationRun: false,
    });
  });
});
