#!/usr/bin/env node
/**
 * AMANAK web screenshot capture (P7.3 design system).
 *
 * This script is intentionally NOT part of the build or test pipeline.
 * Run it manually against a locally served web app to visually verify the
 * light/dark themes and the Arabic (RTL) / English (LTR) layouts.
 *
 * Prerequisites:
 *   npm install -D playwright   # then: npx playwright install chromium
 *   AMANAK_WEB_URL   base URL of the running app (default http://127.0.0.1:5173)
 *   AMANAK_EMAIL     demo account email used to sign in
 *   AMANAK_PASSWORD  demo account password
 *
 * Usage:
 *   AMANAK_EMAIL=you@example.com AMANAK_PASSWORD=secret npm run screenshots
 *
 * Output: apps/web/screenshots/<theme>-<locale>-<route>.png
 */

import { mkdir } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, "..", "screenshots")

const BASE_URL = process.env.AMANAK_WEB_URL ?? "http://127.0.0.1:5173"
const EMAIL = process.env.AMANAK_EMAIL
const PASSWORD = process.env.AMANAK_PASSWORD

const THEMES = ["dark", "light"]
const LOCALES = ["ar", "en"]
const VIEWPORTS = [{ name: "desktop", width: 1440, height: 960 }]

const ROUTES = [
  { path: "/", name: "dashboard" },
  { path: "/scanner", name: "scanner" },
  { path: "/breach", name: "breach" },
  { path: "/accounts", name: "accounts" },
  { path: "/devices", name: "devices" },
  { path: "/incidents", name: "incidents" },
  { path: "/ai", name: "ai" },
  { path: "/settings", name: "settings" },
]

async function signIn(page) {
  if (!EMAIL || !PASSWORD) return false
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" })
  await page.getByLabel(/email|البريد/i).fill(EMAIL)
  await page.getByLabel(/password|كلمة المرور/i).fill(PASSWORD)
  await page.getByRole("button", { name: /sign in|دخول/i }).click()
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 })
  return true
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const browser = await chromium.launch()

  for (const theme of THEMES) {
    for (const locale of LOCALES) {
      for (const viewport of VIEWPORTS) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: 1,
        })
        const page = await context.newPage()

        await page.addInitScript(
          ([t, l]) => {
            localStorage.setItem("amanak.theme", t)
            localStorage.setItem("amanak.locale", l)
          },
          [theme, locale],
        )

        await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" })
        await page.screenshot({
          path: resolve(OUT_DIR, `${theme}-${locale}-${viewport.name}-login.png`),
          fullPage: true,
        })

        const authed = await signIn(page)
        if (!authed) {
          console.warn("[screenshots] AMANAK_EMAIL/AMANAK_PASSWORD not set; capturing login only.")
          await context.close()
          continue
        }

        for (const route of ROUTES) {
          await page.goto(`${BASE_URL}${route.path}`, { waitUntil: "networkidle" })
          await page.screenshot({
            path: resolve(OUT_DIR, `${theme}-${locale}-${viewport.name}-${route.name}.png`),
            fullPage: true,
          })
        }

        await context.close()
      }
    }
  }

  await browser.close()
  console.log(`[screenshots] saved to ${OUT_DIR}`)
}

main().catch((error) => {
  console.error("[screenshots] failed:", error)
  process.exitCode = 1
})
