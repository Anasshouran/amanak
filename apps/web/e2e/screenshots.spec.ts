import { mkdir } from "node:fs/promises"
import { resolve } from "node:path"
import { test, expect, testUser, registerUser, waitForApiIdle } from "./fixtures"

const ENABLED = process.env.E2E_SCREENSHOTS === "1"
const OUT_DIR = resolve(process.cwd(), "screenshots/p15")

const THEMES = ["dark", "light"] as const
const LOCALES = ["ar", "en"] as const

/**
 * P15 screenshot set — 20 PNGs:
 *   landing hero / features / pricing (anonymous) + dashboard / scanner
 *   × {dark, light} × {ar, en}.
 */
test.skip(!ENABLED, "set E2E_SCREENSHOTS=1 to capture screenshots")

test("captures the landing page and key app screens", async ({ page }) => {
  await mkdir(OUT_DIR, { recursive: true })
  let count = 0

  async function setThemeLocale(theme: string, locale: string) {
    await page.evaluate(
      ([t, l]) => {
        window.localStorage.setItem("amanak.theme", t)
        window.localStorage.setItem("amanak.locale", l)
      },
      [theme, locale],
    )
  }

  await page.goto("/")
  await waitForApiIdle(page)

  // Anonymous landing page.
  for (const theme of THEMES) {
    for (const locale of LOCALES) {
      await setThemeLocale(theme, locale)
      await page.reload()
      await waitForApiIdle(page)

      await page.locator(".amk-hero").screenshot({
        path: resolve(OUT_DIR, `${theme}-${locale}-landing-hero.png`),
      })
      count += 1
      await page.locator("#features").screenshot({
        path: resolve(OUT_DIR, `${theme}-${locale}-landing-features.png`),
      })
      count += 1
      await page.locator("#pricing").screenshot({
        path: resolve(OUT_DIR, `${theme}-${locale}-landing-pricing.png`),
      })
      count += 1
    }
  }

  // Sign in once; the session survives reloads via the HttpOnly refresh cookie.
  await setThemeLocale("dark", "en")
  await page.reload()
  await waitForApiIdle(page)
  await registerUser(page, testUser())

  for (const theme of THEMES) {
    for (const locale of LOCALES) {
      await setThemeLocale(theme, locale)

      await page.goto("/dashboard")
      await waitForApiIdle(page)
      await page.screenshot({
        path: resolve(OUT_DIR, `${theme}-${locale}-dashboard.png`),
        fullPage: true,
      })
      count += 1

      await page.goto("/scanner")
      await waitForApiIdle(page)
      await page.screenshot({
        path: resolve(OUT_DIR, `${theme}-${locale}-scanner.png`),
        fullPage: true,
      })
      count += 1
    }
  }

  expect(count).toBe(20)
})
