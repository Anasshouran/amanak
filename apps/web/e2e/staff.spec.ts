import {
  test,
  expect,
  testUser,
  useEnglish,
  registerUser,
  grantStaffRole,
  refreshSession,
  waitForApiIdle,
} from "./fixtures"

test.beforeEach(async ({ page }) => {
  await useEnglish(page)
})

test("support agent searches a user, sees no block button, and opens a ticket", async ({
  page,
}) => {
  const agent = testUser()
  await registerUser(page, agent)
  grantStaffRole(agent.email, "support")
  await refreshSession(page)

  // The staff entry appears in the navigation for staff members only.
  await page.getByRole("link", { name: "Staff" }).first().click()
  await expect(page.getByRole("heading", { name: "Staff overview" })).toBeVisible()

  await page.goto("/staff/users")
  await waitForApiIdle(page)
  await page.getByLabel("Search").fill(agent.email)
  const row = page.getByRole("cell", { name: agent.email })
  await expect(row).toBeVisible()
  await page.getByRole("link", { name: "Open", exact: true }).first().click()
  await expect(page.getByRole("heading", { name: agent.email })).toBeVisible()

  // Support must not be able to block users.
  await expect(page.getByRole("button", { name: "Block user" })).toHaveCount(0)

  // Open a ticket from the tickets page.
  await page.goto("/staff/tickets")
  await waitForApiIdle(page)
  await page.getByRole("button", { name: "New ticket" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Subject").fill("E2E support ticket")
  await dialog.getByLabel("Message").fill("Something is not working.")
  await dialog.getByRole("button", { name: "Create" }).click()
  await waitForApiIdle(page)

  await expect(page.getByText("E2E support ticket").first()).toBeVisible()
})

test("security admin blocks a user and the action shows in the audit log", async ({
  page,
  browser,
}) => {
  // Create a separate victim account in an isolated context.
  const victim = testUser()
  const victimContext = await browser.newContext()
  const victimPage = await victimContext.newPage()
  await victimPage.addInitScript(() => {
    window.localStorage.setItem("amanak.locale", "en")
    window.localStorage.setItem("amanak.theme", "dark")
  })
  await registerUser(victimPage, victim)
  await victimContext.close()

  const admin = testUser()
  await registerUser(page, admin)
  grantStaffRole(admin.email, "security_admin")
  await refreshSession(page)

  await page.goto("/staff/users")
  await waitForApiIdle(page)
  await page.getByLabel("Search").fill(victim.email)
  await expect(page.getByRole("cell", { name: victim.email })).toBeVisible()
  await page.getByRole("link", { name: "Open", exact: true }).first().click()
  await expect(page.getByRole("heading", { name: victim.email })).toBeVisible()

  const blockButton = page.getByRole("button", { name: "Block user" })
  await expect(blockButton).toBeVisible()
  await blockButton.click()

  const dialog = page.getByRole("dialog")
  await dialog.getByRole("textbox").fill("e2e block reason")
  await dialog.getByRole("button", { name: "Block" }).click()
  await expect(page.getByText("User blocked")).toBeVisible()
  await waitForApiIdle(page)

  await page.goto("/staff/audit")
  await waitForApiIdle(page)
  await expect(page.getByRole("cell", { name: "user.block" }).first()).toBeVisible()
  await expect(page.getByText("e2e block reason").first()).toBeVisible()
})
