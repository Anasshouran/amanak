import { test, expect, testUser, useEnglish, registerUser, loginUser } from "./fixtures"

test.beforeEach(async ({ page }) => {
  await useEnglish(page)
})

test("register lands on the dashboard, not the login screen", async ({ page }) => {
  await registerUser(page, testUser())
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()
  await expect(page).not.toHaveURL(/\/login$/)
})

test("a direct load of /register stays on /register", async ({ page }) => {
  await page.goto("/register")
  await expect(page).toHaveURL(/\/register$/)
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible()
})

test("login with a wrong password shows an inline error and stays on /login", async ({ page }) => {
  const user = testUser()
  await registerUser(page, user)

  await page.getByRole("button", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/\/login$/)

  await page.getByLabel("Email", { exact: true }).fill(user.email)
  await page.getByLabel("Password", { exact: true }).fill("definitely-wrong")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()

  await expect(page.getByRole("alert")).toContainText("Invalid email or password.")
  await expect(page).toHaveURL(/\/login$/)
})

test("login with correct credentials lands on the dashboard", async ({ page }) => {
  const user = testUser()
  await registerUser(page, user)
  await page.getByRole("button", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/\/login$/)

  await loginUser(page, user)
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()
})

test("logout returns to /login", async ({ page }) => {
  await registerUser(page, testUser())
  await page.getByRole("button", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/\/login$/)
})

test("a protected route redirects to /login when unauthenticated", async ({ page }) => {
  await page.goto("/settings")
  await expect(page).toHaveURL(/\/login$/)
})
