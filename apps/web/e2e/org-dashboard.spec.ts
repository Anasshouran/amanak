import {
  test,
  expect,
  testUser,
  registerUser,
  createOrgForUser,
  createOrgDevice,
  createOrgIncident,
  setOrgRole,
  waitForApiIdle,
  useEnglish,
} from "./fixtures"

test.describe.configure({ mode: "serial" })

/**
 * P18.2 — Org Dashboard v2 e2e.
 *
 * Verifies role-gated rendering: owner sees everything, analyst sees
 * devices + incidents (no members table), employee sees KPIs only.
 */
async function switchToOrg(page: import("@playwright/test").Page, name: string) {
  await page.getByLabel("Switch workspace").click()
  await page.getByRole("option", { name }).click()
  await page.waitForLoadState("networkidle")
}

test("owner sees the full dashboard", async ({ page }) => {
  const user = testUser()
  await useEnglish(page)
  await registerUser(page, user)
  const orgId = createOrgForUser(user.email, "Acme", `acme-${Date.now().toString(36)}`)
  createOrgDevice(user.email, orgId, "MacBook")
  createOrgIncident(user.email, orgId, "Suspicious login")

  await page.goto("/org")
  await waitForApiIdle(page)
  await switchToOrg(page, "Acme")
  await page.goto("/org")
  await waitForApiIdle(page)

  await expect(page.getByRole("heading", { name: "Recent Devices" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Recent Incidents" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Recent Activity" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Members" }).first()).toBeVisible()
})

test("analyst sees devices + incidents but no members table", async ({ page }) => {
  const user = testUser()
  await useEnglish(page)
  await registerUser(page, user)
  const orgId = createOrgForUser(user.email, "Beta", `beta-${Date.now().toString(36)}`)
  createOrgDevice(user.email, orgId, "MacBook")
  createOrgIncident(user.email, orgId, "Unusual device")
  setOrgRole(user.email, orgId, "analyst")

  await page.goto("/org")
  await waitForApiIdle(page)
  await switchToOrg(page, "Beta")
  await page.goto("/org")
  await waitForApiIdle(page)

  await expect(page.getByRole("heading", { name: "Recent Devices" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Recent Incidents" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Recent Activity" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Members" })).toHaveCount(0)
})

test("employee sees KPIs only", async ({ page }) => {
  const user = testUser()
  await useEnglish(page)
  await registerUser(page, user)
  const orgId = createOrgForUser(user.email, "Gamma", `gamma-${Date.now().toString(36)}`)
  createOrgDevice(user.email, orgId, "MacBook")
  setOrgRole(user.email, orgId, "employee")

  await page.goto("/org")
  await waitForApiIdle(page)
  await switchToOrg(page, "Gamma")
  await page.goto("/org")
  await waitForApiIdle(page)

  // The KPI grid is present…
  await expect(page.locator(".amk-kpi")).toHaveCount(4)
  // …but none of the data sections are.
  await expect(page.getByRole("heading", { name: "Recent Devices" })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Recent Incidents" })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Recent Activity" })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Members" })).toHaveCount(0)
})

test("switching context loads the correct org data", async ({ page }) => {
  const user = testUser()
  await useEnglish(page)
  await registerUser(page, user)
  const orgA = createOrgForUser(user.email, "Delta", `delta-${Date.now().toString(36)}`)
  createOrgDevice(user.email, orgA, "DeltaBook")

  await page.goto("/org")
  await waitForApiIdle(page)
  await switchToOrg(page, "Delta")
  await page.goto("/org")
  await waitForApiIdle(page)

  await expect(page.getByText("DeltaBook").first()).toBeVisible()
})
