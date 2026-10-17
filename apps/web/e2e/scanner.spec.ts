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

test("the message tab switches the input to a message field", async ({ page }) => {
  await page.goto("/scanner")
  await page.getByRole("tab", { name: "Message Scan" }).click()
  await expect(page.getByRole("textbox", { name: "Paste a message" })).toBeVisible()
})

test("a benign URL renders the safe result card", async ({ page }) => {
  await scan(page, "https://example.com")
  const card = page.locator(".scan-result-card")
  await expect(card).toBeVisible()
  await expect(card.getByRole("heading", { level: 2, name: "Safe" })).toBeVisible()
  await expect(card.getByText("Low")).toBeVisible()
})

test("completed scans appear in the history sidebar", async ({ page }) => {
  await scan(page, "https://example.com")
  await expect(page.locator(".scan-result-card")).toBeVisible()
  await expect.poll(() => page.locator(".scan-history__button").count()).toBeGreaterThanOrEqual(1)
})

test("selecting a history item re-displays its result", async ({ page }) => {
  await scan(page, "http://paypal-secure.com/signin")
  await expect(page.locator(".scan-result-card")).toBeVisible()
  await expect.poll(() => page.locator(".scan-history__button").count()).toBeGreaterThanOrEqual(1)

  await page.getByRole("button", { name: "Scan another" }).click()
  await expect(page.locator(".scan-result-card")).toHaveCount(0)

  await page.locator(".scan-history__button").first().click()
  await expect(page.locator(".scan-result-card").getByRole("heading", { level: 2 })).toHaveText(
    "Malicious",
  )
})

