import { expect, registerUser, test, testUser, useEnglish, waitForApiIdle } from "./fixtures"

/**
 * P17.2 dashboard spec. Registration is throttle-sensitive, so the whole flow
 * runs in one serial test that signs up a single throwaway user.
 */
test.describe.configure({ mode: "serial" })

test("dashboard renders greeting, score, actions and navigates correctly", async ({ page }) => {
  const user = testUser()
  await useEnglish(page)
  await registerUser(page, user)
  await waitForApiIdle(page)

  // Greeting shows the signed-in user's name.
  await expect(page.getByRole("heading", { level: 1 })).toContainText(user.username)

  // Score card renders a numeric score out of 100.
  await expect(page.getByText("/100", { exact: true })).toBeVisible()

  // All four action cards are present and route correctly.
  const scan = page.getByRole("link", { name: /Scan Now/ })
  await expect(page.getByRole("link", { name: /Check Breach Monitor/ })).toHaveAttribute(
    "href",
    "/breach",
  )
  await expect(page.getByRole("link", { name: /View Vault/ })).toHaveAttribute("href", "/vault")
  await expect(page.getByRole("link", { name: /Open Vault/ })).toHaveAttribute("href", "/passwords")

  // Click "Scan Now" → /scanner
  await scan.click()
  await expect(page).toHaveURL(/\/scanner/)

  // Back to the dashboard, then "View all" in Activity → /scanner
  await page.goBack()
  await waitForApiIdle(page)
  await page.getByRole("link", { name: "View all" }).click()
  await expect(page).toHaveURL(/\/scanner/)

  // Trend card is present (empty state for a brand-new account).
  await page.goBack()
  await waitForApiIdle(page)
  await expect(page.getByRole("heading", { name: "Security score trend" })).toBeVisible({
    timeout: 15000,
  })
  await expect(page.getByText("Not enough data yet")).toBeVisible()
})
