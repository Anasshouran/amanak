import { test, expect, testUser, useEnglish, registerUser } from "./fixtures"
import type { Page } from "@playwright/test"

const MASTER = "S3cure-Mast3r-2023!"
const SECRET = "JBSWY3DPEHPK3PXP" // decodes to 10 raw bytes (RFC 4648)

test.beforeEach(async ({ page }) => {
  await useEnglish(page)
})

async function createVault(page: Page): Promise<void> {
  await page.goto("/vault")
  await expect(page.getByRole("heading", { name: "Create your vault" })).toBeVisible()
  await page.getByLabel("Master password", { exact: true }).fill(MASTER)
  await page.getByLabel("Confirm master password", { exact: true }).fill(MASTER)
  await page.getByRole("button", { name: "Create vault" }).click()
  await expect(page.getByText("No authenticator apps yet")).toBeVisible()
}

async function unlockVault(page: Page): Promise<void> {
  await page.getByLabel("Master password", { exact: true }).fill(MASTER)
  await page.getByRole("button", { name: "Unlock", exact: true }).click()
}

test("setup, add an entry, watch the code rotate, lock and unlock", async ({ page }) => {
  // The TOTP code only rotates when the 30 s window rolls over, so the poll
  // below can legitimately take up to ~30 s on top of the setup steps. The
  // default 30 s per-test budget is too small and made this test flake on the
  // window boundary.
  test.setTimeout(60_000)
  await registerUser(page, testUser())
  await createVault(page)

  // Empty vault → add an entry manually.
  await page.getByRole("button", { name: "Add entry" }).click()
  await page.getByLabel("Label", { exact: true }).fill("GitHub")
  await page.getByLabel("Issuer", { exact: true }).fill("Example Corp")
  await page.getByLabel("Secret (base32)", { exact: true }).fill(SECRET)
  await page.getByRole("button", { name: "Add code" }).click()

  const code = page.getByTestId("totp-code")
  await expect(code).toBeVisible()
  const codeText = (await code.textContent()) ?? ""
  expect(codeText).toMatch(/^\d{6}$/)

  // RFC 6238: the 6-digit code changes when the 30 s window rolls over.
  await expect
    .poll(async () => (await code.textContent()) ?? "", { timeout: 35_000 })
    .not.toBe(codeText)

  // Edit the label and issuer.
  await page.getByRole("button", { name: "Edit", exact: true }).click()
  await page.getByLabel("Label", { exact: true }).fill("GitHub (work)")
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(page.getByText("Example Corp", { exact: true })).toBeVisible()
  await expect(page.getByText("GitHub (work)", { exact: true })).toBeVisible()

  // Locking shows the unlock screen and hides the code.
  await page.getByRole("button", { name: "Lock", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Unlock your vault" })).toBeVisible()
  await expect(page.getByTestId("totp-code")).toHaveCount(0)

  // A wrong master password must be rejected locally (server-blind check).
  await page.getByLabel("Master password", { exact: true }).fill("not-the-master-password")
  await page.getByRole("button", { name: "Unlock", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("Wrong password")

  // The correct password re-unlocks and the code is still decryptable.
  await unlockVault(page)
  await expect(page.getByTestId("totp-code")).toBeVisible()
  await expect(code).toHaveText(/^\d{6}$/)
})

test("the vault is per-user: a second account never sees another vault", async ({ page }) => {
  const first = testUser()
  await registerUser(page, first)
  await createVault(page)
  await page.getByRole("button", { name: "Add entry" }).click()
  await page.getByLabel("Label", { exact: true }).fill("GitHub")
  await page.getByLabel("Secret (base32)", { exact: true }).fill(SECRET)
  await page.getByRole("button", { name: "Add code" }).click()
  await expect(page.getByTestId("totp-code")).toBeVisible()

  // Sign out and register a brand-new account.
  await page.getByRole("button", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/\/login$/)
  await registerUser(page, testUser())

  // The new account has no profile, so it must see the setup screen — never
  // the previous user's vault.
  await page.goto("/vault")
  await expect(page.getByRole("heading", { name: "Create your vault" })).toBeVisible()
  await expect(page.getByTestId("totp-code")).toHaveCount(0)
})

test("deleting the entire vault returns the user to setup", async ({ page }) => {
  await registerUser(page, testUser())
  await createVault(page)

  await page.getByRole("button", { name: "Delete vault", exact: true }).click()
  await page.getByRole("button", { name: "Delete", exact: true }).click()

  await expect(page.getByRole("heading", { name: "Create your vault" })).toBeVisible()
})