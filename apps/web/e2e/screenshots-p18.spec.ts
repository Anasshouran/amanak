import { mkdir } from "node:fs/promises"
import { resolve } from "node:path"
import type { Page } from "@playwright/test"
import { test, expect } from "./fixtures"
import {
  testUser,
  registerUser,
  createOrgForUser,
  createOrgDevice,
  createOrgIncident,
  setOrgRole,
  waitForApiIdle,
  useEnglish,
} from "./fixtures"

const ENABLED = process.env.E2E_SCREENSHOTS === "1"
const OUT_DIR = resolve(process.cwd(), "screenshots/p18")
const MOBILE_BASE = process.env.E2E_MOBILE_BASE_URL || "http://localhost:8081"

/** P18.2 screenshot set — 5 PNGs covering the org dashboard (web + mobile). */

/**
 * Pin theme + locale for every subsequent navigation.
 *
 * `useEnglish()` registers an init script that forces dark/en on each page
 * load; registering ours *after* it wins, because init scripts run in the
 * order they were added.
 */
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

test("captures the P18.2 org dashboard set", async ({ page }) => {
  test.setTimeout(240_000)
  await mkdir(OUT_DIR, { recursive: true })

  const user = testUser()
  await useEnglish(page)
  await registerUser(page, user)
  const orgId = createOrgForUser(user.email, "Acme", `acme-${Date.now().toString(36)}`)
  createOrgDevice(user.email, orgId, "MacBook")
  createOrgDevice(user.email, orgId, "iPhone 15")
  createOrgIncident(user.email, orgId, "Suspicious login")
  createOrgIncident(user.email, orgId, "Unusual device")

  // Switch to the org while the UI is still English (stable switcher label).
  await page.goto("/org")
  await waitForApiIdle(page)
  await switchToOrg(page, "Acme")

  // Owner — light, العربية.
  await setThemeLocale(page, "light", "ar")
  await page.goto("/org")
  await waitForApiIdle(page)
  await shot(page, "org-dashboard-owner-light-ar.png")

  // Analyst — light, العربية (no members table).
  setOrgRole(user.email, orgId, "analyst")
  await page.reload()
  await waitForApiIdle(page)
  await shot(page, "org-dashboard-analyst-light-ar.png")

  // Employee — light, العربية (KPIs only).
  setOrgRole(user.email, orgId, "employee")
  await page.reload()
  await waitForApiIdle(page)
  await shot(page, "org-dashboard-employee-light-ar.png")

  // Back to owner — dark, English.
  setOrgRole(user.email, orgId, "owner")
  await setThemeLocale(page, "dark", "en")
  await page.reload()
  await waitForApiIdle(page)
  await shot(page, "org-dashboard-dark-en.png")
})

test("captures the P18.2 mobile org dashboard", async ({ page }) => {
  test.setTimeout(180_000)
  await mkdir(OUT_DIR, { recursive: true })

  const user = testUser()
  await useEnglish(page)
  await registerUser(page, user)
  const orgId = createOrgForUser(user.email, "Acme", `acme-${Date.now().toString(36)}`)
  createOrgDevice(user.email, orgId, "MacBook")
  createOrgIncident(user.email, orgId, "Suspicious login")

  await page.goto(`${MOBILE_BASE}/login`, { waitUntil: "domcontentloaded" })
  await page.getByPlaceholder("Email").fill(user.email)
  await page.getByPlaceholder("Password", { exact: true }).fill(user.password)
  await page
    .locator("div[class*='r-backgroundColor-']")
    .filter({ hasText: /^Sign in$/ })
    .first()
    .click()
  await page.waitForURL(`${MOBILE_BASE}/dashboard`, { timeout: 30_000 }).catch(() => {})

  // Activate the org context, light + العربية, then open the org tab.
  await page.addInitScript((id) => {
    window.localStorage.setItem("amanak.context", id)
  }, orgId)
  await setThemeLocale(page, "light", "ar")
  await page.goto(`${MOBILE_BASE}/org`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(5000)
  await shot(page, "org-dashboard-mobile-light-ar.png")
})
