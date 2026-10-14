import { mkdir } from "node:fs/promises"
import { resolve } from "node:path"
import { test, expect, testUser, useEnglish, registerUser } from "./fixtures"

const ENABLED = process.env.E2E_SCREENSHOTS === "1"
const OUT_DIR = resolve(process.cwd(), "screenshots")

const THEMES = ["dark", "light"] as const
const LOCALES = ["ar", "en"] as const

const ROUTES = [
  { path: "/login", name: "login" },
  { path: "/register", name: "register" },
  { path: "/dashboard", name: "dashboard" },
  { path: "/scanner", name: "scanner" },
  { path: "/breach", name: "breach" },
  { path: "/accounts", name: "accounts" },
  { path: "/devices", name: "devices" },
  { path: "/incidents", name: "incidents" },
  { path: "/ai", name: "ai" },
  { path: "/settings", name: "settings" },
]

test.skip(!ENABLED, "set E2E_SCREENSHOTS=1 to capture screenshots")

test("captures every screen in both themes and both locales", async ({ page }) => {
  await mkdir(OUT_DIR, { recursive: true })
  await useEnglish(page)

  // Sign in once; the session survives reloads via the HttpOnly refresh cookie.
  await registerUser(page, testUser())

  let count = 0
  for (const theme of THEMES) {
    for (const locale of LOCALES) {
      await page.evaluate(
        ([t, l]) => {
          window.localStorage.setItem("amanak.theme", t)
          window.localStorage.setItem("amanak.locale", l)
        },
        [theme, locale],
      )

      for (const route of ROUTES) {
        await page.goto(route.path)
        await page.waitForLoadState("networkidle")
        await page.screenshot({
          path: resolve(OUT_DIR, `${theme}-${locale}-${route.name}.png`),
          fullPage: true,
        })
        count += 1
      }
    }
  }

  expect(count).toBe(THEMES.length * LOCALES.length * ROUTES.length)
  expect(count).toBe(40)
})
