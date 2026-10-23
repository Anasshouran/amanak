// AI explanation: with AI disabled → disabled tooltip; with AI_FAKE_PROVIDER=true → renders explanation.
import { test, expect } from "@playwright/test"

test.describe("AI Explanation", () => {
  test("shows disabled tooltip when AI is off", async ({ page }) => {
    await page.route("**/api/v1/ai/status/**", (route) =>
      route.fulfill({ json: { enabled: false } })
    )
    await page.goto("/scanner")
    await page.fill("textarea, [placeholder*='link'], input", "https://example.com")
    await page.getByRole("button", { name: "Scan" }).click()
    await page.waitForTimeout(800)
    const btn = page.getByRole("button", { name: /explain/i })
    await expect(btn).toBeDisabled()
  })

  test("click explains when AI is enabled via mock", async ({ page }) => {
    await page.route("**/api/v1/ai/status/**", (route) =>
      route.fulfill({ json: { enabled: true, provider: "fake", model: "fake-model" } })
    )
    await page.route("**/api/v1/ai/explain-scan", (route) => {
      if (route.method() === "POST") {
        route.fulfill({
          json: { text: "Domain mimics PayPal", provider: "fake", model: "fake-model", tokens_used: 1 },
          status: 200,
        })
      }
    })
    await page.goto("/scanner")
    await page.fill("textarea, [placeholder*='link'], input", "https://example-paypal-verify.tk/login")
    await page.getByRole("button", { name: "Scan" }).click()
    await page.waitForTimeout(800)
    await page.getByRole("button", { name: /explain/i }).click()
    await expect(page.getByText(/Domain mimics PayPal/i)).toBeVisible()
  })
})
