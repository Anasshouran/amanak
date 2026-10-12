import { test, expect, testUser, useEnglish, registerUser } from "./fixtures"

const BREACH_DISABLED = process.env.E2E_BREACH_DISABLED === "1"

test.beforeEach(async ({ page }) => {
  await useEnglish(page)
  await registerUser(page, testUser())
})

test("shows the disabled state when monitoring is off", async ({ page }) => {
  test.skip(!BREACH_DISABLED, "E2E_BREACH_DISABLED not set (breach monitor enabled)")
  await page.goto("/breach")
  await expect(page.getByText("Breach monitoring is disabled")).toBeVisible()
})

test.describe("enabled breach monitor", () => {
  test.skip(BREACH_DISABLED, "breach monitor disabled (E2E_BREACH_DISABLED=1)")

  test("requires consent before an email can be added", async ({ page }) => {
    await page.goto("/breach")
    await page.getByLabel("Email address", { exact: true }).fill("watched@example.com")
    await expect(page.getByRole("button", { name: "Add email" })).toBeDisabled()
  })

  test("adds an email once consent is given", async ({ page }) => {
    await page.goto("/breach")
    await page.getByLabel("Email address", { exact: true }).fill("watched@example.com")
    await page.getByRole("checkbox").check()
    await page.getByRole("button", { name: "Add email" }).click()
    await expect(page.getByText("watched@example.com").first()).toBeVisible()
  })
})
