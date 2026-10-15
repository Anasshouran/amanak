import {
  test,
  expect,
  testUser,
  useEnglish,
  registerUser,
  grantStaffRole,
  refreshSession,
} from "./fixtures"

test.beforeEach(async ({ page }) => {
  await useEnglish(page)
})

test("support agent sees only its own staff links and can open tickets", async ({ page }) => {
  const agent = testUser()
  await registerUser(page, agent)
  grantStaffRole(agent.email, "support")
  await refreshSession(page)

  const sidebar = page.locator(".amk-sidebar")
  await expect(sidebar.getByRole("link", { name: "Staff Home" })).toBeVisible()
  await expect(sidebar.getByRole("link", { name: "Users" })).toBeVisible()
  await expect(sidebar.getByRole("link", { name: "Tickets" })).toBeVisible()
  await expect(sidebar.getByRole("link", { name: "Metrics" })).toBeVisible()

  await expect(sidebar.getByRole("link", { name: "Audit log" })).toHaveCount(0)
  await expect(sidebar.getByRole("link", { name: "Subscriptions" })).toHaveCount(0)
  await expect(sidebar.getByRole("link", { name: "Announcements" })).toHaveCount(0)

  await sidebar.locator('a[href="/staff/tickets"]').click()
  await expect(page).toHaveURL(/\/staff\/tickets$/)

  const tickets = sidebar.locator('a[href="/staff/tickets"]')
  await expect(tickets).toHaveClass(/is-active/)
  await expect(tickets).toHaveAttribute("aria-current", "page")
})

test("security admin gets the audit link", async ({ page }) => {
  const admin = testUser()
  await registerUser(page, admin)
  grantStaffRole(admin.email, "security_admin")
  await refreshSession(page)

  const sidebar = page.locator(".amk-sidebar")
  const audit = sidebar.getByRole("link", { name: "Audit log" })
  await expect(audit).toBeVisible()
  await expect(sidebar.getByRole("link", { name: "Tickets" })).toHaveCount(0)

  await audit.click()
  await expect(page).toHaveURL(/\/staff\/audit$/)
})

test("collapsed staff section stays collapsed across reloads", async ({ page }) => {
  const agent = testUser()
  await registerUser(page, agent)
  grantStaffRole(agent.email, "support")
  await refreshSession(page)

  const items = page.locator(".amk-sidebar .amk-navsection__items")
  await expect(items).toBeVisible()

  await page.getByRole("button", { name: "Collapse staff menu" }).click()
  await expect(page.locator(".amk-sidebar .amk-navsection__items")).toHaveCount(0)

  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("nav.staff.collapsed")))
    .toBe("true")

  await refreshSession(page)

  await expect(page.getByRole("button", { name: "Expand staff menu" })).toBeVisible()
  await expect(page.locator(".amk-sidebar .amk-navsection__items")).toHaveCount(0)
})
