import { mkdir } from "node:fs/promises"
import { resolve } from "node:path"
import { test, expect, testUser, registerUser } from "./fixtures"

const ENABLED = process.env.E2E_SCREENSHOTS === "1"
const OUT_DIR = resolve(process.cwd(), "screenshots/p17")

/**
 * P17.1 screenshot set — 8 PNGs focused on the blue theme + navy sidebar:
 *   dashboard {dark,light} × {ar,en} plus sidebar/header detail shots.
 */

async function setThemeLocale(page, theme: string, locale: string) {
  await page.evaluate(
    ([t, l]) => {
      window.localStorage.setItem("amanak.theme", t)
      window.localStorage.setItem("amanak.locale", l)
    },
    [theme, locale],
  )
}

async function gotoApp(page, path: string) {
  await page.goto(path)
  await page.locator(".amk-sidebar").waitFor({ state: "visible" })
  await page.waitForTimeout(400)
}

test.skip(!ENABLED, "set E2E_SCREENSHOTS=1 to capture screenshots")

test("captures the P17.1 redesign", async ({ page }) => {
  test.setTimeout(180_000)
  await mkdir(OUT_DIR, { recursive: true })
  let count = 0

  await page.goto("/")
  await setThemeLocale(page, "dark", "en")
  await registerUser(page, testUser())

  // 4 dashboards: {dark, light} × {ar, en}
  for (const theme of ["dark", "light"] as const) {
    for (const locale of ["ar", "en"] as const) {
      await setThemeLocale(page, theme, locale)
      await gotoApp(page, "/dashboard")
      await expect(page).toHaveURL(/\/dashboard$/)
      await page.screenshot({
        path: resolve(OUT_DIR, `${theme}-${locale}-dashboard.png`),
        fullPage: true,
      })
      count += 1
    }
  }

  // 2 sidebar detail shots (light + dark), English.
  for (const theme of ["dark", "light"] as const) {
    await setThemeLocale(page, theme, "en")
    await gotoApp(page, "/dashboard")
    await page.locator(".amk-sidebar").screenshot({
      path: resolve(OUT_DIR, `${theme}-en-sidebar.png`),
    })
    count += 1
  }

  // 2 header detail shots (light + dark), English.
  for (const theme of ["dark", "light"] as const) {
    await setThemeLocale(page, theme, "en")
    await gotoApp(page, "/dashboard")
    await page.locator(".amk-header").screenshot({
      path: resolve(OUT_DIR, `${theme}-en-header.png`),
    })
    count += 1
  }

  // P17.2: dashboard empty-state (fresh user, no data) in light + Arabic.
  await setThemeLocale(page, "light", "ar")
  await gotoApp(page, "/dashboard")
  await page.waitForTimeout(400)
  await page.screenshot({
    path: resolve(OUT_DIR, "dashboard-empty-light-ar.png"),
    fullPage: true,
  })
  count += 1

  expect(count).toBe(9)
})
