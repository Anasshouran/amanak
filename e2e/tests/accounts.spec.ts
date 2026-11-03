import { test, expect } from "@playwright/test";

test.describe("Accounts management", () => {
  test("super_admin can list users", async ({ page }) => {
    await page.goto("/staff/accounts");
    await expect(
      page.getByRole("heading", { name: /الحسابات|accounts/i })
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("table")).toBeVisible();
  });

  test("create user returns temp_password once", async ({ request }) => {
    const email = `e2e-${Date.now()}@test.local`;
    const res = await request.post("/api/v1/accounts/users/", {
      data: { email },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.email).toBe(email);
    expect(body.temp_password).toBeTruthy();
    expect(body.password).toBeUndefined();
  });

  test("scope=all is 200 for super_admin", async ({ request }) => {
    const res = await request.get("/api/v1/accounts/users/?scope=all");
    expect(res.status()).toBe(200);
  });
});
