import { mkdir } from "node:fs/promises"
import { resolve } from "node:path"
import type { Page } from "@playwright/test"
import { test, expect } from "./fixtures"
import {
  testUser,
  registerUser,
  createOrgForUser,
  createInvitation,
  waitForApiIdle,
  useEnglish,
} from "./fixtures"

const ENABLED = process.env.E2E_SCREENSHOTS === "1"
const OUT_DIR = resolve(process.cwd(), "screenshots/p18.3")
const MOBILE_BASE = process.env.E2E_MOBILE_BASE_URL || "http://localhost:8081"

/** P18.3 screenshot set — 5 PNGs covering members, invites and acceptance. */

/** Pin theme + locale for every subsequent navigation (registered last wins). */
async function setThemeLocale(page: Page, theme: string, locale: string) {
  await page.addInitScript(
    ([t, l]) => {
      window.localStorage.setItem("amanak.theme", t)
      window.localStorage.setItem("amanak.locale", l)
    },
    [theme, locale],
  )
}

async function switchToOrg(page: Page, name: string) {
  await page.getByLabel("Switch workspace").click()
  await page.getByRole("option", { name }).click()
  await page.waitForLoadState("networkidle")
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: resolve(OUT_DIR, name), fullPage: true })
  console.log("✓", name)
}

test.skip(!ENABLED, "set E2E_SCREENSHOTS=1 to capture screenshots")

test("captures the P18.3 members + invites set (web)", async ({ browser }) => {
  test.setTimeout(300_000)
  await mkdir(OUT_DIR, { recursive: true })

  const owner = testUser()
  const invitee = testUser()

  const ownerCtx = await browser.newContext()
  const inviteeCtx = await browser.newContext()
  const page = await ownerCtx.newPage()

  await useEnglish(page)
  await registerUser(page, owner)
  const orgId = createOrgForUser(owner.email, "Acme", `acme-${Date.now().toString(36)}`)
  // A second member and a pending invite make the table and panel realistic.
  createInvitation(owner.email, invitee.email, orgId, "analyst")

  await page.goto("/org")
  await waitForApiIdle(page)
  await switchToOrg(page, "Acme")

  // 1 — Members table (owner), light, العربية.
  await setThemeLocale(page, "light", "ar")
  await page.goto("/org")
  await waitForApiIdle(page)
  await shot(page, "members-table-owner-light-ar.png")

  // 2 — Invite modal, light, العربية.
  await page.getByRole("button", { name: "+ دعوة", exact: true }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, "invite-modal-light-ar.png")

  // 3 — Accept landing page for the invitee, light, العربية.
  const inviteePage = await inviteeCtx.newPage()
  await useEnglish(inviteePage)
  await registerUser(inviteePage, invitee)
  const token = createInvitation(owner.email, invitee.email, orgId, "employee")
  await setThemeLocale(inviteePage, "light", "ar")
  await inviteePage.goto(`/invitations/accept?token=${encodeURIComponent(token)}`)
  await waitForApiIdle(inviteePage)
  await shot(inviteePage, "invitations-accept-light-ar.png")

  // 4 — Members table, dark, English.
  await setThemeLocale(page, "dark", "en")
  await page.goto("/org")
  await waitForApiIdle(page)
  await shot(page, "members-table-dark-en.png")

  await ownerCtx.close()
  await inviteeCtx.close()
})

test("captures the P18.3 mobile members card", async ({ page }) => {
  test.setTimeout(240_000)
  await mkdir(OUT_DIR, { recursive: true })

  const owner = testUser()
  await useEnglish(page)
  await registerUser(page, owner)
  const orgId = createOrgForUser(owner.email, "Acme", `acme-${Date.now().toString(36)}`)
  createInvitation(owner.email, `pending+${Date.now().toString(36)}@local.dev`, orgId, "analyst")

  await page.goto(`${MOBILE_BASE}/login`, { waitUntil: "domcontentloaded" })
  await page.getByPlaceholder("Email").fill(owner.email)
  await page.getByPlaceholder("Password", { exact: true }).fill(owner.password)
  // React Native Web uses role="button" / text in pressables; fall back to
  // the heading/text "Sign in".
  await page.getByRole("button", { name: "Sign in" }).first().click().catch(async () => {
    await page.getByText("Sign in", { exact: true }).first().click()
  })
  await page.waitForURL(`${MOBILE_BASE}/dashboard`, { timeout: 30_000 }).catch(() => {})

  await page.addInitScript((id) => {
    window.localStorage.setItem("amanak.context", id)
  }, orgId)
  await setThemeLocale(page, "light", "ar")
  await page.goto(`${MOBILE_BASE}/org`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(5000)

  // Open the inline invite form so the action is visible in the shot.
  await page.getByText("+ دعوة", { exact: true }).first().click().catch(() => {})
  await page.waitForTimeout(800)
  await shot(page, "invitations-mobile-light-ar.png")
})
