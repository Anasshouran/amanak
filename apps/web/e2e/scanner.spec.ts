import { test, expect, testUser, useEnglish, registerUser } from "./fixtures"

test.beforeEach(async ({ page }) => {
  await useEnglish(page)
  await registerUser(page, testUser())
})

async function scan(page: import("@playwright/test").Page, input: string): Promise<void> {
  await page.goto("/scanner")
  await page.getByRole("textbox", { name: "URL" }).fill(input)
  await page.getByRole("button", { name: "Scan", exact: true }).click()
}

test("a benign URL scans as safe", async ({ page }) => {
  await scan(page, "https://example.com")
  await expect(page.locator(".amk-badge", { hasText: "Safe" }).first()).toBeVisible()
})

test("a phishing URL scans as dangerous with at least three matches", async ({ page }) => {
  await scan(page, "http://paypal-secure.com/signin")
  await expect(page.locator(".amk-badge", { hasText: "Dangerous" }).first()).toBeVisible()
  await expect.poll(() => page.locator(".amk-match").count()).toBeGreaterThanOrEqual(3)
})
