import { expect, test } from "@playwright/test";

const project = "polygonus";

test.describe("API tests CRUD", () => {
  test("cria CT, busca por id e atualiza título", async ({ request }) => {
    const stamp = Date.now();
    const title = `API-CT Playwright ${stamp}`;

    const created = await request.post(`/api/projects/${project}/tests`, {
      data: {
        title,
        recordType: "teste",
        channel: "app",
        status: "rascunho",
        description: "Criado pelo e2e/api",
      },
    });
    expect(created.status()).toBe(201);
    const body = await created.json();
    expect(body.id).toBeTruthy();
    expect(body.title).toBe(title);

    const listed = await request.get(`/api/projects/${project}/tests`);
    expect(listed.ok()).toBeTruthy();
    const catalog = await listed.json();
    expect(catalog.reports.some((r: { id: string }) => r.id === body.id)).toBe(
      true,
    );

    const one = await request.get(`/api/projects/${project}/tests/${body.id}`);
    expect(one.ok()).toBeTruthy();
    expect((await one.json()).id).toBe(body.id);

    const updatedTitle = `${title} atualizado`;
    const put = await request.put(`/api/projects/${project}/tests/${body.id}`, {
      data: { title: updatedTitle },
    });
    expect(put.ok()).toBeTruthy();
    expect((await put.json()).title).toBe(updatedTitle);
  });

  test("POST sem título retorna 400", async ({ request }) => {
    const res = await request.post(`/api/projects/${project}/tests`, {
      data: { recordType: "teste", channel: "app" },
    });
    expect(res.status()).toBe(400);
    const err = await res.json();
    expect(err.error).toMatch(/título/i);
  });
});
