import { test, expect, testUser, useEnglish, registerUser, waitForApiIdle } from "./fixtures"

test.beforeEach(async ({ page }) => {
  await useEnglish(page)
})

test("view plans, choose one, and see it on the billing page", async ({ page }) => {
  await registerUser(page, testUser())

  await page.goto("/plans")
  await waitForApiIdle(page)
  await expect(page.getByText("Plans & Pricing")).toBeVisible()
  await expect(page.locator(".amk-card").filter({ hasText: "Free" }).first()).toBeVisible()
  await expect(page.locator(".amk-card").filter({ hasText: "Pro" }).first()).toBeVisible()
  await expect(page.locator(".amk-card").filter({ hasText: "Family" }).first()).toBeVisible()

  const proCard = page.locator(".amk-card", { hasText: "Full protection for one person" }).first()
  await proCard.getByRole("button", { name: /Choose plan/i }).click()
  await waitForApiIdle(page)

  await page.goto("/billing")
  await waitForApiIdle(page)
  await expect(page.getByText("Subscription")).toBeVisible()
  await expect(page.getByText("Usage this period")).toBeVisible()

  await page.getByRole("button", { name: /Cancel plan/i }).click()
  await waitForApiIdle(page)
  await expect(page.getByText(/Cancels at the end of/i)).toBeVisible()
})

test("free plan blocks AI and shows an upgrade prompt", async ({ page }) => {
  await registerUser(page, testUser())
  await page.goto("/ai")
  await waitForApiIdle(page)
  // Free plan has ai_enabled=false; the page surfaces the gating state.
  await expect(page.locator("body")).toContainText(/Plan|Upgrade|not available/i)
})
