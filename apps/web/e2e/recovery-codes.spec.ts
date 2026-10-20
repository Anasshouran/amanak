import { test, expect, testUser, useEnglish, registerUser, waitForApiIdle } from "./fixtures"
import type { Page } from "@playwright/test"

const MASTER_A = "S3cure-Mast3r-2023!"
const MASTER_B = "N3w-S3cure-Mast3r-2023!"
const SECRET = "JBSWY3DPEHPK3PXP" // decodes to 10 raw bytes (RFC 4648)

test.beforeEach(async ({ page }) => {
  await useEnglish(page)
})

/**
 * Create a vault with password A, acknowledge the recovery codes and return
 * the first code so a test can later recover with it.
 */
async function createVaultWithCodes(page: Page, master: string): Promise<string> {
  await page.goto("/vault")
  await expect(page.getByRole("heading", { name: "Create your vault" })).toBeVisible()
  await page.getByLabel("Master password", { exact: true }).fill(master)
  await page.getByLabel("Confirm master password", { exact: true }).fill(master)
  await page.getByRole("button", { name: "Create vault" }).click()
  await waitForApiIdle(page)

  const codes = page.locator("code")
  await expect(codes).toHaveCount(10)
  const first = ((await codes.first().textContent()) ?? "").trim()
  const ack = page.getByRole("checkbox")
  await expect(ack).toHaveCount(1)
  await ack.check()
  const cont = page.getByRole("button", { name: /Continue/i })
  await expect(cont).toBeEnabled()
  await cont.click()
  return first
}

test("create vault shows 10 recovery codes and requires acknowledge", async ({ page }) => {
  await registerUser(page, testUser())
  await page.goto("/vault")
  await waitForApiIdle(page)
  await page.getByLabel("Master password", { exact: true }).fill("S3cure-Mast3r-2023!")
  await page.getByLabel("Confirm master password", { exact: true }).fill("S3cure-Mast3r-2023!")
  await page.getByRole("button", { name: "Create vault" }).click()
  await waitForApiIdle(page)

  // The 10 codes are always shown, and Continue is gated on the checkbox.
  await expect(page.locator("code")).toHaveCount(10)
  const cont = page.getByRole("button", { name: /Continue/i })
  await expect(cont).toBeDisabled()
  await page.getByRole("checkbox").check()
  await expect(cont).toBeEnabled()
  await cont.click()
  await expect(page.getByText("No authenticator apps yet")).toBeVisible()
})

test("invalid recovery code shows error", async ({ page }) => {
  // This test registers a fresh user, creates a vault, then tries a bogus code.
  await registerUser(page, testUser())
  await page.goto("/vault")
  await waitForApiIdle(page)
  await page.getByLabel("Master password", { exact: true }).fill("S3cure-Mast3r-2023!")
  await page.getByLabel("Confirm master password", { exact: true }).fill("S3cure-Mast3r-2023!")
  await page.getByRole("button", { name: "Create vault" }).click()
  await waitForApiIdle(page)
  await page.getByRole("checkbox").check()
  await page.getByRole("button", { name: /Continue/i }).click()
  await expect(page.getByText("No authenticator apps yet")).toBeVisible()

  await page.getByRole("button", { name: "Lock", exact: true }).click()
  await page.getByRole("button", { name: /Use recovery code/i }).click()
  await page.getByLabel("Recovery code").fill("ZZZZ-ZZZZ-ZZZZ-ZZZZ")
  await page.getByRole("button", { name: /^Recover$/ }).click()
  await expect(page.getByText(/Invalid or already used code/i).first()).toBeVisible()
})

test("full recovery flow: A → recovery → new password B → unlock with B, A dead", async ({
  page,
}) => {
  test.setTimeout(120_000)
  await registerUser(page, testUser())

  // 1. Create the vault with password A and capture a recovery code.
  const code = await createVaultWithCodes(page, MASTER_A)
  expect(code).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/)

  // 2. Add an entry encrypted under K_A.
  await page.getByRole("button", { name: "Add entry" }).click()
  await page.getByLabel("Label", { exact: true }).fill("GitHub")
  await page.getByLabel("Issuer", { exact: true }).fill("Example Corp")
  await page.getByLabel("Secret (base32)", { exact: true }).fill(SECRET)
  await page.getByRole("button", { name: "Add code" }).click()
  await expect(page.getByTestId("totp-code")).toBeVisible()

  // 3. Lock and recover with the code.
  await page.getByRole("button", { name: "Lock", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Unlock your vault" })).toBeVisible()
  await page.getByRole("button", { name: /Use recovery code/i }).click()
  await page.getByLabel("Recovery code").fill(code)
  await page.getByRole("button", { name: /^Recover$/ }).click()

  // 4. The mandatory new-master-password prompt appears.
  const np = page.getByTestId("recovery-new-password")
  await expect(np.getByRole("heading", { name: "Create a new master password" })).toBeVisible()
  await np.getByLabel("Master password", { exact: true }).fill(MASTER_B)
  await np.getByLabel("Confirm master password", { exact: true }).fill(MASTER_B)
  await np.getByRole("button", { name: /Vault unlocked/i }).click()

  // 5. Re-encryption completes and the vault is unlocked with the entry intact.
  await expect(page.getByTestId("totp-code")).toBeVisible()
  await expect(page.getByTestId("totp-code")).toHaveText(/^\d{6}$/)

  // 6. Lock → the OLD password A no longer unlocks.
  await page.getByRole("button", { name: "Lock", exact: true }).click()
  await page.getByLabel("Master password", { exact: true }).fill(MASTER_A)
  await page.getByRole("button", { name: "Unlock", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("Wrong password")

  // 7. Lock → the NEW password B unlocks and the entry is still decryptable.
  await page.getByLabel("Master password", { exact: true }).fill(MASTER_B)
  await page.getByRole("button", { name: "Unlock", exact: true }).click()
  await expect(page.getByTestId("totp-code")).toBeVisible()
  await expect(page.getByTestId("totp-code")).toHaveText(/^\d{6}$/)

  // 8. Settings shows the remaining recovery-code count (9 of 10 after use).
  await expect(page.getByText(/of 10 remaining/i)).toBeVisible()
})
