import {
  test,
  expect,
  testUser,
  registerUser,
  loginUser,
  createOrgForUser,
  createOrgForEmail,
  createInvitation,
  createUserWithPassword,
  addOrgMember,
  isOrgMember,
  waitForApiIdle,
  useEnglish,
} from "./fixtures"

test.describe.configure({ mode: "serial" })

/**
 * P18.3 — Members & invites e2e.
 *
 * Covers the two invitation entry points (the members table / pending panel
 * inside the org dashboard, and the email landing page) plus the permission
 * rules: admins may remove but not change roles, and the last owner can
 * neither be demoted nor removed.
 */
async function switchToOrg(page: import("@playwright/test").Page, name: string) {
  await page.getByLabel("Switch workspace").click()
  await page.getByRole("option", { name }).click()
  await page.waitForLoadState("networkidle")
}

test("owner invites a member and the invite lands in Pending", async ({ page }) => {
  const owner = testUser()
  const inviteeEmail = `invitee+${Date.now().toString(36)}@local.dev`
  await useEnglish(page)
  await registerUser(page, owner)
  const orgId = createOrgForUser(owner.email, "Acme", `acme-${Date.now().toString(36)}`)

  await page.goto("/org")
  await waitForApiIdle(page)
  await switchToOrg(page, "Acme")
  await page.goto("/org")
  await waitForApiIdle(page)

  // Members heading + invite action are owner-visible.
  await expect(page.getByRole("heading", { name: "Members" })).toBeVisible()
  await page.getByRole("button", { name: /Invite/ }).click()

  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()

  // Client-side validation runs before any request.
  await dialog.getByLabel("Email").fill("not-an-email")
  await dialog.getByRole("button", { name: "Send invite" }).click()
  await expect(dialog.getByText("Please enter a valid email address")).toBeVisible()

  await dialog.getByLabel("Email").fill(inviteeEmail)
  await dialog.getByRole("button", { name: "Send invite" }).click()

  await expect(dialog).toBeHidden()
  // The pending panel refreshes and shows the address that was just invited.
  await expect(page.getByText(inviteeEmail)).toBeVisible()

  // The last (only) owner can neither be demoted nor removed.
  const roleSelect = page.getByLabel("Change role")
  await expect(roleSelect).toHaveCount(1)
  await expect(roleSelect).toBeDisabled()
  await expect(page.getByRole("button", { name: "Remove", exact: true })).toHaveCount(0)

  // Sanity check on the server state.
  expect(isOrgMember(inviteeEmail, orgId)).toBe(false)
})

test("invitee accepts from the invitations list and joins the org", async ({ page }) => {
  const invitee = testUser()
  await useEnglish(page)
  await registerUser(page, invitee)

  const ownerEmail = `owner+${Date.now().toString(36)}@local.dev`
  const orgId = createOrgForEmail(ownerEmail, "Beta Corp", `beta-${Date.now().toString(36)}`)
  createInvitation(ownerEmail, invitee.email, orgId)

  // /me/invitations/ must list it, and the dashboard surfaces a banner.
  await page.goto("/dashboard")
  await waitForApiIdle(page)
  await expect(page.getByText("You have pending invitations")).toBeVisible()

  await page.getByRole("link", { name: /Review/ }).click()
  await expect(page).toHaveURL(/\/invitations$/)
  await expect(page.getByText("Beta Corp")).toBeVisible()

  await page.getByRole("button", { name: "Accept" }).click()
  await expect(page).toHaveURL(/\/org$/)

  expect(isOrgMember(invitee.email, orgId)).toBe(true)
})

test("accept page joins with an invite link token", async ({ page }) => {
  const invitee = testUser()
  await useEnglish(page)
  await registerUser(page, invitee)

  const ownerEmail = `owner+${Date.now().toString(36)}@local.dev`
  const orgId = createOrgForEmail(ownerEmail, "Gamma", `gamma-${Date.now().toString(36)}`)
  const token = createInvitation(ownerEmail, invitee.email, orgId, "analyst")

  await page.goto(`/invitations/accept?token=${encodeURIComponent(token)}`)
  await waitForApiIdle(page)

  await expect(page.getByRole("heading", { name: "Invitation" })).toBeVisible()
  await page.getByRole("button", { name: "Accept" }).click()

  await expect(page.getByText("You are now a member.")).toBeVisible()
  expect(isOrgMember(invitee.email, orgId)).toBe(true)
})

test("accept page reports an invalid token", async ({ page }) => {
  const invitee = testUser()
  await useEnglish(page)
  await registerUser(page, invitee)

  await page.goto("/invitations/accept?token=definitely-not-a-real-token")
  await waitForApiIdle(page)

  await page.getByRole("button", { name: "Accept" }).click()
  await expect(
    page.getByText("This invitation is invalid. Ask the inviter to resend."),
  ).toBeVisible()
})

test("admin can remove a member but cannot change roles", async ({ page }) => {
  const owner = testUser()
  const admin: { email: string; username: string; password: string } = {
    email: `admin+${Date.now().toString(36)}@local.dev`,
    username: `e2e_admin_${Date.now().toString(36)}`,
    password: "Password123!",
  }
  const memberEmail = `member+${Date.now().toString(36)}@local.dev`

  await useEnglish(page)
  await registerUser(page, owner)
  const orgId = createOrgForUser(owner.email, "Delta", `delta-${Date.now().toString(36)}`)

  createUserWithPassword(admin.email, admin.username, admin.password)
  createUserWithPassword(
    memberEmail,
    `e2e_member_${Date.now().toString(36)}`,
    "Password123!",
  )
  addOrgMember(admin.email, orgId, "admin")
  addOrgMember(memberEmail, orgId, "employee")

  await page.getByRole("button", { name: "Sign out" }).click()
  await loginUser(page, admin)

  await page.goto("/org")
  await waitForApiIdle(page)
  await switchToOrg(page, "Delta")
  await page.goto("/org")
  await waitForApiIdle(page)

  // Admins get the remove action but no role dropdown.
  await expect(page.getByRole("heading", { name: "Members" })).toBeVisible()
  await expect(page.getByLabel("Change role")).toHaveCount(0)

  // Scope to the Members section: the activity feed also renders rows that
  // contain the member's address ("Member joined: …").
  const membersSection = page.locator("section.amk-org-section", {
    has: page.getByRole("heading", { name: "Members" }),
  })
  const memberRow = membersSection.locator(".amk-org-table__row", { hasText: memberEmail })
  await expect(memberRow).toBeVisible()
  await memberRow.getByRole("button", { name: "Remove", exact: true }).click()
  await expect(memberRow.getByRole("button", { name: "Remove member" })).toBeVisible()
  await memberRow.getByRole("button", { name: "Remove member" }).click()

  // The row disappears from the members table (the activity feed legitimately
  // keeps the historical event).
  await expect(memberRow).toHaveCount(0)
  expect(isOrgMember(memberEmail, orgId)).toBe(false)
})
