import { mkdir } from "node:fs/promises"
import { resolve } from "node:path"
import type { Page } from "@playwright/test"
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

/**
 * P17.3 scanner redesign — 4 PNGs:
 *   idle (light/ar), safe result (light/ar), malicious result (light/ar),
 *   message tab (light/en).
 */
test("captures the P17.3 scanner redesign", async ({ page }) => {
  test.setTimeout(180_000)
  await mkdir(OUT_DIR, { recursive: true })

  // Register while English so the auth labels are stable, then switch locale.
  await page.goto("/")
  await setThemeLocale(page, "light", "en")
  await registerUser(page, testUser())

  // 1. idle input, light, Arabic
  await setThemeLocale(page, "light", "ar")
  await gotoApp(page, "/scanner")
  await expect(page).toHaveURL(/\/scanner/)
  await page.locator("#scan-input").waitFor({ state: "visible" })
  await page.waitForTimeout(400)
  await page.screenshot({
    path: resolve(OUT_DIR, "scanner-idle-light-ar.png"),
    fullPage: true,
  })

  // 2. safe result, light, Arabic
  await page.locator("#scan-input").fill("https://example.com")
  await page.locator(".scan-input__actions .amk-btn").click()
  await expect(page.locator(".scan-result-card")).toBeVisible()
  await page.waitForTimeout(400)
  await page.screenshot({
    path: resolve(OUT_DIR, "scanner-result-safe-light-ar.png"),
    fullPage: true,
  })

  // 3. malicious result + populated history, light, Arabic
  await page.locator("#scan-input").fill("http://paypal-secure.com/signin")
  await page.locator(".scan-input__actions .amk-btn").click()
  await expect(page.locator(".scan-result-card")).toBeVisible()
  await expect(page.locator(".scan-history__button").first()).toBeVisible()
  await page.waitForTimeout(400)
  await page.screenshot({
    path: resolve(OUT_DIR, "scanner-result-malicious-light-ar.png"),
    fullPage: true,
  })

  // 4. message tab with a phishing message, light, English
  await setThemeLocale(page, "light", "en")
  await gotoApp(page, "/scanner")
  await page.getByRole("tab", { name: "Message Scan" }).click()
  await page.locator("#scan-input").fill("URGENT: your account is locked, verify at http://paypal-secure.com")
  await page.locator(".scan-input__actions .amk-btn").click()
  await expect(page.locator(".scan-result-card")).toBeVisible()
  await page.waitForTimeout(400)
  await page.screenshot({
    path: resolve(OUT_DIR, "scanner-message-tab-light-en.png"),
    fullPage: true,
  })
})

/**
 * P17.4a 2FA redesign — 2 PNGs:
 *   list view in light/Arabic and dark/English.
 */
const TWO_FA_MASTER = "Screenshot2026!Sec"
const TWO_FA_SECRET = "JBSWY3DPEHPK3PXP"

/**
 * The derived vault key is in-memory only (see src/crypto/unlock.ts), so any
 * full navigation re-locks the vault. After switching theme/locale we reload,
 * which means we must unlock again before the list is visible. The selectors
 * here are locale-agnostic on purpose.
 */
async function unlockIfLocked(page: Page) {
  const password = page.locator('input[autocomplete="current-password"]')
  await password.waitFor({ state: "visible", timeout: 5_000 }).catch(() => {})
  if (await password.isVisible().catch(() => false)) {
    await password.fill(TWO_FA_MASTER)
    await password.locator("xpath=ancestor::form").getByRole("button").click()
    await expect(password).toHaveCount(0)
  }
}

async function addManualEntry(
  page: Page,
  entry: { issuer: string; label: string; secret: string },
) {
  await page.getByRole("button", { name: "Add entry" }).click()
  await page.getByRole("tab", { name: "Manual" }).click()
  await page.getByLabel("Label", { exact: true }).fill(entry.label)
  await page.getByLabel("Issuer", { exact: true }).fill(entry.issuer)
  await page.getByLabel("Secret (base32)", { exact: true }).fill(entry.secret)
  await page.getByRole("button", { name: "Add code" }).click()
  await expect(page.getByText(entry.issuer, { exact: true })).toBeVisible()
}

