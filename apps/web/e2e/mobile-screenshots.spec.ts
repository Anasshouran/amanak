import { mkdir } from "node:fs/promises"
import { resolve } from "node:path"
import type { Page } from "@playwright/test"
import { test, expect } from "@playwright/test"

const ENABLED = process.env.E2E_SCREENSHOTS === "1"
const OUT_DIR = resolve(process.cwd(), "screenshots/p17")
const BASE = process.env.E2E_MOBILE_BASE_URL || "http://localhost:8081"
const API = process.env.E2E_API_URL || "http://localhost:8080/api/v1"

const stamp = Date.now()
const email = `shot-p176c2-${stamp}@example.com`
const password = "Sup3rSecret!pass1"
const MASTER = "correct-horse-battery-staple"

const body = async (page: Page) => (await page.locator("body").innerText()).replace(/\s+/g, " ")
const shot = async (page: Page, name: string) => {
  await page.screenshot({ path: resolve(OUT_DIR, name) })
  console.log("✓", name)
}

test.skip(!ENABLED, "set E2E_SCREENSHOTS=1 to capture mobile screenshots")

test("captures the mobile screenshot set", async ({ page }) => {
  test.setTimeout(300_000)
  await mkdir(OUT_DIR, { recursive: true })

  // Register + seed scans via API
  const reg = await fetch(`${API}/auth/register/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, username: `p176c2${stamp}`, password }),
  })
  if (!reg.ok) throw new Error(`register failed: ${reg.status}`)
  const access = (await reg.json()).tokens.access
  const auth = { "Content-Type": "application/json", Authorization: `Bearer ${access}` }
  const post = async (path: string, payload: any) => {
    await fetch(`${API}${path}`, { method: "POST", headers: auth, body: JSON.stringify(payload) })
  }
  await post("/scan/url", { input: "https://github.com/amanak" })
  await post("/scan/url", { input: "http://paypal-secure-login.xyz/verify" })
  await post("/scan/message", { input: "Your parcel is held. Pay the 1.99 fee here: bit.ly/x-y-z" })

  // Sign in
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" })
  await page.getByPlaceholder("Email").fill(email)
  await page.getByPlaceholder("Password", { exact: true }).fill(password)
  await page
    .locator("div[class*='r-backgroundColor-']")
    .filter({ hasText: /^Sign in$/ })
    .first()
    .click()
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 30_000 })
  await page.waitForTimeout(4000)

  // Dashboard light ar (default)
  await shot(page, "mobile-dashboard-light-ar.png")

  // Dashboard dark en
  await page.evaluate(() => {
    window.localStorage.setItem("amanak.theme", "dark")
    window.localStorage.setItem("amanak.locale", "en")
  })
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForTimeout(4000)
  await shot(page, "mobile-dashboard-dark-en.png")

  // More drawer (light ar)
  await page.evaluate(() => {
    window.localStorage.setItem("amanak.theme", "light")
    window.localStorage.setItem("amanak.locale", "ar")
  })
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForTimeout(4000)
  await page.locator("div[tabindex='0']").last().click().catch(() => {})
  await page.waitForTimeout(800)
  await shot(page, "mobile-more-drawer-light-ar.png")

  // Tabs light ar
  await shot(page, "mobile-tabs-light-ar.png")

  // Scanner light ar (idle)
  await page.goto(`${BASE}/scanner`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(2000)
  await shot(page, "mobile-scanner-light-ar.png")

  // Scanner dark en (idle)
  await page.evaluate(() => {
    window.localStorage.setItem("amanak.theme", "dark")
    window.localStorage.setItem("amanak.locale", "en")
  })
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForTimeout(2000)
  await shot(page, "mobile-scanner-dark-en.png")

  // 2FA
  await page.evaluate(() => {
    window.localStorage.setItem("amanak.theme", "light")
    window.localStorage.setItem("amanak.locale", "ar")
  })
  await page.goto(`${BASE}/2fa`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(2000)
  const masterInput2 = page.getByLabel("كلمة المرور الرئيسية").first()
  if (await masterInput2.isVisible().catch(() => false)) {
    await masterInput2.fill(MASTER)
    await page.getByLabel("تأكيد كلمة المرور الرئيسية").fill(MASTER)
    await page.getByRole("button", { name: "إنشاء الخزنة", exact: true }).click()
    await page.waitForTimeout(2500)
  }
  await shot(page, "mobile-2fa-list-light-ar.png")

  // 2FA dark en
  await page.evaluate(() => {
    window.localStorage.setItem("amanak.theme", "dark")
    window.localStorage.setItem("amanak.locale", "en")
  })
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForTimeout(2500)
  await shot(page, "mobile-2fa-dark-en.png")

  // Vault
  await page.evaluate(() => {
    window.localStorage.setItem("amanak.theme", "light")
    window.localStorage.setItem("amanak.locale", "ar")
  })
  await page.goto(`${BASE}/passwords`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(2000)
  const mi = page.getByLabel("كلمة المرور الرئيسية").first()
  if (await mi.isVisible().catch(() => false)) {
    await mi.fill(MASTER)
    const ci = page.getByLabel("تأكيد كلمة المرور الرئيسية")
    if (await ci.isVisible().catch(() => false)) await ci.fill(MASTER)
    await page.getByRole("button", { name: "إنشاء الخزنة", exact: true }).click()
    await page.waitForTimeout(2500)
  }
  // add entry
  const addBtn = page.getByRole("button", { name: "إضافة قيد", exact: true }).first()
  await addBtn.click().catch(() => {})
  await page.waitForTimeout(1000)
  const ins = await page.locator("input").all()
  if (ins.length >= 1) await ins[0].fill("GitHub")
  if (ins.length >= 2) await ins[1].fill("me@example.com")
  if (ins.length >= 3) await ins[2].fill("secret123")
  if (ins.length >= 4) await ins[3].fill("https://github.com")
  const save = page.getByRole("button", { name: "إضافة كلمة مرور", exact: true }).first()
  await save.click().catch(() => {})
  await page.waitForTimeout(2500)
  await shot(page, "mobile-vault-unlocked-light-ar.png")

  // reveal
  const reveal = page.getByRole("button", { name: "عرض", exact: true }).first()
  await reveal.click().catch(() => {})
  await page.waitForTimeout(800)
  await shot(page, "mobile-vault-revealed-light-ar.png")

  // lock
  const lock = page.getByRole("button", { name: "قفل", exact: true }).first()
  await lock.click().catch(() => {})
  await page.waitForTimeout(1000)
  await shot(page, "mobile-vault-locked-light-ar.png")

  // Settings
  await page.evaluate(() => {
    window.localStorage.setItem("amanak.theme", "light")
    window.localStorage.setItem("amanak.locale", "ar")
  })
  await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(2000)
  await shot(page, "mobile-settings-light-ar.png")

  // Settings dark en
  await page.evaluate(() => {
    window.localStorage.setItem("amanak.theme", "dark")
    window.localStorage.setItem("amanak.locale", "en")
  })
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForTimeout(2000)
  await shot(page, "mobile-settings-dark-en.png")
})
