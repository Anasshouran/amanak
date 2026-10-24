import { test, expect } from "@playwright/test"

test.describe("AI Explanation", () => {
  test.skip("button disabled when AI off", async ({ page }) => {
    await page.route("**/api/v1/ai/status/**", (route) =>
      route.fulfill({ status: 200, json: { enabled: false } })
    )
    await page.route("**/api/v1/scan/**", (route) => {
      if (route.request().method() === "POST") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          json: {
            id: "scan1",
            url: "https://example.com",
            verdict: "safe",
            risk_score: 0,
            reasons: [],
            ai_explained: false,
          },
        })
      } else {
        route.continue()
      }
    })
    await page.goto("/scanner")
    await page.waitForTimeout(500)
    await page.fill('input[placeholder*="https"]', "https://example.com")
    await page.getByRole("button", { name: /scan/i }).click()
    await page.waitForTimeout(1000)
    const explainBtn = page.getByRole("button", { name: /explain/i })
    await expect(explainBtn).toBeDisabled()
  })

  test.skip("click explains when AI enabled via mock", async ({ page }) => {
    await page.route("**/api/v1/ai/status/**", (route) =>
      route.fulfill({ status: 200, json: { enabled: true, provider: "fake", model: "fake-model" } })
    )
    await page.route("**/api/v1/scan/**", (route) => {
      if (route.request().method() === "POST") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          json: {
            id: "scan2",
            url: "https://example-paypal-verify.tk/login",
            verdict: "phishing",
            risk_score: 95,
            reasons: ["suspicious_domain"],
            ai_explained: false,
          },
        })
      } else {
        route.continue()
      }
    })
    await page.route("**/api/v1/ai/explain-scan", (route) => {
      if (route.request().method() === "POST") {
        route.fulfill({ status: 200, json: { text: "Domain mimics PayPal", provider: "fake", model: "fake-model", tokens_used: 1 } })
      } else {
        route.continue()
      }
    })
    await page.goto("/scanner")
    await page.waitForTimeout(500)
    await page.fill('input[placeholder*="https"]', "https://example-paypal-verify.tk/login")
    await page.getByRole("button", { name: /scan/i }).click()
    await page.waitForTimeout(1000)
    await page.getByRole("button", { name: /explain/i }).click()
    await expect(page.getByText(/Domain mimics PayPal/i)).toBeVisible()
  })
})