test("captures the P17.4a 2FA redesign", async ({ page }) => {
  test.setTimeout(180_000)
  await mkdir(OUT_DIR, { recursive: true })

  // Fresh, unique account for this run.
  const user = { ...testUser(), email: `e2e-2fa-${Date.now()}@test.local` }

  // Register in English so the auth/setup labels are stable.
  await page.goto("/")
  await setThemeLocale(page, "light", "en")
  await registerUser(page, user)

  // Create the vault, then wait for the empty list.
  await page.goto("/vault")
  await expect(page.getByRole("heading", { name: "Create your vault" })).toBeVisible()
  await page.getByLabel("Master password", { exact: true }).fill(TWO_FA_MASTER)
  await page.getByLabel("Confirm master password", { exact: true }).fill(TWO_FA_MASTER)
  await page.getByRole("button", { name: "Create vault" }).click()
  await expect(page.getByText("No authenticator apps yet")).toBeVisible()

  // Add two entries manually.
  await addManualEntry(page, { issuer: "Google", label: "user@example.com", secret: TWO_FA_SECRET })
  await addManualEntry(page, { issuer: "GitHub", label: "dev@example.com", secret: TWO_FA_SECRET })

  // 1. Light + Arabic list view.
  await setThemeLocale(page, "light", "ar")
  await gotoApp(page, "/vault")
  await unlockIfLocked(page)
  await expect(page.getByText("Google", { exact: true })).toBeVisible()
  await page.waitForTimeout(400)
  await page.screenshot({
    path: resolve(OUT_DIR, "2fa-list-light-ar.png"),
    fullPage: true,
  })

  // 2. Dark + English list view.
  await setThemeLocale(page, "dark", "en")
  await gotoApp(page, "/vault")
  await unlockIfLocked(page)
  await expect(page.getByText("Google", { exact: true })).toBeVisible()
  await page.waitForTimeout(400)
  await page.screenshot({
    path: resolve(OUT_DIR, "2fa-list-dark-en.png"),
    fullPage: true,
  })
})


/**
 * P17.4b Password Vault redesign — 3 PNGs:
 *   unlocked list (light/ar), revealed (light/ar), locked (light/ar)
 */
const PASS_MASTER = "Screenshot2026!Sec"

async function unlockPassVault(page: Page, master: string) {
  const pwd = page.locator('input[autocomplete="current-password"]')
  if (await pwd.isVisible().catch(() => false)) {
    await pwd.fill(master)
    await pwd.locator("xpath=ancestor::form").locator('button[type="submit"]').click()
  }
}

