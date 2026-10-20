import {
  test,
  expect,
  testUser,
  registerUser,
  loginUser,
  createOrgForUser,
  createAccountForUser,
  waitForApiIdle,
  useEnglish,
} from "./fixtures"

test.describe.configure({ mode: "serial" })

/**
 * P18.1c2 — context switcher e2e.
 *
 * Switching the tenant context reloads the page (intentional in this phase), so
 * the helpers wait for the reload to settle before asserting.
 */

test("Personal → Org → Personal", async ({ page }) => {
  const user = testUser()
  await useEnglish(page)
  await registerUser(page, user)
  const orgId = createOrgForUser(user.email, "Acme", `acme-${Date.now().toString(36)}`)

  // Personal context by default.
  await page.goto("/dashboard")
  await waitForApiIdle(page)
  await expect(page.locator(".amk-contextbadge")).toContainText("Personal")

  // Switch to the organization via the header dropdown.
  await page.getByLabel("Switch workspace").click()
  await page.getByRole("option", { name: "Acme" }).click()
  await page.waitForLoadState("networkidle")
  await expect(page.locator(".amk-contextbadge")).toContainText("Acme")
  expect(await page.evaluate(() => window.localStorage.getItem("amanak.context"))).toBe(orgId)

  // Switch back to personal.
  await page.getByLabel("Switch workspace").click()
  await page.getByRole("option", { name: "Personal" }).click()
  await page.waitForLoadState("networkidle")
  await expect(page.locator(".amk-contextbadge")).toContainText("Personal")
  expect(await page.evaluate(() => window.localStorage.getItem("amanak.context"))).toBeNull()
})

test("isolation on switch", async ({ page }) => {
  const user = testUser()
  await useEnglish(page)
  await registerUser(page, user)
  const orgId = createOrgForUser(user.email, "Acme", `acme-${Date.now().toString(36)}`)

  // One personal account and one org-scoped account.
  createAccountForUser(user.email, "PersonalMail")
  createAccountForUser(user.email, "OrgMail", orgId)

  // Personal context: only the personal account is visible.
  await page.goto("/accounts")
  await waitForApiIdle(page)
  await expect(page.getByText("PersonalMail")).toBeVisible()
  await expect(page.getByText("OrgMail")).toHaveCount(0)

  // Switch to the org: only the org account is visible.
  await page.getByLabel("Switch workspace").click()
  await page.getByRole("option", { name: "Acme" }).click()
  await page.waitForLoadState("networkidle")
  await page.goto("/accounts")
  await waitForApiIdle(page)
  await expect(page.getByText("OrgMail")).toBeVisible()
  await expect(page.getByText("PersonalMail")).toHaveCount(0)

  // Switch back: the personal account returns, the org account is hidden.
  await page.getByLabel("Switch workspace").click()
  await page.getByRole("option", { name: "Personal" }).click()
  await page.waitForLoadState("networkidle")
  await page.goto("/accounts")
  await waitForApiIdle(page)
  await expect(page.getByText("PersonalMail")).toBeVisible()
  await expect(page.getByText("OrgMail")).toHaveCount(0)
})

test("org dashboard redirect + aggregates", async ({ page }) => {
  const user = testUser()
  await useEnglish(page)
  await registerUser(page, user)
  createOrgForUser(user.email, "Acme", `acme-${Date.now().toString(36)}`)

  // Personal context: /org redirects to /dashboard.
  await page.goto("/org")
  await expect(page).toHaveURL(/\/dashboard$/)

  // Org context: /org renders the aggregates card.
  await page.getByLabel("Switch workspace").click()
  await page.getByRole("option", { name: "Acme" }).click()
  await page.waitForLoadState("networkidle")
  await page.goto("/org")
  await waitForApiIdle(page)
  await expect(page.locator(".org-dashboard__title")).toContainText("Acme")
  await expect(page.locator(".amk-kpi")).toHaveCount(4)
})

test("login helper keeps the switcher for an existing user", async ({ page }) => {
  const user = testUser()
  await useEnglish(page)
  await registerUser(page, user)
  await page.getByRole("button", { name: /sign out/i }).click()
  await loginUser(page, user)
  await expect(page.locator(".amk-contextswitcher")).toBeVisible()
})
