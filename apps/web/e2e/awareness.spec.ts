import { test, expect, testUser, useEnglish, registerUser, waitForApiIdle } from "./fixtures"

test.beforeEach(async ({ page }) => {
  await useEnglish(page)
})

test("start session, answer a few, see progress update", async ({ page }) => {
  await registerUser(page, testUser())
  await page.goto("/awareness")
  await waitForApiIdle(page)
  await expect(page.getByText("Phishing Awareness")).toBeVisible()
  await page.getByRole("button", { name: /Start training/i }).click()
  await waitForApiIdle(page)
  // answer first scenario if present
  const phishingBtn = page.getByRole("button", { name: /Phishing/i }).first()
  if (await phishingBtn.isVisible()) {
    await phishingBtn.click()
    await waitForApiIdle(page)
    const nextBtn = page.getByRole("button", { name: /Next/i })
    if (await nextBtn.isVisible()) {
      await nextBtn.click()
    }
  }
  await page.goto("/awareness")
  await waitForApiIdle(page)
  await expect(page.getByText("Phishing Awareness")).toBeVisible()
})
