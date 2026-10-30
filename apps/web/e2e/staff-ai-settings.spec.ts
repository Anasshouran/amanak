import { test, expect } from "@playwright/test"

test.describe.configure({ mode: "serial" })

test("super_admin can switch provider from ollama to openrouter", async ({ page }) => {
  // Login as admin
  await page.goto("/login")
  await page.fill('input[name="email"], input[type="email"]', "admin@local.dev")
  await page.fill('input[name="password"], input[type="password"]", "Admin123456!")
  await page.getByRole("button", { name: /login|sign in|دخول/i }).click()
  await page.waitForURL("/staff/ai-settings", { timeout: 15000 })

  // Verify AI settings page is visible
  await expect(page.getByRole("heading", { name: /AI Provider Settings/i })).toBeVisible()

  // Select OpenRouter
  await page.getByRole("radio", { name: /openrouter/i }).click()
  await page.getByRole("checkbox").check()
  await page.getByRole("button", { name: /save/i }).click()

  // Verify toast
  await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 })

  // Verify status updated
  await expect(page.getByText("openrouter", { exact: false })).toBeVisible({ timeout: 5000 })
})

test("non-super-admin is blocked", async ({ browser }) => {
  const ctx = await browser.newPage()

  // Login as support (not super_admin)
  await page.goto("/login")
  await page.fill('input[name="email"], input[type="email"]", "support@local.dev")
  await page.fill('input[name="password"], input[type="password"]", "Support2026!")
  await page.getByRole("button", { name: /login|sign in|دخول/i }).click()
  await page.waitForURL("/dashboard", { timeout: 15000 })

  await page.goto("/staff/ai-settings")
  // Either 403 page or redirect
  await expect(page.getByText(/forbidden|403|super_admin|غير مصرح/i)).toBeVisible({ timeout: 5000 })

  await ctx.close()
})
