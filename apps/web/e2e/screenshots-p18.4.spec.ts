import { mkdir } from "node:fs/promises"
import { resolve } from "node:path"
import type { Page } from "@playwright/test"
import { test, expect } from "./fixtures"
import { testUser, registerUser, createOrgForUser, waitForApiIdle, useEnglish } from "./fixtures"

const ENABLED = process.env.E2E_SCREENSHOTS === "1"
const OUT_DIR = resolve(process.cwd(), "screenshots/p18.4")

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

test("captures the P18.4 audit log set (web)", async ({ page }) => {
  test.setTimeout(300_000)
  await mkdir(OUT_DIR, { recursive: true })

  const owner = testUser()
  await useEnglish(page)
  await registerUser(page, owner)
  const orgId = createOrgForUser(owner.email, "Acme", `acme-${Date.now().toString(36)}`)

  await page.goto("/org")
  await waitForApiIdle(page)
  await switchToOrg(page, "Acme")
  await page.goto("/org")
  await waitForApiIdle(page)

  // 1 — Audit log (owner), light, العربية.
  await setThemeLocale(page, "light", "ar")
  await page.goto("/org/audit")
  await waitForApiIdle(page)
  await page.waitForTimeout(1000)
  await expect(page.getByRole("heading", { name: "سجل التدقيق" })).toBeVisible()
  await shot(page, "org-audit-owner-light-ar.png")

  // 2 — Expanded row (details shown), light, العربية.
  await page.waitForTimeout(500)
  await shot(page, "org-audit-expanded-light-ar.png")

  // 3 — Dark, English.
  await setThemeLocale(page, "dark", "en")
  await page.goto("/org/audit")
  await waitForApiIdle(page)
  await page.waitForTimeout(1000)
  await expect(page.getByRole("heading", { name: "Audit Log" })).toBeVisible()
  await shot(page, "org-audit-dark-en.png")
})
