import { test, expect, testUser, useEnglish, registerUser } from "./fixtures"
import type { Page } from "@playwright/test"

const MASTER = "S3cure-Mast3r-2023!"
const SECRET = "correct-horse-battery-staple"

test.beforeEach(async ({ page }) => {
  await useEnglish(page)
})

async function createVault(page: Page): Promise<void> {
  await page.goto("/passwords")
  await expect(page.getByRole("heading", { name: "Create your password vault" })).toBeVisible()
  await page.getByLabel("Master password", { exact: true }).fill(MASTER)
  await page.getByLabel("Confirm master password", { exact: true }).fill(MASTER)
  await page.getByRole("button", { name: "Create vault" }).click()
  await expect(page.getByText("Your vault is empty")).toBeVisible()
}

async function unlockVault(page: Page): Promise<void> {
  await page.getByLabel("Master password", { exact: true }).fill(MASTER)
  await page.getByRole("button", { name: "Unlock", exact: true }).click()
}

test("setup, add a password, reveal it, lock and unlock", async ({ page }) => {
  await registerUser(page, testUser())
  await createVault(page)

  // Empty vault → add an entry.
  await page.getByRole("button", { name: "Add Entry" }).click()
  await page.getByLabel("Title", { exact: true }).fill("GitHub")
  await page.getByLabel("Username", { exact: true }).fill("octocat")
  await page.getByLabel("Website URL", { exact: true }).fill("https://github.com")
  await page.getByLabel("Password", { exact: true }).fill(SECRET)
  await page.getByRole("button", { name: "Add password", exact: true }).click()

  // The card is shown and the secret is masked until revealed.
  await expect(page.getByRole("heading", { name: "GitHub" })).toBeVisible()
  const reveal = page.getByTestId("password-masked")
  await expect(reveal).toHaveText("••••••••")

  await page.getByRole("button", { name: "Reveal" }).click()
  await expect(page.getByTestId("password-revealed")).toHaveText(SECRET)

  // Lock hides everything behind the unlock screen.
  await page.getByRole("button", { name: "Lock", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Vault locked" })).toBeVisible()
  await expect(page.getByTestId("password-revealed")).toHaveCount(0)

  // A wrong master password is rejected locally (server-blind check).
  await page.getByLabel("Master password", { exact: true }).fill("not-the-master-password")
  await page.getByRole("button", { name: "Unlock", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("Wrong password")

  // The correct master password re-unlocks the vault.
  await unlockVault(page)
  await expect(page.getByRole("heading", { name: "GitHub" })).toBeVisible()
  await page.getByRole("button", { name: "Reveal" }).click()
  await expect(page.getByTestId("password-revealed")).toHaveText(SECRET)
})

test("an empty vault still rejects a wrong master password", async ({ page }) => {
  await registerUser(page, testUser())
  await createVault(page)

  // Lock before adding anything: the vault has no entries to decrypt.
  await page.getByRole("button", { name: "Lock", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Vault locked" })).toBeVisible()

  await page.getByLabel("Master password", { exact: true }).fill("definitely-not-the-master")
  await page.getByRole("button", { name: "Unlock", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("Wrong password")

  // The correct master password still unlocks the empty vault.
  await page.getByLabel("Master password", { exact: true }).fill(MASTER)
  await page.getByRole("button", { name: "Unlock", exact: true }).click()
  await expect(page.getByText("Your vault is empty")).toBeVisible()
})

test("the vault is per-user: a second account never sees another vault", async ({ page }) => {
  await registerUser(page, testUser())
  await createVault(page)
  await page.getByRole("button", { name: "Add Entry" }).click()
  await page.getByLabel("Title", { exact: true }).fill("GitHub")
  await page.getByLabel("Password", { exact: true }).fill(SECRET)
  await page.getByRole("button", { name: "Add password", exact: true }).click()
  await expect(page.getByRole("heading", { name: "GitHub" })).toBeVisible()

  // Sign out and register a brand-new account.
  await page.getByRole("button", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/\/login$/)
  await registerUser(page, testUser())

  // The new account has no vault, so it must see the setup screen.
  await page.goto("/passwords")
  await expect(page.getByRole("heading", { name: "Create your password vault" })).toBeVisible()
  await expect(page.getByTestId("password-masked")).toHaveCount(0)
})

test("deleting the entire vault requires the account password and returns to setup", async ({
  page,
}) => {
  const user = testUser()
  await registerUser(page, user)
  await createVault(page)

  await page.getByRole("button", { name: "Delete vault", exact: true }).click()
  // A wrong account password must not wipe the vault.
  await page.getByLabel("Account password", { exact: true }).fill("wrong-account-password")
  await page.getByRole("button", { name: "Delete", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("incorrect")

  // The correct account password destroys the vault.
  await page.getByLabel("Account password", { exact: true }).fill(user.password)
  await page.getByRole("button", { name: "Delete", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Create your password vault" })).toBeVisible()
})
