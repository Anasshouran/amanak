import { test as base, expect, type Page } from "@playwright/test"

export type TestUser = {
  email: string
  username: string
  password: string
}

let seq = 0

/** A unique throwaway account for each test run. */
export function testUser(): TestUser {
  seq += 1
  const unique = `${Date.now().toString(36)}${seq}${Math.random().toString(36).slice(2, 8)}`
  return {
    email: `e2e+${unique}@local.dev`,
    username: `e2e_${unique}`,
    password: "Password123!",
  }
}

/**
 * Force English + dark before the app boots so selectors are stable and
 * direction-independent. Tests that assert the defaults must NOT use this.
 */
export async function useEnglish(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("amanak.locale", "en")
    window.localStorage.setItem("amanak.theme", "dark")
  })
}

export async function registerUser(page: Page, user: TestUser): Promise<void> {
  await page.goto("/register")
  await expect(page).toHaveURL(/\/register$/)
  await page.getByLabel("Username", { exact: true }).fill(user.username)
  await page.getByLabel("Email", { exact: true }).fill(user.email)
  await page.getByLabel("Password", { exact: true }).fill(user.password)
  await page.getByLabel("Confirm password", { exact: true }).fill(user.password)
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(page).toHaveURL(/\/$/)
}

export async function loginUser(page: Page, user: TestUser): Promise<void> {
  await page.goto("/login")
  await page.getByLabel("Email", { exact: true }).fill(user.email)
  await page.getByLabel("Password", { exact: true }).fill(user.password)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
}

export const test = base
export { expect }
