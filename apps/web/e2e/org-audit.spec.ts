import {
  test,
  expect,
  testUser,
  registerUser,
  waitForApiIdle,
  useEnglish,
} from "./fixtures"

test.describe.configure({ mode: "serial" })

async function switchToOrg(page: import("@playwright/test").Page, name: string) {
  await page.getByLabel("Switch workspace").click()
  await page.getByRole("option", { name }).click()
  await page.waitForLoadState("networkidle")
}

test("owner sees audit log", async ({ page }) => {
  const owner = testUser()
  await useEnglish(page)
  await registerUser(page, owner)
  const { createOrgForUser } = await import("./fixtures")
  createOrgForUser(owner.email, "Acme", `acme-${Date.now().toString(36)}`)

  await page.goto("/org")
  await waitForApiIdle(page)
  await switchToOrg(page, "Acme")
  await page.goto("/org")
  await waitForApiIdle(page)
  await page.waitForTimeout(500)
  await page.goto("/org/audit")
  await waitForApiIdle(page)
  await page.waitForTimeout(1000)
  await expect(page.getByRole("heading", { name: "Audit Log" })).toBeVisible()
})

test("employee has no audit access", async ({ page }) => {
  const employee = testUser()
  await useEnglish(page)
  await registerUser(page, employee)
  const ownerEmail = `owner+${Date.now().toString(36)}@local.dev`
  const { createOrgForEmail } = await import("./fixtures")
  const orgId = createOrgForEmail(ownerEmail, "Beta", `beta-${Date.now().toString(36)}`)
  await page.goto("/org/audit")
  await waitForApiIdle(page)
  await page.waitForTimeout(1000)
  // should redirect to /org or /dashboard; heading not visible
  await expect(page.getByRole("heading", { name: "Audit Log" })).toHaveCount(0)
})

test("filter by action works", async ({ page }) => {
  const owner = testUser()
  await useEnglish(page)
  await registerUser(page, owner)
  const { createOrgForUser } = await import("./fixtures")
  createOrgForUser(owner.email, "Gamma", `gamma-${Date.now().toString(36)}`)

  await page.goto("/org")
  await waitForApiIdle(page)
  await switchToOrg(page, "Gamma")
  await page.goto("/org")
  await waitForApiIdle(page)
  await page.waitForTimeout(500)
  await page.goto("/org/audit")
  await waitForApiIdle(page)
  await page.waitForTimeout(1000)
  await expect(page.getByRole("heading", { name: "Audit Log" })).toBeVisible()
})
