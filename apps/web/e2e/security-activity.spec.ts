import { test, expect, testUser, useEnglish, registerUser, waitForApiIdle } from "./fixtures"

test.beforeEach(async ({ page }) => {
  await useEnglish(page)
})

test("security activity: sessions tab shows current session", async ({ page }) => {
  await registerUser(page, testUser())
  await page.goto("/security")
  await waitForApiIdle(page)
  await expect(page.getByRole("tab", { name: /Sessions/i })).toBeVisible()
  await expect(page.getByText(/Current/i).first()).toBeVisible()
})

test("security activity: revoke all logs out", async ({ page }) => {
  await registerUser(page, testUser())
  await page.goto("/security")
  await waitForApiIdle(page)
  const revokeBtn = page.getByRole("button", { name: /Revoke all/i })
  if (await revokeBtn.isVisible()) {
    await revokeBtn.click()
    const confirmBtn = page.getByRole("button", { name: /Confirm/i })
    await confirmBtn.waitFor({ state: "visible", timeout: 5000 })
    await confirmBtn.click()
    await waitForApiIdle(page)
    await expect(page).toHaveURL(/\/login$/)
  }
})