test("captures the P17.4b password vault redesign", async ({ page }) => {
  test.setTimeout(180_000)
  await mkdir(OUT_DIR, { recursive: true })
  const user = { ...testUser(), email: `e2e-vault-${Date.now()}@test.local` }
  await page.goto("/")
  await setThemeLocale(page, "light", "en")
  await registerUser(page, user)
  await page.goto("/passwords")
  await expect(page.getByRole("heading", { name: "Create your password vault" })).toBeVisible()
  await page.getByLabel("Master password", { exact: true }).fill(PASS_MASTER)
  await page.getByLabel("Confirm master password", { exact: true }).fill(PASS_MASTER)
  await page.getByRole("button", { name: "Create vault" }).click()
  await expect(page.getByRole("heading", { name: "Password Vault", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Add Entry" }).click()
  await page.getByLabel("Title", { exact: true }).fill("GitHub")
  await page.getByLabel("Username", { exact: true }).fill("user@example.com")
  await page.getByLabel("Password", { exact: true }).fill("testpass123")
  await page.getByLabel("Website URL", { exact: true }).fill("https://github.com")
  await page.getByRole("button", { name: "Add password" }).click()
  // Wait for the two-phase create (POST → AAD rebind PATCH → list reload) to
  // finish before touching the page again: the modal closes only after the
  // save handler resolves, i.e. once the rebind PATCH has committed. Navigating
  // away mid-rebind aborts the PATCH and leaves the blob bound to the
  // placeholder AAD(0), which would make the entry undecryptable.
  await expect(page.getByRole("button", { name: "Add password" })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "GitHub" })).toBeVisible()
  await page.getByRole("button", { name: "Add Entry" }).click()
  await page.getByLabel("Title", { exact: true }).fill("Google")
  await page.getByLabel("Username", { exact: true }).fill("gmail@example.com")
  await page.getByLabel("Password", { exact: true }).fill("testpass123")
  await page.getByLabel("Website URL", { exact: true }).fill("https://gmail.com")
  await page.getByRole("button", { name: "Add password" }).click()
  await expect(page.getByRole("button", { name: "Add password" })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Google" })).toBeVisible()
  await setThemeLocale(page, "light", "ar")
  await gotoApp(page, "/passwords")
  await unlockPassVault(page, PASS_MASTER)
  await expect(page.getByText("GitHub", { exact: true })).toBeVisible()
  await page.waitForTimeout(400)
  await page.screenshot({ path: resolve(OUT_DIR, "vault-unlocked-light-ar.png"), fullPage: true })
  const rows = page.locator('.vault-row')
  // Locale-agnostic: the first action button of a masked row is "Reveal".
  const firstReveal = rows.first().locator(".vault-row__actions button").first()
  if (await firstReveal.count() > 0) await firstReveal.click()
  await expect(rows.first().getByTestId("reveal-timer")).toBeVisible()
  await page.waitForTimeout(400)
  await page.screenshot({ path: resolve(OUT_DIR, "vault-revealed-light-ar.png"), fullPage: true })
  // Locale-agnostic: the first header button is "Lock".
  await page.locator(".amk-page-head button").first().click()
  await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible()
  await page.waitForTimeout(400)
  await page.screenshot({ path: resolve(OUT_DIR, "vault-locked-light-ar.png"), fullPage: true })
})

test("captures the P17.8a awareness redesign", async ({ page }) => {
  test.setTimeout(180_000)
  await mkdir(OUT_DIR, { recursive: true })

  await page.goto("/")
  await setThemeLocale(page, "light", "en")
  await registerUser(page, testUser())
  await setThemeLocale(page, "light", "ar")

  // landing
  await gotoApp(page, "/awareness")
  await page.waitForTimeout(600)
  await page.screenshot({ path: resolve(OUT_DIR, "awareness-landing-light-ar.png"), fullPage: true })

  // session
  await page.locator(".amk-btn--primary").first().click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: resolve(OUT_DIR, "awareness-session-light-ar.png"), fullPage: true })

  // feedback
  const answerBtn = page.locator(".amk-btn--full:not([disabled])").first()
  await answerBtn.waitFor({ state: "visible", timeout: 10000 })
  await answerBtn.click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: resolve(OUT_DIR, "awareness-feedback-light-ar.png"), fullPage: true })

  // badges (dark en)
  await setThemeLocale(page, "dark", "en")
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForTimeout(800)
  await page.screenshot({ path: resolve(OUT_DIR, "awareness-badges-dark-en.png"), fullPage: true })
})

test("captures the P19.1b security activity polish", async ({ page }) => {
  test.setTimeout(180_000)
  await mkdir(OUT_DIR, { recursive: true })

  await page.goto("/")
  await setThemeLocale(page, "light", "en")
  await registerUser(page, testUser())
  await setThemeLocale(page, "light", "ar")

  // sessions
  await gotoApp(page, "/security")
  await page.waitForTimeout(600)
  await page.screenshot({ path: resolve(OUT_DIR, "security-sessions-light-ar.png"), fullPage: true })

  // alerts (switch tab)
  await page.getByRole("tab", { name: /التنبيهات|Alerts/i }).first().click().catch(() => {})
  await page.waitForTimeout(400)
  await page.screenshot({ path: resolve(OUT_DIR, "security-alerts-light-ar.png"), fullPage: true })

  // dark en
  await setThemeLocale(page, "dark", "en")
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForTimeout(800)
  await page.screenshot({ path: resolve(OUT_DIR, "security-activity-dark-en.png"), fullPage: true })
})
